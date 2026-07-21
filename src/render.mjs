// 수집·요약된 레포 목록을 뉴스레터 Markdown 문자열로 렌더링한다.

import { ROLE_LABELS } from "./summarize.mjs";

/**
 * @typedef {import("./fetch-trending.mjs").TrendingRepo} TrendingRepo
 * @typedef {import("./summarize.mjs").Summary} Summary
 * @typedef {{ repo: TrendingRepo, summary: Summary }} Item
 */

/**
 * @param {Item[]} items
 * @param {{ date?: string, since?: string, trend?: string }} [opts]
 * @returns {string}
 */
export function renderNewsletter(items, opts = {}) {
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const weekly = opts.since === "weekly";

  const lines = [];
  lines.push(`# GitHub ${weekly ? "Weekly " : ""}Trending(${date})`);
  lines.push("");
  if (opts.trend) {
    lines.push(`## 📊 ${weekly ? "이번 주" : "오늘"}의 흐름`);
    lines.push("");
    lines.push(opts.trend);
    lines.push("");
  }

  const recommend = renderRoleRecommendations(items);
  if (recommend.length) {
    lines.push("## 👥 직군별 추천");
    lines.push("");
    lines.push(...recommend);
    lines.push("");
  }

  lines.push(`> 총 ${items.length}개 레포 · 출처: https://github.com/trending`);
  lines.push("");
  lines.push("---");
  lines.push("");

  items.forEach((item, i) => {
    const { repo, summary } = item;
    const lang = repo.language ? `(${repo.language})` : "";
    const today = repo.starsToday ? ` (+${repo.starsToday.toLocaleString()})` : "";
    lines.push(`## ${i + 1}. [${repo.repo}](${repo.url})${lang} ⭐${repo.stars.toLocaleString()}${today}`);
    lines.push("");
    if (summary.koDescription) {
      lines.push(`> ${summary.koDescription}`);
      lines.push("");
    }
    if (summary.overview) {
      lines.push(summary.overview);
      lines.push("");
    }
    if (summary.quickStart) {
      lines.push("**⚡ 바로 써보기**");
      lines.push("");
      lines.push("```bash");
      lines.push(summary.quickStart);
      lines.push("```");
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  });

  lines.push("_이 뉴스레터는 자동 생성되었습니다._");
  lines.push("");
  return lines.join("\n");
}

/**
 * 각 레포의 roles 태그를 직군 기준으로 역집계해 추천 목록을 만든다.
 * 걸리는 레포가 없는 직군은 생략한다.
 * @param {Item[]} items
 * @returns {string[]} markdown lines
 */
function renderRoleRecommendations(items) {
  const lines = [];
  for (const [roleId, label] of Object.entries(ROLE_LABELS)) {
    const picks = items.filter((it) => it.summary.roles?.includes(roleId));
    if (picks.length === 0) continue;
    lines.push(`- **${label}**`);
    for (const it of picks) {
      const reason = it.summary.recommendReason ? ` — ${it.summary.recommendReason}` : "";
      lines.push(`  - [${it.repo.repo}](${it.repo.url})${reason}`);
    }
  }
  return lines;
}
