// LLM으로 trending 레포를 한글 번역 + 3관점(프론트엔드/창업자/마케터) 요약한다.
//
// 우선순위:
//   1) LLM_BASE_URL + LLM_API_KEY  → OpenAI 호환 게이트웨이(사내 hicare 등)
//   2) ANTHROPIC_API_KEY           → Anthropic 공식
//   3) OPENAI_API_KEY              → OpenAI 공식
//   4) 키 없음                     → 원문 기반 fallback (파이프라인은 항상 동작)
//
// 사내 게이트웨이 예:
//   LLM_BASE_URL=https://ai-api.hicare.net/v1
//   LLM_API_KEY=sk-...
//   LLM_MODEL=claude-haiku-4-5

/**
 * @typedef {import("./fetch-trending.mjs").TrendingRepo} TrendingRepo
 * @typedef {Object} Summary
 * @property {string} koDescription  - 한글 번역 설명
 * @property {string} frontend       - 프론트엔드 개발자 관점
 * @property {string} founder        - 프로덕트 창업자 관점
 * @property {string} marketer       - 블로거/마케터 관점
 */

const SYSTEM_PROMPT = `너는 GitHub 트렌딩 레포를 한국어로 정리하는 에디터다.
각 레포에 대해 아래 JSON 형식으로만 응답한다. 과장/홍보성 표현은 쓰지 않고 사실 위주로 간결하게 쓴다.
{
  "koDescription": "레포 설명을 자연스러운 한국어로 1~2문장 번역",
  "frontend": "프론트엔드 개발자가 실무에 어떻게 쓸 수 있는지 1문장",
  "founder": "프로덕트 창업자 관점에서 제품/시장 시사점 1문장",
  "marketer": "기술 블로거·마케터 관점에서 글감/트렌드 포인트 1문장"
}
해당 관점에서 별 의미가 없으면 "특별한 시사점 없음" 이라고 쓴다.`;

/**
 * @param {TrendingRepo} repo
 * @returns {Promise<Summary>}
 */
export async function summarizeRepo(repo) {
  const userText = `레포: ${repo.repo}
언어: ${repo.language || "N/A"}
설명: ${repo.description || "(설명 없음)"}
별: ${repo.stars} (오늘 +${repo.starsToday})`;

  if (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) {
    return callOpenAICompatible(userText, {
      baseURL: process.env.LLM_BASE_URL.replace(/\/$/, ""),
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "claude-haiku-4-5",
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(userText);
  }
  if (process.env.OPENAI_API_KEY) {
    return callOpenAICompatible(userText, {
      baseURL: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  }
  return fallbackSummary(repo);
}

/** @param {string} userText @returns {Promise<Summary>} */
async function callAnthropic(userText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";
  return parseJsonLoose(text);
}

/**
 * OpenAI 호환 Chat Completions API 호출 (공식 OpenAI / 사내 게이트웨이 공용)
 * @param {string} userText
 * @param {{ baseURL: string, apiKey: string, model: string }} cfg
 * @returns {Promise<Summary>}
 */
async function callOpenAICompatible(userText, cfg) {
  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userText },
    ],
  };
  // OpenAI 공식은 JSON 모드를 지원. 게이트웨이는 미지원일 수 있어 OpenAI일 때만 요청.
  if (cfg.baseURL.includes("api.openai.com")) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LLM API ${res.status} (${cfg.baseURL}): ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  return parseJsonLoose(text);
}

/** LLM 없을 때 fallback @param {TrendingRepo} repo @returns {Summary} */
function fallbackSummary(repo) {
  return {
    koDescription: repo.description || "(설명 없음 — 번역 생략)",
    frontend: "(LLM 키 없음 — 요약 생략)",
    founder: "(LLM 키 없음 — 요약 생략)",
    marketer: "(LLM 키 없음 — 요약 생략)",
  };
}

/** 응답에서 JSON만 안전하게 추출 @param {string} text @returns {Summary} */
function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    return {
      koDescription: text.slice(0, 200) || "(요약 파싱 실패)",
      frontend: "(파싱 실패)",
      founder: "(파싱 실패)",
      marketer: "(파싱 실패)",
    };
  }
}
