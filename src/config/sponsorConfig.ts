import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "赞助",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "感谢您的支持，您的赞助将帮助我持续创作优质内容",

	// 赞助用途说明
	usage: "",

	// 是否显示赞助者列表
	showSponsorsList: true,

	// 是否在文章详情页底部显示赞助按钮
	showButtonInPost: true,

	// 赞助方式列表
	methods: [
		{
			name: "爱发电",
			icon: "simple-icons:afdian",
			qrCode: "",
			link: "https://ifdian.net/a/fqzlr",
			description: "通过 爱发电 进行赞助",
			enabled: true,
		},
		{
			name: "微信",
			icon: "fa7-brands:weixin",
			qrCode: "/assets/images/sponsor/wechat.png",
			link: "",
			description: "使用 微信 扫码赞助",
			enabled: true,
		},
		{
			name: "支付宝",
			icon: "fa7-brands:alipay",
			qrCode: "/assets/images/sponsor/alipay.png",
			link: "",
			description: "使用 支付宝 扫码赞助",
			enabled: true,
		},
	],

	// 赞助者列表（可选）
	sponsors: [
		{
			name: "番茄主理人",
			amount: "¥50",
			date: "2025-10-01",
		},
		{
			name: "214556787",
			amount: "¥1",
			date: "2025-10-01",
		},
		{
			name: "哈基墩",
			amount: "¥0.01",
			date: "2026-01-01",
		},
	],
};
