#!/usr/bin/env node

/**
 * Obsidian 笔记同步脚本
 * 将 Obsidian 笔记同步到 Astro 博客项目的 content 文件夹
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import config from './sync.config.js';

// 工具函数：解析 frontmatter
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    try {
      const frontmatter = {};
      match[1].split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();

          // 解析数组值（以 - 开头的行）
          if (value === '') {
            const lines = [];
            let i = match[1].indexOf(line) + line.length;
            const linesArr = match[1].split('\n');
            const currentIdx = linesArr.indexOf(line);
            for (let j = currentIdx + 1; j < linesArr.length; j++) {
              const nextLine = linesArr[j];
              if (nextLine.startsWith('-')) {
                lines.push(nextLine.substring(1).trim());
              } else {
                break;
              }
            }
            if (lines.length > 0) {
              value = lines;
            }
          } else if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }

          frontmatter[key] = value;
        }
      });

      return {
        frontmatter,
        content: match[2] || '',
      };
    } catch (e) {
      console.warn('⚠️  frontmatter 解析失败:', e.message);
    }
  }

  return { frontmatter: {}, content };
}

// 工具函数：生成文件名
function generateFileName(frontmatter, originalName, mapping) {
  // 如果配置了日期前缀且 frontmatter 中有日期字段
  if (mapping.datePrefix && mapping.dateField && frontmatter[mapping.dateField]) {
    const date = frontmatter[mapping.dateField];
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    // 如果文件名已经以日期开头，就不再添加
    if (!/^\d{4}-\d{2}-\d{2}/.test(baseName)) {
      return `${date}${ext}`;
    }
  }

  return originalName;
}

// 工具函数：复制文件
function copyFile(src, dest, skipIfExists = true) {
  return new Promise((resolve, reject) => {
    if (skipIfExists && fs.existsSync(dest)) {
      resolve({ skipped: true, reason: '文件已存在' });
      return;
    }

    // 确保目标目录存在
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFile(src, dest, (err) => {
      if (err) reject(err);
      else resolve({ skipped: false, dest });
    });
  });
}

// 工具函数：获取文件修改时间
function getFileModTime(filePath) {
  try {
    return fs.statSync(filePath).mtime.getTime();
  } catch {
    return 0;
  }
}

// 工具函数：递归复制文件夹
async function copyDirectory(src, dest) {
  let copiedCount = 0;

  // 确保目标目录存在
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // 递归复制子目录
      copiedCount += await copyDirectory(srcPath, destPath);
    } else {
      // 复制文件
      const result = await copyFile(srcPath, destPath, true);
      if (!result.skipped) {
        copiedCount++;
      }
    }
  }

  return copiedCount;
}

// 同步指定类型
async function syncType(mapping) {
  const obsidianFolder = path.join(config.obsidianVaultPath, mapping.obsidianFolder);
  const targetFolder = path.join(config.projectContentPath, mapping.targetFolder);

  // 检查源文件夹是否存在
  if (!fs.existsSync(obsidianFolder)) {
    console.log(`⚠️  跳过 ${mapping.type}: Obsidian 文件夹不存在: ${obsidianFolder}`);
    return { total: 0, copied: 0, skipped: 0 };
  }

  // 确保目标文件夹存在
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  let total = 0;
  let copied = 0;
  let skipped = 0;

  // 递归读取所有文件（支持所有文件类型）
  function readAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // 跳过系统文件夹和 assets 文件夹（assets 会在处理笔记时单独同步）
        if (file === '.obsidian' || file.startsWith('.') || file === 'assets') continue;
        readAllFiles(filePath, fileList);
      } else {
        // 包含所有文件（不只是 .md）
        fileList.push({
          path: filePath,
          relativePath: path.relative(obsidianFolder, filePath),
          name: file,
          modTime: getFileModTime(filePath),
        });
      }
    }

    return fileList;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📁 正在同步: ${mapping.type}`);
  console.log(`   源目录: ${obsidianFolder}`);
  console.log(`   目标目录: ${targetFolder}`);
  console.log(`   开始时间: ${new Date().toLocaleTimeString()}`);
  console.log(`${'='.repeat(50)}\n`);

  const files = readAllFiles(obsidianFolder);
  total = files.length;

  // 用于记录已同步的 assets 文件夹，避免重复
  const syncedAssets = new Set();

  // 统计信息
  const stats = {
    md: { copied: 0, skipped: 0 },
    assets: { copied: 0, skipped: 0 },
    other: { copied: 0, skipped: 0 },
  };

  for (const fileInfo of files) {
    try {
      // 只有 .md 文件才需要解析 frontmatter 并处理同级 assets
      if (fileInfo.name.endsWith('.md')) {
        const content = fs.readFileSync(fileInfo.path, 'utf-8');
        const { frontmatter } = parseFrontmatter(content);

        // 生成目标文件名
        const newFileName = generateFileName(frontmatter, fileInfo.name, mapping);
        const relativeDir = path.dirname(fileInfo.relativePath);
        const targetDir = path.join(targetFolder, relativeDir);
        const targetPath = path.join(targetDir, newFileName);

        const result = await copyFile(fileInfo.path, targetPath, true);

        if (result.skipped) {
          stats.md.skipped++;
          if (config.verbose) {
            console.log(`  ⏭️  [已存在] ${fileInfo.relativePath}`);
          }
        } else {
          stats.md.copied++;
          console.log(`  ✅ [笔记] ${fileInfo.relativePath} → ${path.relative(targetFolder, targetPath)}`);
        }

        // 检查并同步同级 assets 文件夹
        const noteDir = path.dirname(fileInfo.path); // Obsidian 中笔记所在的目录
        const assetsDir = path.join(noteDir, 'assets');

        if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
          // 生成 assets 的目标目录
          const assetsTargetDir = path.join(targetFolder, relativeDir, 'assets');

          // 避免重复同步同一个 assets 文件夹
          const assetsKey = assetsDir;

          if (!syncedAssets.has(assetsKey)) {
            syncedAssets.add(assetsKey);

            // 递归复制整个 assets 文件夹
            const copiedAssets = await copyDirectory(assetsDir, assetsTargetDir);

            if (copiedAssets > 0) {
              stats.assets.copied += copiedAssets;
              console.log(`  📦 [资源] ${path.relative(obsidianFolder, assetsDir)}/ → ${path.relative(targetFolder, assetsTargetDir)}/`);
            }
          }
        }
      } else {
        // 非 .md 文件直接复制，保持原文件名
        const relativeDir = path.dirname(fileInfo.relativePath);
        const targetDir = path.join(targetFolder, relativeDir);
        const targetPath = path.join(targetDir, fileInfo.name);

        const result = await copyFile(fileInfo.path, targetPath, true);

        if (result.skipped) {
          stats.other.skipped++;
          if (config.verbose) {
            console.log(`  ⏭️  [已存在] ${fileInfo.relativePath}`);
          }
        } else {
          stats.other.copied++;
          console.log(`  ✅ [文件] ${fileInfo.relativePath} → ${path.relative(targetFolder, targetPath)}`);
        }
      }
    } catch (err) {
      console.error(`  ❌ [失败] ${fileInfo.relativePath}: ${err.message}`);
      skipped++;
    }
  }

  // 统计总数
  const totalCopied = stats.md.copied + stats.assets.copied + stats.other.copied;
  const totalSkipped = stats.md.skipped + stats.assets.skipped + stats.other.skipped;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 同步完成！`);
  console.log(`\n📈 详细统计:`);
  console.log(`   📝 笔记文件: ${stats.md.copied} 个新增, ${stats.md.skipped} 个已存在`);
  console.log(`   📦 资源文件: ${stats.assets.copied} 个新增, ${stats.assets.skipped} 个已存在`);
  console.log(`   📄 其他文件: ${stats.other.copied} 个新增, ${stats.other.skipped} 个已存在`);
  console.log(`   ${'─'.repeat(40)}`);
  console.log(`   总计: ${totalCopied} 个新增, ${totalSkipped} 个已存在`);
  console.log(`${'═'.repeat(50)}`);

  return { total: totalCopied + totalSkipped, copied: totalCopied, skipped: totalSkipped };
}

// 主函数
async function main() {
  console.log('🚀 Obsidian 笔记同步工具\n');
  console.log('='.repeat(50));

  // 验证配置
  if (!fs.existsSync(config.obsidianVaultPath)) {
    console.error('❌ Obsidian vault 路径不存在:', config.obsidianVaultPath);
    console.error('📝 请编辑 sync.config.js 修改配置');
    process.exit(1);
  }

  if (!fs.existsSync(config.projectContentPath)) {
    console.error('❌ 项目 content 路径不存在:', config.projectContentPath);
    process.exit(1);
  }

  // 创建交互式菜单
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const menuOptions = [
    { id: 1, name: '同步文章', mappings: ['文章'] },
    { id: 2, name: '同步动态', mappings: ['动态'] },
    { id: 3, name: '同步记录', mappings: ['记录'] },
    { id: 4, name: '同步生活', mappings: ['生活'] },
    { id: 5, name: '同步全部', mappings: null },
    { id: 6, name: '退出', mappings: null },
  ];

  function showMenu() {
    console.log('\n请选择要同步的内容类型:\n');
    menuOptions.forEach(opt => {
      console.log(`  ${opt.id}. ${opt.name}`);
    });
    console.log('');
  }

  function askChoice() {
    return new Promise((resolve) => {
      rl.question('请输入选项 (1-6): ', (answer) => {
        const choice = parseInt(answer.trim());
        resolve(choice);
      });
    });
  }

  while (true) {
    showMenu();
    const choice = await askChoice();
    const selected = menuOptions.find(opt => opt.id === choice);

    if (!selected) {
      console.log('❌ 无效选项，请重新输入');
      continue;
    }

    if (selected.id === 5) {
      console.log('👋 再见!');
      rl.close();
      process.exit(0);
    }

    if (selected.id === 6) {
      // 同步全部
      console.log('\n🔄 开始同步所有内容...\n');
      for (const mapping of config.mappings) {
        await syncType(mapping);
      }
    } else if (selected.mappings) {
      // 同步指定类型
      const mapping = config.mappings.find(m => m.type === selected.mappings[0]);
      if (mapping) {
        await syncType(mapping);
      } else {
        console.log(`❌ 未找到配置: ${selected.mappings[0]}`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // 等待用户按回车继续
    await new Promise((resolve) => {
      rl.question('\n按回车键继续...', resolve);
    });
  }
}

// 错误处理
process.on('unhandledRejection', (err) => {
  console.error('❌ 发生错误:', err.message);
  process.exit(1);
});

// 启动
main().catch((err) => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});
