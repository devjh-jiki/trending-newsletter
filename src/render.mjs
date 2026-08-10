// 수집·요약된 레포 목록을 뉴스레터 Markdown 문자열로 렌더링한다.

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
    if (summary.summary) {
      lines.push("**무엇인가**");
      lines.push("");
      lines.push(summary.summary);
      lines.push("");
    }
    if (summary.useCases) {
      lines.push("**어디에 쓰나**");
      lines.push("");
      lines.push(summary.useCases);
      lines.push("");
    }
    if (summary.considerations) {
      lines.push("**살펴볼 점**");
      lines.push("");
      lines.push(summary.considerations);
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
 * Discord embed 한도에 맞춰 상위 5개 레포의 상세 분석을 렌더링한다.
 * @param {Item[]} items
 * @param {{ date: string, since?: string, trend?: string, archiveUrl: string }} opts
 * @returns {{ title: string, url: string, color: number, description: string, footer: { text: string } }}
 */
export function renderDiscordEmbed(items, opts) {
  const weekly = opts.since === "weekly";
  const sections = [];
  if (opts.trend) {
    sections.push(
      `📊 **${weekly ? "이번 주" : "오늘"}의 흐름**\n${plainDiscordText(opts.trend)}`,
    );
  }

  const list = items
    .slice(0, 5)
    .map((item, index) => {
      const lang = item.repo.language ? `(${item.repo.language})` : "";
      const lines = [
        `**${index + 1}. [${item.repo.repo}](${item.repo.url})${lang} ⭐${item.repo.stars.toLocaleString()}**`,
      ];
      if (item.summary.summary) lines.push(plainDiscordText(item.summary.summary));
      if (item.summary.useCases) {
        lines.push(`**어디에 쓰나** ${plainDiscordText(item.summary.useCases)}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
  if (list) sections.push(list);

  const body = sections.join("\n\n");
  const archive = `📄 [전체 상세 분석 보기 (전체 ${items.length}개)](${opts.archiveUrl})`;
  const footer = `${body ? "\n\n" : ""}${archive}`;
  const description = `${clip(body, 4096 - footer.length)}${footer}`;

  return {
    title: `${weekly ? "📆 GitHub Weekly" : "📰 GitHub"} Trending(${opts.date})`,
    url: opts.archiveUrl,
    color: 0x5865f2,
    description,
    footer: { text: "trending-newsletter" },
  };
}

/** @param {string} text @param {number} max */
function clip(text, max) {
  if (text.length <= max) return text;
  if (max <= 1) return "…".slice(0, Math.max(0, max));
  return `${text.slice(0, max - 1)}…`;
}

/** 외부 분석의 코드 포맷이 뒤따르는 archive 링크를 감싸지 않게 한다. @param {string} text */
function plainDiscordText(text) {
  return text.replace(/`/g, "");
}
