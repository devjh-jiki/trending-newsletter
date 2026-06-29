// 수집·요약된 레포 목록을 뉴스레터 Markdown 문자열로 렌더링한다.

/**
 * @typedef {import("./fetch-trending.mjs").TrendingRepo} TrendingRepo
 * @typedef {import("./summarize.mjs").Summary} Summary
 * @typedef {{ repo: TrendingRepo, summary: Summary }} Item
 */

/**
 * @param {Item[]} items
 * @param {{ date?: string, since?: string }} [opts]
 * @returns {string}
 */
export function renderNewsletter(items, opts = {}) {
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const since = opts.since || "daily";
  const sinceLabel = { daily: "오늘", weekly: "이번 주", monthly: "이번 달" }[since] || since;

  const lines = [];
  lines.push(`# GitHub Trending — ${date} (${sinceLabel})`);
  lines.push("");
  lines.push(
    "프론트엔드/개발자 / 프로덕트 창업자·PM / 홍보·마케팅 3가지 관점으로 정리했습니다.",
  );
  lines.push("");
  lines.push(`> 총 ${items.length}개 레포 · 출처: https://github.com/trending`);
  lines.push("");
  lines.push("---");
  lines.push("");

  items.forEach((item, i) => {
    const { repo, summary } = item;
    lines.push(`## ${i + 1}. [${repo.repo}](${repo.url})`);
    lines.push("");
    const meta = [
      repo.language ? `\`${repo.language}\`` : null,
      `⭐ ${repo.stars.toLocaleString()}`,
      repo.starsToday ? `(${sinceLabel} +${repo.starsToday.toLocaleString()})` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(meta);
    lines.push("");
    if (summary.koDescription) {
      lines.push(`> ${summary.koDescription}`);
      lines.push("");
    }
    lines.push(`- 🧑‍💻 **프론트엔드/개발자**: ${summary.developer}`);
    lines.push(`- 🚀 **창업자/PM**: ${summary.product}`);
    lines.push(`- 📣 **홍보/마케팅**: ${summary.marketing}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  lines.push("_이 뉴스레터는 자동 생성되었습니다._");
  lines.push("");
  return lines.join("\n");
}
