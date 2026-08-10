// GitHub REST API에서 레포의 기본 README 원문을 가져온다.
// README가 없거나 조회가 실패해도 뉴스레터 생성을 계속할 수 있도록 빈 문자열을 반환한다.

/**
 * @typedef {import("./fetch-trending.mjs").TrendingRepo} TrendingRepo
 */

/**
 * @param {TrendingRepo} repo
 * @returns {Promise<string>}
 */
export async function fetchRepoReadme(repo) {
  const headers = {
    Accept: "application/vnd.github.raw+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "trending-newsletter (+https://github.com/devjh-jiki/trending-newsletter)",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const owner = encodeURIComponent(repo.owner);
  const name = encodeURIComponent(repo.name);
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`, {
      headers,
    });
    if (response.status === 404) return "";
    if (!response.ok) {
      console.warn(`[readme] ${repo.repo}: GitHub API ${response.status}`);
      return "";
    }
    return await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[readme] ${repo.repo}: ${message}`);
    return "";
  }
}
