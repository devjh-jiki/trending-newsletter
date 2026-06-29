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
import { summarizeRepo, summarizeTrend } from "./summarize.mjs";
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

  const llmLabel = process.env.LLM_BASE_URL
    ? `llm(${process.env.LLM_MODEL || "default"})`
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
          developer: "(요약 실패)",
          product: "(요약 실패)",
          marketing: "(요약 실패)",
        },
      });
    }
  }

  // 오늘의 전체 트렌드 한 문단 요약 (최상단용)
  const trend = await summarizeTrend(repos);
  if (trend) console.log(`[trend] ${trend.slice(0, 60)}…`);

  const date = new Date().toISOString().slice(0, 10);
  const md = renderNewsletter(items, { date, since, trend });

  await mkdir(ARCHIVE_DIR, { recursive: true });
  const outPath = join(ARCHIVE_DIR, `${date}.md`);
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

  const top = items.slice(0, 5);

  // 아카이브 링크 (Actions 환경이면 GITHUB_REPOSITORY 사용)
  const repoSlug = process.env.GITHUB_REPOSITORY || "devjh-jiki/trending-newsletter";
  const archiveUrl = `https://github.com/${repoSlug}/blob/main/archive/${date}.md`;

  // 핵심만: 레포당 한 줄 (이름·언어·⭐ + 한 줄 설명). 자세한 3관점은 archive 에.
  const list = top
    .map((it, i) => {
      const lang = it.repo.language ? `(${it.repo.language})` : "";
      const desc = clip(it.summary.koDescription, 100);
      return `**${i + 1}. [${it.repo.repo}](${it.repo.url})${lang} ⭐${it.repo.stars.toLocaleString()}**\n${desc}`;
    })
    .join("\n\n");

  const description = clip(
    `${trend ? `📊 **오늘의 흐름**\n${trend}\n\n` : ""}${list}\n\n📄 [자세히 보기 (전체 ${items.length}개 · 3관점 요약)](${archiveUrl})`,
    4096, // embed description 한도
  );

  try {
    await sendDiscordEmbed(webhook, {
      title: `📰 GitHub Trending(${date})`,
      url: archiveUrl,
      color: 0x5865f2,
      description,
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
