export interface PengyouItem {
	title: string;
	author: string;
	date: string;
	link: string;
	content: string;
}

export interface PengyouConfig {
	api?: string;
	rss: {
		name: string;
		url: string;
		enabled?: boolean;
	}[];
	data: PengyouItem[];
}

export const pengyouConfig: PengyouConfig = {
	api: '',
	rss: [
		{
			name: "萌萌知识库",
			url: "https://tblog.mmzhiku.xyz/rss.xml",
			enabled: true,
		},
		{
			name: "团子和蛋糕的博客",
			url: "https://blog.tsh520.cn/rss.xml",
			enabled: true,
		},
				{
			name: "顾拾柒",
			url: "https://blog.olinl.com/rss.xml",
			enabled: true,
		},
		
	],
	data: []
};