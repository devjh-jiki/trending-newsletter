// 뉴스레터 생성 파이프라인 진입점 (골격).
// fetch → translate/summarize(LLM) → markdown 생성 → archive 저장 → (선택) 발송

import { fetchTrending } from "./fetch-trending.mjs";

async function main() {
  const repos = await fetchTrending({ since: "daily" });

  if (repos.length === 0) {
    console.warn("수집된 trending 레포가 없습니다. 파서 구현(parseTrendingHtml)이 필요합니다.");
  }

  // TODO:
  // 1) 각 repo 의 README/설명을 LLM 으로 한글 번역 + 3관점(프론트/창업/마케팅) 요약
  // 2) markdown 뉴스레터 문자열 생성
  // 3) archive/YYYY-MM-DD.md 로 저장
  // 4) (선택) Resend/Buttondown 으로 발송

  const today = new Date().toISOString().slice(0, 10);
  console.log(`[${today}] repos=${repos.length} (구현 필요)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
