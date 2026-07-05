import { handleGithubProxy } from "../src/workers/github-proxy.js";

export const config = {
	runtime: "edge",
};

export default async function handler(request) {
	const env = {
		PUBLIC_GITHUB_APP_ID: process.env.PUBLIC_GITHUB_APP_ID || "",
		GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || "",
		PUBLIC_GITHUB_OWNER: process.env.PUBLIC_GITHUB_OWNER || "fqzlr",
		PUBLIC_GITHUB_REPO: process.env.PUBLIC_GITHUB_REPO || "my-blog",
		VERCEL_ENV: process.env.VERCEL_ENV || "development",
		VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || "master",
	};
	return handleGithubProxy(request, env);
}
