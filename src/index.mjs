// 뉴스레터 생성 파이프라인 진입점.
// fetch → summarize(LLM, 없으면 fallback) → render markdown → archive 저장
//
// 환경변수:
//   ANTHROPIC_API_KEY 또는 OPENAI_API_KEY  (없으면 LLM 요약은 건너뛰고 원문만)
//   SINCE     = daily | weekly | monthly   (기본 daily)
//   LANGUAGE  = 예: javascript, typescript  (기본 전체)
//   LIMIT     = 정수 (기본 10)

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTrending } from "./fetch-trending.mjs";
import { summarizeRepo } from "./summarize.mjs";
import { renderNewsletter } from "./render.mjs";

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
