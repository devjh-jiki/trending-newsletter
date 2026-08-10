// 뉴스레터 생성 파이프라인 진입점.
// fetch → summarize(LLM, 없으면 fallback) → render markdown → archive 저장 → (선택) 디스코드 발송
//
// 환경변수:
//   ANTHROPIC_API_KEY(+ANTHROPIC_MODEL) 우선, 없으면 LLM_BASE_URL/LLM_API_KEY/LLM_MODEL 또는 OPENAI_API_KEY
//   GITHUB_TOKEN = 있으면 README 조회 인증에 사용 (Actions 내장 토큰 권장)
//   SINCE     = daily | weekly | monthly   (기본 daily)
//   LANGUAGE  = 예: javascript, typescript  (기본 전체)
//   LIMIT     = 정수 (기본 10)
//   DISCORD_WEBHOOK_NEWSLETTER = 있으면 #newsletter 채널로 요약 발송
//   GITHUB_REPOSITORY = "owner/repo" (Actions 제공) → 아카이브 링크 생성용

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTrending } from "./fetch-trending.mjs";
import { summarizeRepos } from "./process-repos.mjs";
import { summarizeTrend } from "./summarize.mjs";
import { renderDiscordEmbed, renderNewsletter } from "./render.mjs";
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

  const llmLabel = process.env.ANTHROPIC_API_KEY
    ? `anthropic(${process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"})`
    : process.env.LLM_BASE_URL
      ? `llm(${process.env.LLM_MODEL || "default"})`
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "없음(fallback)";
  console.log(`[summarize] LLM ${llmLabel}`);

  const items = await summarizeRepos(repos);

  // 오늘의 전체 트렌드 한 문단 요약 (최상단용)
  const trend = await summarizeTrend(repos);
  if (trend) console.log(`[trend] ${trend.slice(0, 60)}…`);

  const date = new Date().toISOString().slice(0, 10);
  const md = renderNewsletter(items, { date, since, trend });

  // weekly 는 archive/weekly/ 아래로 분리 저장한다.
  const outDir = since === "weekly" ? join(ARCHIVE_DIR, "weekly") : ARCHIVE_DIR;
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${date}.md`);
  await writeFile(outPath, md, "utf8");
  console.log(`[done] ${outPath} (${md.length} bytes)`);

  // 디스코드 발송 (webhook 있을 때만)
  await maybeSendDiscord(items, date, since, trend);
}

/**
 * 상위 레포 요약을 디스코드 #newsletter 채널로 보낸다.
 * @param {{repo:any,summary:any}[]} items
 * @param {string} date
 * @param {string} since
 * @param {string} [trend]
 */
async function maybeSendDiscord(items, date, since, trend = "") {
  const webhook = process.env.DISCORD_WEBHOOK_NEWSLETTER;
  if (!webhook) {
    console.log("[discord] DISCORD_WEBHOOK_NEWSLETTER 없음 — 발송 생략");
    return;
  }

  const weekly = since === "weekly";

  // 아카이브 링크 (Actions 환경이면 GITHUB_REPOSITORY 사용)
  const repoSlug = process.env.GITHUB_REPOSITORY || "devjh-jiki/trending-newsletter";
  const archivePath = weekly ? `archive/weekly/${date}.md` : `archive/${date}.md`;
  const archiveUrl = `https://github.com/${repoSlug}/blob/main/${archivePath}`;

  try {
    const embed = renderDiscordEmbed(items, { date, since, trend, archiveUrl });
    await sendDiscordEmbed(webhook, embed);
    console.log("[discord] 발송 완료");
  } catch (err) {
    console.warn(`[discord] 발송 실패: ${err.message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
