/**
 * AI 搜索统一配置中心
 *
 * 所有 AI 相关配置集中在此。
 */

export const aiSearchConfig = {
	/** 是否启用 AI 搜索 */
	enable: true,

	/** 对话模型名称（显示在 AI 搜索弹窗标题） */
	modelName: "DeepSeek-V3",

	/** AI 名称 */
	aiName: "番茄助手",

	/** AI 头像路径 */
	aiAvatar: "/assets/images/aut.webp",

	/** 建议问题 */
	suggestions: ["博客的技术栈是什么？", "介绍一下自己"],

	/** 后续建议问题 */
	followUpSuggestions: ["说说最近的文章", "有什么推荐的项目？"],
};
