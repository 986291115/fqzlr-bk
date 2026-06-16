#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
影视封面下载 + TMDB 搜索 + 自动生成博客 md

用法:
    # 先设置 API key
    set TMDB_API_KEY=你的key              # Windows
    export TMDB_API_KEY=你的key            # Linux/Mac

    # 交互模式
    python fetch-media.py "星际穿越"

    # 指定类型 (movie / tv / anime / documentary)
    python fetch-media.py "黑暗荣耀" --type=tv

    # 快速模式（自动选第一个结果，status=看过，跳过确认）
    python fetch-media.py "你的名字" -y

    # 快速模式 + 预设状态和评分
    python fetch-media.py "你的名字" -y --status=2 --score=8

    # 手动模式（TMDB 搜不到时自动降级，也可带封面 URL）
    python fetch-media.py "冷门电影" -y --cover-url=https://xxx/poster.jpg

    # 通过参数传 API key
    python fetch-media.py "星际穿越" --api-key=你的key

TMDB 搜不到时自动降级为手动模式，交互填写所有字段。

默认 MD 输出目录: src/content/bangumi/anime/
默认封面输出目录: scripts/img-anime/
封面 CDN 地址: https://ph.0824.uk/file/anime/

TMDB API: https://developer.themoviedb.org/reference/intro/getting-started
"""

import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import date

# Windows 终端 UTF-8 支持
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ── 配置 ──────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLOG_BANGUMI_DIR = os.path.join(BASE_DIR, "src", "content", "bangumi", "anime")
COVER_DIR = os.path.join(os.path.dirname(__file__), "img-anime")
CDN_BASE = "https://ph.0824.uk/file/anime"
TMDB_API_KEY = "8a9a0dd41f7b6fe6d4d20f6cc9bd26f2"
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

STATUS_LABELS = {1: "想看", 2: "看过", 3: "在看", 4: "搁置", 5: "抛弃"}

GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪",
    99: "纪录片", 18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史",
    27: "恐怖", 10402: "音乐", 9648: "悬疑", 10749: "爱情", 878: "科幻",
    10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部",
    10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀",
    10765: "科幻悬疑", 10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治",
}

# ── 工具函数 ──────────────────────────────────────────

def human_size(n):
    for u in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return "{:.0f} {}".format(n, u)
        n /= 1024
    return "{:.1f} GB".format(n)


def download_file(url, filepath, label=""):
    """下载文件带进度条，返回是否成功"""
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            with open(filepath, "wb") as f:
                downloaded = 0
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 // total
                        bar_len = 25
                        filled = downloaded * bar_len // total
                        bar = "=" * filled + ">" + " " * (bar_len - filled)
                        print("\r  {} [{:3d}%] {} {}/{}".format(
                            label, pct, bar, human_size(downloaded), human_size(total)), end="")
                print()
        return True
    except Exception as e:
        print("\n  下载失败: {}".format(e))
        if os.path.exists(filepath):
            os.remove(filepath)
        return False


def tmdb_request(endpoint, api_key, params=None):
    """调用 TMDB API，返回 JSON 数据"""
    if params is None:
        params = {}
    params["api_key"] = api_key
    params["language"] = "zh-CN"
    url = "{}{}?{}".format(TMDB_BASE, endpoint, urllib.parse.urlencode(params))
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print("  API 请求失败: {}".format(e))
        return None


# ── 搜索与详情 ────────────────────────────────────────

def search_multi(query, api_key):
    """搜索影视，返回结果列表"""
    data = tmdb_request("/search/multi", api_key, {"query": query})
    if not data or "results" not in data:
        return []
    results = []
    for item in data["results"]:
        media_type = item.get("media_type", "")
        if media_type not in ("movie", "tv"):
            continue
        results.append(item)
    return results


def get_movie_detail(movie_id, api_key):
    return tmdb_request("/movie/{}".format(movie_id), api_key)


def get_tv_detail(tv_id, api_key):
    return tmdb_request("/tv/{}".format(tv_id), api_key)


def extract_info(item, api_key):
    """从搜索结果条目提取完整信息"""
    media_type = item.get("media_type", "movie")
    detail = None

    if media_type == "movie":
        detail = get_movie_detail(item["id"], api_key)
        title = detail.get("title", item.get("title", "?")) if detail else item.get("title", "?")
        original_title = detail.get("original_title", "") if detail else ""
        year = (detail.get("release_date", "") or "")[:4] if detail else ""
        genres = detail.get("genres", []) if detail else []
        tagline = detail.get("tagline", "") if detail else ""
    else:
        detail = get_tv_detail(item["id"], api_key)
        title = detail.get("name", item.get("name", "?")) if detail else item.get("name", "?")
        original_title = detail.get("original_name", "") if detail else ""
        year = (detail.get("first_air_date", "") or "")[:4] if detail else ""
        genres = detail.get("genres", []) if detail else []
        tagline = detail.get("tagline", "") if detail else ""

    poster_path = item.get("poster_path") or (detail.get("poster_path") if detail else None)
    overview = detail.get("overview", "") if detail else ""

    return {
        "title": title,
        "original_title": original_title,
        "year": year,
        "media_type": media_type,
        "poster_path": poster_path,
        "genres": genres,
        "overview": overview,
        "tagline": tagline,
    }


# ── 子分类判断 ────────────────────────────────────────

def determine_subcategory(media_type, genres, user_type=None):
    """根据 media_type 和 genre 判断 subcategory"""
    if user_type:
        type_map = {
            "movie": "movie", "tv": "tv",
            "anime": "anime", "documentary": "documentary",
        }
        if user_type in type_map:
            return type_map[user_type]

    genre_names = [g.get("name", "") for g in genres]

    if media_type == "movie":
        if any("动画" in n for n in genre_names):
            return "anime"
        if any("纪录" in n for n in genre_names):
            return "documentary"
        return "movie"
    elif media_type == "tv":
        if any("动画" in n for n in genre_names):
            return "anime"
        if any("纪录" in n for n in genre_names):
            return "documentary"
        return "tv"
    return "movie"


# ── Markdown 生成 ──────────────────────────────────────

def write_markdown(md_path, title, name_cn, category, subcategory, status,
                   image_path, score, tags, published_str, comment):
    if tags:
        tags_block = "tags:\n" + "\n".join("  - {}".format(t) for t in tags)
    else:
        tags_block = "tags: []"
    md = """---
title: {title}
name_cn: {name_cn}
category: {category}
subcategory: {subcategory}
status: {status}
image: {image}
score: {score}
{tags_block}
published: {published}
---
{comment}
""".format(
        title=title,
        name_cn=name_cn,
        category=category,
        subcategory=subcategory,
        status=status,
        image=image_path,
        score=score,
        tags_block=tags_block,
        published=published_str,
        comment=comment,
    )
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md)


# ── 主流程 ────────────────────────────────────────────

def process(query, api_key, user_type=None, fast_mode=False,
            preset_status=None, preset_score=None, cover_url=""):
    """主流程：搜索 → 选择 → 下载封面 → 生成 md"""

    # 1. 搜索
    print("\n搜索: {}".format(query))
    results = search_multi(query, api_key)

    if not results:
        print("  TMDB 未找到结果，切换到手动模式")
        return process_manual(query, user_type, fast_mode, preset_status, preset_score, cover_url)

    # 2. 展示结果
    print("\n搜索结果:\n")
    display_results = results[:10]
    for i, item in enumerate(display_results):
        media_type = item.get("media_type", "?")
        type_tag = "[电影]" if media_type == "movie" else "[剧集]" if media_type == "tv" else "[?]"
        t = item.get("title") or item.get("name") or "?"
        year = (item.get("release_date") or item.get("first_air_date") or "")[:4]
        year_str = "({})".format(year) if year else ""
        overview = (item.get("overview") or "")[:80]
        print("  [{:2d}] {} {} {}".format(i + 1, type_tag, t, year_str))
        if overview:
            print("       {}".format(overview))

    # 3. 选择
    if len(display_results) == 1:
        pick = 1
    elif fast_mode:
        pick = 1
        print("\n快速模式: 自动选择第 1 个")
    else:
        try:
            choice = input("\n选择序号 (1-{}, 默认 1): ".format(len(display_results))).strip()
            pick = int(choice) if choice else 1
            if pick < 1 or pick > len(display_results):
                print("无效选择")
                return False
        except (ValueError, KeyboardInterrupt, EOFError):
            print()
            pick = 1

    selected = display_results[pick - 1]
    print("\n获取详情...")

    # 4. 获取详情
    info = extract_info(selected, api_key)

    title = info["title"]
    original_title = info["original_title"]
    year = info["year"]
    media_type = info["media_type"]
    poster_path = info["poster_path"]
    overview = info["overview"]
    tagline = info["tagline"]

    # 类型标签（从 genre 获取中文名，取前 5 个）
    genre_tags = [g.get("name", "") for g in info["genres"] if g.get("name")]
    if not genre_tags:
        genre_tags = ["电影"] if media_type == "movie" else ["剧集"]

    subcategory = determine_subcategory(media_type, info["genres"], user_type)

    print("\n" + "=" * 50)
    print("  标题: {}".format(title))
    if original_title and original_title != title:
        print("  原名: {}".format(original_title))
    print("  类型: {} → subcategory: {}".format(
        "电影" if media_type == "movie" else "电视剧", subcategory))
    if year:
        print("  年份: {}".format(year))
    if tagline:
        print("  标语: {}".format(tagline))
    print("  标签: {}".format(", ".join(genre_tags)))
    if overview:
        print("  简介: {}...".format(overview[:120]))
    print("=" * 50)

    # 5. 确认 / 填写字段
    image_path = "https://ph.0824.uk/file/anime/{}.jpg".format(title)

    if fast_mode:
        status = preset_status or 2
        score = preset_score or 0
        tags = genre_tags
        comment = ""
        print("\n快速模式: status={}({}), score={}, tags={}".format(
            status, STATUS_LABELS.get(status, "?"), score, tags))
    else:
        # status
        print("\n状态: 1:想看 2:看过 3:在看 4:搁置 5:抛弃")
        if preset_status:
            status = preset_status
            print("  [预设] status = {} ({})".format(status, STATUS_LABELS.get(status, "?")))
        else:
            try:
                s = input("  选择状态 (默认 2): ").strip()
                status = int(s) if s else 2
            except (ValueError, EOFError):
                status = 2

        # score
        if preset_score is not None:
            score = preset_score
            print("  [预设] score = {}".format(score))
        else:
            try:
                s = input("  评分 0-10 (默认 0): ").strip()
                score = int(s) if s else 0
            except (ValueError, EOFError):
                score = 0

        # tags
        print("  当前标签: {}".format(", ".join(genre_tags)))
        t = input("  修改标签 (回车确认，逗号分隔): ").strip()
        if t:
            tags = [x.strip() for x in t.split(",") if x.strip()]
        else:
            tags = genre_tags

        # comment
        comment = input("  评价/备注 (可选): ").strip()

    # 6. 下载封面
    os.makedirs(COVER_DIR, exist_ok=True)
    cover_file = os.path.join(COVER_DIR, "{}.jpg".format(title))

    if os.path.exists(cover_file):
        print("\n  [跳过] 已有封面: {}.jpg".format(title))
    elif poster_path:
        poster_url = "{}{}".format(TMDB_IMAGE_BASE, poster_path)
        print("\n  下载封面: {}.jpg".format(title))
        download_file(poster_url, cover_file, "封面")
    else:
        print("\n  [无封面] 该影视无海报")

    # 7. 生成 md
    os.makedirs(BLOG_BANGUMI_DIR, exist_ok=True)
    md_file = "{}.md".format(title)
    md_path = os.path.join(BLOG_BANGUMI_DIR, md_file)

    # name_cn: 如果 title 是中文则 title 即为 name_cn，否则用 original_title
    name_cn = title
    published_str = date.today().isoformat()
    category = "anime"  # bangumi 中影视统一用 anime 类别

    if os.path.exists(md_path):
        print("  [跳过] 已有 md: {}".format(md_file))
    else:
        write_markdown(md_path, title, name_cn, category, subcategory, status,
                       image_path, score, tags, published_str, comment)
        print("  [MD] {}".format(md_file))

    print("\n完成: {}".format(title))
    return True


# ── 手动模式 ────────────────────────────────────────────

def process_manual(title, user_type=None, fast_mode=False,
                   preset_status=None, preset_score=None, cover_url=""):
    print("\n" + "=" * 50)
    print("  标题: {}".format(title))
    print("=" * 50)

    if fast_mode:
        subcategory = user_type or "movie"
        status = preset_status or 2
        score = preset_score or 0
        tags = []
        comment = ""
        cover_url_input = cover_url
        print("快速模式: subcategory={}, status={}({}), score={}".format(
            subcategory, status, STATUS_LABELS.get(status, "?"), score))
    else:
        # subcategory
        print("\n类型: movie=电影 / tv=电视剧 / anime=动画 / documentary=纪录片")
        sc = input("  选择类型 (默认 movie): ").strip()
        subcategory = sc if sc in ("movie", "tv", "anime", "documentary") else "movie"

        # status
        print("状态: 1:想看 2:看过 3:在看 4:搁置 5:抛弃")
        if preset_status:
            status = preset_status
            print("  [预设] status = {} ({})".format(status, STATUS_LABELS.get(status, "?")))
        else:
            try:
                s = input("  选择状态 (默认 2): ").strip()
                status = int(s) if s else 2
            except (ValueError, EOFError):
                status = 2

        # score
        if preset_score is not None:
            score = preset_score
            print("  [预设] score = {}".format(score))
        else:
            try:
                s = input("  评分 0-10 (默认 0): ").strip()
                score = int(s) if s else 0
            except (ValueError, EOFError):
                score = 0

        # tags
        t = input("  标签 (逗号分隔): ").strip()
        tags = [x.strip() for x in t.split(",") if x.strip()] if t else []

        # comment
        comment = input("  评价/备注 (可选): ").strip()

        # cover URL (可选)
        cover_url_input = input("  封面图 URL (可选，回车跳过): ").strip()

    # 下载封面（如果提供了 URL）
    if cover_url_input:
        os.makedirs(COVER_DIR, exist_ok=True)
        ext = ".jpg"
        if cover_url_input.lower().endswith(".png"):
            ext = ".png"
        elif cover_url_input.lower().endswith(".webp"):
            ext = ".webp"
        cover_file = os.path.join(COVER_DIR, "{}{}".format(title, ext))
        print("  下载封面...")
        download_file(cover_url_input, cover_file, "封面")
    else:
        if fast_mode:
            print("  封面: [无] (手动模式下用 --cover-url= 参数传入)")

    # 生成 md
    image_path = "{}/{}.jpg".format(CDN_BASE, title)
    os.makedirs(BLOG_BANGUMI_DIR, exist_ok=True)
    md_file = "{}.md".format(title)
    md_path = os.path.join(BLOG_BANGUMI_DIR, md_file)

    if os.path.exists(md_path):
        print("  [跳过] 已有 md: {}".format(md_file))
    else:
        write_markdown(md_path, title, title, "anime", subcategory, status,
                       image_path, score, tags, date.today().isoformat(), comment)
        print("  [MD] {}".format(md_file))

    print("\n完成: {}".format(title))
    return True


# ── main ──────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__.strip())
        sys.exit(1)

    query = sys.argv[1]
    api_key = None
    user_type = None
    fast_mode = False
    preset_status = None
    preset_score = None
    cover_url = ""

    for a in sys.argv[2:]:
        if a.startswith("--api-key="):
            api_key = a.split("=", 1)[1]
        elif a.startswith("--type="):
            user_type = a.split("=", 1)[1]
        elif a in ("-y", "--yes"):
            fast_mode = True
        elif a.startswith("--status="):
            try:
                preset_status = int(a.split("=", 1)[1])
            except ValueError:
                print("无效 status: {}".format(a))
                sys.exit(1)
        elif a.startswith("--score="):
            try:
                preset_score = int(a.split("=", 1)[1])
            except ValueError:
                print("无效 score: {}".format(a))
                sys.exit(1)
        elif a.startswith("--cover-url="):
            cover_url = a.split("=", 1)[1]

    # API key 优先级: 命令行参数 > 环境变量 > 内置 key
    if not api_key:
        api_key = os.environ.get("TMDB_API_KEY", "")
    if not api_key:
        api_key = TMDB_API_KEY

    process(query, api_key, user_type, fast_mode, preset_status, preset_score, cover_url)


if __name__ == "__main__":
    main()
