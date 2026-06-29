// GitHub Trending 수집.
// 공식 API가 없으므로 trending HTML을 파싱한다. 의존성 없이 동작하도록
// 정규식 기반으로 구현했다. 마크업이 바뀌면 이 파일의 셀렉터를 갱신할 것.

/**
 * @typedef {Object} TrendingRepo
 * @property {string} repo         - "owner/name"
 * @property {string} owner
 * @property {string} name
 * @property {string} url
 * @property {string} description
 * @property {string} language
 * @property {number} stars        - 누적 별 수
 * @property {number} starsToday   - 기간 내 별 증가
 */

const TRENDING_BASE = "https://github.com/trending";

/**
 * GitHub Trending 페이지를 가져와 파싱한다.
 * @param {{ since?: "daily"|"weekly"|"monthly", language?: string, limit?: number }} [opts]
 * @returns {Promise<TrendingRepo[]>}
 */
export async function fetchTrending(opts = {}) {
  const { since = "daily", language = "", limit = 25 } = opts;
  const url = `${TRENDING_BASE}/${encodeURIComponent(language)}?since=${since}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "trending-newsletter (+https://github.com/devjh-jiki/trending-newsletter)",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub trending fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  return parseTrendingHtml(html).slice(0, limit);
}

/**
 * Trending HTML에서 레포 목록을 추출한다.
 * @param {string} html
 * @returns {TrendingRepo[]}
 */
export function parseTrendingHtml(html) {
  /** @type {TrendingRepo[]} */
  const repos = [];
  const articleRe = /<article class="Box-row">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[1];

    // repo: h2 안 첫 a 태그의 href="/owner/name"
    const hrefMatch = block.match(/<h2[^>]*>[\s\S]*?href="\/([^"/]+)\/([^"]+)"/);
    if (!hrefMatch) continue;
    const owner = decodeEntities(hrefMatch[1]);
    const name = decodeEntities(hrefMatch[2]);
    const repo = `${owner}/${name}`;

    // description: <p class="col-9 ...">
    const descMatch = block.match(/<p class="col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const description = descMatch ? cleanText(descMatch[1]) : "";

    // language
    const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</);
    const langInner = langMatch ? langMatch[1].trim() : "";
    const language = decodeEntities(langInner);

    // stars total: /stargazers"> ... 숫자
    const starsMatch = block.match(/\/stargazers"[\s\S]*?<\/svg>\s*([\d,]+)/);
    const stars = starsMatch ? toNumber(starsMatch[1]) : 0;

    // stars in period: "1,180 stars today" / "x stars this week" 등
    const todayMatch = block.match(/([\d,]+)\s*stars\s+(today|this week|this month)/);
    const starsToday = todayMatch ? toNumber(todayMatch[1]) : 0;

    repos.push({
      repo,
      owner,
      name,
      url: `https://github.com/${repo}`,
      description,
      language,
      stars,
      starsToday,
    });
  }
  return repos;
}

/** @param {string} s */
function toNumber(s) {
  return Number(String(s).replace(/,/g, "")) || 0;
}

/** HTML 태그 제거 + 공백 정리 @param {string} s */
function cleanText(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** 기본 HTML 엔티티 디코드 @param {string} s */
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
