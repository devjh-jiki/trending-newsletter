// GitHub Trending 수집 골격.
// 공식 API가 없으므로 HTML을 파싱하거나 비공식 API를 사용한다.
// 여기서는 의존성 없이 fetch + 정규식으로 최소 동작하는 형태를 제공한다.
// 실제로는 cheerio 등으로 견고하게 파싱하는 것을 권장.

/**
 * @typedef {Object} TrendingRepo
 * @property {string} repo      - "owner/name"
 * @property {string} url
 * @property {string} description
 * @property {string} language
 * @property {string} stars     - 오늘 별 증가 등 (텍스트)
 */

/**
 * @param {{ since?: "daily"|"weekly"|"monthly", language?: string }} [opts]
 * @returns {Promise<TrendingRepo[]>}
 */
export async function fetchTrending(opts = {}) {
  const { since = "daily", language = "" } = opts;
  const url = `https://github.com/trending/${encodeURIComponent(language)}?since=${since}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "trending-newsletter (https://github.com/devjh-jiki)" },
  });
  if (!res.ok) throw new Error(`GitHub trending fetch failed: ${res.status}`);
  const html = await res.text();

  // TODO: cheerio 등으로 견고하게 파싱. 아래는 자리표시용.
  // article.Box-row 단위로 repo, description, language, stars 추출.
  const repos = parseTrendingHtml(html);
  return repos;
}

/**
 * @param {string} _html
 * @returns {TrendingRepo[]}
 */
function parseTrendingHtml(_html) {
  // TODO: 구현. cheerio.load(_html) 후 'article.Box-row' 순회.
  return [];
}
