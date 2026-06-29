// 뉴스레터 생성 파이프라인 진입점.
// fetch → summarize(LLM, 없으면 fallback) → render markdown → archive 저장 → (선택) 디스코드 발송
//
// 환경변수:
//   LLM_BASE_URL/LLM_API_KEY/LLM_MODEL 또는 ANTHROPIC_API_KEY/OPENAI_API_KEY
//   SINCE     = daily | weekly | monthly   (기본 daily)
//   LANGUAGE  = 예: javascript, typescript  (기본 전체)
//   LIMIT     = 정수 (기본 10)
//   DISCORD_WEBHOOK_NEWSLETTER = 있으면 #newsletter 채널로 요약 발송
//   GITHUB_REPOSITORY = "owner/repo" (Actions 제공) → 아카이브 링크 생성용

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTrending } from "./fetch-trending.mjs";
import { summarizeRepo } from "./summarize.mjs";
import { renderNewsletter } from "./render.mjs";
import { sendDiscordEmbed } from "./discord-notify.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = join(__dirname, "..", "archive");

async function main() {
  const since = process.env.SINCE || "daily";
  const language = process.env.LANGUAGE || "";
  const limit = Number(process.env.LIMIT || 10);

  console.log(`[fetch] trending since=${since} language=${language || "all"} limit=${limit}`);
  const repos = await fetchTrending({ since, language, limit });
  console.log(`[fetch] ${repos.length} repos`);

  if (repos.length === 0) {
    console.warn("수집된 레포가 없습니다. trending 마크업이 바뀌었는지 확인하세요.");
    process.exit(1);
  }

  const hasLLM = !!(
    (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY
  );
  const llmLabel = process.env.LLM_BASE_URL
    ? `gateway(${process.env.LLM_MODEL || "claude-haiku-4-5"})`
    : process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "없음(fallback)";
  console.log(`[summarize] LLM ${llmLabel}`);

  const items = [];
  for (const repo of repos) {
    try {
      const summary = await summarizeRepo(repo);
      items.push({ repo, summary });
      console.log(`  ✓ ${repo.repo}`);
    } catch (err) {
      console.warn(`  ✗ ${repo.repo}: ${err.message}`);
      items.push({
        repo,
        summary: {
          koDescription: repo.description,
          frontend: "(요약 실패)",
          founder: "(요약 실패)",
          marketer: "(요약 실패)",
        },
      });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const md = renderNewsletter(items, { date, since });

  await mkdir(ARCHIVE_DIR, { recursive: true });
  const outPath = join(ARCHIVE_DIR, `${date}.md`);
  await writeFile(outPath, md, "utf8");
  console.log(`[done] ${outPath} (${md.length} bytes)`);

  // 디스코드 발송 (webhook 있을 때만)
  await maybeSendDiscord(items, date, since);
}

/**
 * 상위 레포 요약을 디스코드 #newsletter 채널로 보낸다.
 * @param {{repo:any,summary:any}[]} items
 * @param {string} date
 * @param {string} since
 */
async function maybeSendDiscord(items, date, since) {
  const webhook = process.env.DISCORD_WEBHOOK_NEWSLETTER;
  if (!webhook) {
    console.log("[discord] DISCORD_WEBHOOK_NEWSLETTER 없음 — 발송 생략");
    return;
  }

  const sinceLabel = { daily: "오늘", weekly: "이번 주", monthly: "이번 달" }[since] || since;
  const top = items.slice(0, 5);

  // embed 1개에 상위 5개를 필드로. 각 필드 value는 1024자 제한이라 잘라서 넣는다.
  const fields = top.map((it, i) => ({
    name: `${i + 1}. ${it.repo.repo} ${it.repo.language ? `(${it.repo.language})` : ""}`,
    value: clip(
      `${it.summary.koDescription}\n🧑‍💻 ${it.summary.frontend}\n[repo](${it.repo.url}) · ⭐ ${it.repo.stars.toLocaleString()}`,
      1024,
    ),
    inline: false,
  }));

  // 아카이브 링크 (Actions 환경이면 GITHUB_REPOSITORY 사용)
  const repoSlug = process.env.GITHUB_REPOSITORY || "devjh-jiki/trending-newsletter";
  const archiveUrl = `https://github.com/${repoSlug}/blob/main/archive/${date}.md`;

  try {
    await sendDiscordEmbed(webhook, {
      title: `📰 GitHub Trending — ${date} (${sinceLabel})`,
      description: `프론트엔드 / 창업자 / 마케터 관점 요약 · 총 ${items.length}개\n전체 보기: [archive](${archiveUrl})`,
      url: archiveUrl,
      color: 0x5865f2,
      fields,
      footer: { text: "trending-newsletter" },
    });
    console.log("[discord] 발송 완료");
  } catch (err) {
    console.warn(`[discord] 발송 실패: ${err.message}`);
  }
}

/** @param {string} s @param {number} max */
function clip(s, max) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
