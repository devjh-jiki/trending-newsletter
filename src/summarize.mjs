// LLM으로 trending 레포를 한글 번역 + 한 단락 정리·Quick Start·직군 태그로 요약한다.
//
// 우선순위:
//   1) ANTHROPIC_API_KEY           → Anthropic(Claude) 공식 — 기본 사용
//   2) LLM_BASE_URL + LLM_API_KEY  → OpenAI 호환 엔드포인트
//   3) OPENAI_API_KEY              → OpenAI 공식
//   4) 키 없음                     → 원문 기반 fallback (파이프라인은 항상 동작)
//
// 환경변수 예:
//   LLM_BASE_URL=...
//   LLM_API_KEY=...
//   LLM_MODEL=...

/**
 * @typedef {import("./fetch-trending.mjs").TrendingRepo} TrendingRepo
 * @typedef {Object} Summary
 * @property {string} koDescription    - 한글 번역 설명
 * @property {string} overview         - 무엇인지/왜 떴는지/어디에 쓰면 좋은지 한 단락
 * @property {string} quickStart       - PoC용 설치·실행 셸 명령 (불가능하면 "")
 * @property {string[]} roles          - 적합 직군 id 배열 (ROLE_LABELS 키)
 * @property {string} recommendReason  - 해당 직군에 왜 좋은지 한 줄
 */

/** 직군 id → 표시 라벨. render 에서 직군별 추천 섹션에 사용한다. */
export const ROLE_LABELS = {
  frontend: "🧑‍💻 프론트엔드",
  backend: "⚙️ 백엔드/인프라",
  data: "📊 데이터/AI",
  founder: "🚀 창업자",
  pm: "📋 PM/기획",
  marketing: "📣 홍보/마케팅",
};

const SYSTEM_PROMPT = `너는 GitHub 트렌딩 레포를 한국어로 정리하는 에디터다.
각 레포에 대해 아래 JSON 형식으로만 응답한다. 과장/홍보성 표현은 쓰지 않고 사실 위주로 간결하게 쓴다.
{
  "koDescription": "레포 설명을 자연스러운 한국어로 1~2문장 번역",
  "overview": "이 레포가 무엇인지, 왜 주목받는지, 어떤 상황에 쓰면 좋은지 3~4문장 한 단락",
  "quickStart": "바로 PoC 해볼 수 있는 셸 명령 2~4줄 (예: git clone/npm i/실행). 책·강의·목록 모음처럼 실행할 게 없으면 빈 문자열",
  "roles": "이 레포를 실제로 써먹기 좋은 직군 배열. frontend/backend/data/founder/pm/marketing 중에서만 고르고, 억지로 채우지 말 것 (0~3개)",
  "recommendReason": "위 직군에게 왜 유용한지 한 줄 (roles 가 비면 빈 문자열)"
}
quickStart 는 README 를 못 본 상태이므로 확신할 수 있는 일반적인 명령만 쓴다.`;

/**
 * @param {TrendingRepo} repo
 * @returns {Promise<Summary>}
 */
export async function summarizeRepo(repo) {
  const userText = `레포: ${repo.repo}
언어: ${repo.language || "N/A"}
설명: ${repo.description || "(설명 없음)"}
별: ${repo.stars} (오늘 +${repo.starsToday})`;

  if (!hasLLM()) return fallbackSummary(repo);
  const text = await callLLM(SYSTEM_PROMPT, userText, { json: true });
  return normalizeSummary(parseJsonLoose(text), repo);
}

/**
 * LLM 응답을 Summary 스키마로 정규화한다. (필드 누락/타입 오류 방어)
 * @param {any} raw
 * @param {TrendingRepo} repo
 * @returns {Summary}
 */
function normalizeSummary(raw, repo) {
  const roles = Array.isArray(raw.roles)
    ? raw.roles.filter((r) => typeof r === "string" && r in ROLE_LABELS)
    : [];
  return {
    koDescription: str(raw.koDescription) || repo.description || "(설명 없음)",
    overview: str(raw.overview),
    quickStart: str(raw.quickStart),
    roles,
    recommendReason: roles.length ? str(raw.recommendReason) : "",
  };
}

/** @param {unknown} v @returns {string} */
function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

const TREND_PROMPT = `너는 GitHub 트렌딩 목록을 보고 "요즘 GitHub에서 주로 다뤄지는 흐름"을
한국어로 2~3문장으로 요약하는 애널리스트다. 개별 레포 나열이 아니라 공통된 주제·기술 흐름
(예: AI 에이전트, 로컬 LLM, 특정 언어/프레임워크 부상 등)을 짚는다. 과장 없이 담백하게 쓴다.
JSON 없이 평문으로만 답한다.`;

/**
 * 트렌딩 목록 전체를 보고 오늘의 흐름을 한 문단으로 요약한다.
 * @param {TrendingRepo[]} repos
 * @returns {Promise<string>}  실패/키없음 시 빈 문자열
 */
export async function summarizeTrend(repos) {
  if (!hasLLM() || repos.length === 0) return "";
  const list = repos
    .slice(0, 15)
    .map((r) => `- ${r.repo} (${r.language || "N/A"}): ${r.description || ""}`)
    .join("\n");
  try {
    const text = await callLLM(TREND_PROMPT, `오늘의 트렌딩 목록:\n${list}`, { json: false });
    return text.trim();
  } catch {
    return "";
  }
}

/** LLM 사용 가능 여부 */
function hasLLM() {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) ||
    process.env.OPENAI_API_KEY
  );
}

/**
 * 저수준 LLM 호출. 설정된 제공자를 골라 텍스트를 반환한다.
 * @param {string} system
 * @param {string} user
 * @param {{ json?: boolean }} [opts]
 * @returns {Promise<string>}
 */
async function callLLM(system, user, opts = {}) {
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(system, user);
  }
  if (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) {
    return callOpenAICompatible(system, user, {
      baseURL: process.env.LLM_BASE_URL.replace(/\/$/, ""),
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "default",
      json: opts.json,
    });
  }
  return callOpenAICompatible(system, user, {
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    json: opts.json,
  });
}

/** @param {string} system @param {string} user @returns {Promise<string>} */
async function callAnthropic(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // content 는 블록 배열이며 text 외 타입이 섞일 수 있다. text 블록만 모아서 합친다.
  const text = (data?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) {
    throw new Error(
      `Anthropic 응답에 text 블록 없음 (stop_reason=${data?.stop_reason}): ${JSON.stringify(data?.content)?.slice(0, 200)}`,
    );
  }
  return text;
}

/**
 * OpenAI 호환 Chat Completions 호출 (공식 OpenAI / 커스텀 엔드포인트 공용)
 * @param {string} system
 * @param {string} user
 * @param {{ baseURL: string, apiKey: string, model: string, json?: boolean }} cfg
 * @returns {Promise<string>}
 */
async function callOpenAICompatible(system, user, cfg) {
  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  // OpenAI 공식만 JSON 모드 지원. 커스텀 엔드포인트는 미지원일 수 있어 OpenAI일 때만.
  if (cfg.json && cfg.baseURL.includes("api.openai.com")) {
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
  return data?.choices?.[0]?.message?.content ?? "";
}

/** LLM 없을 때 fallback @param {TrendingRepo} repo @returns {Summary} */
export function fallbackSummary(repo) {
  return {
    koDescription: repo.description || "(설명 없음 — 번역 생략)",
    overview: "(LLM 키 없음 — 요약 생략)",
    quickStart: "",
    roles: [],
    recommendReason: "",
  };
}

/** 응답에서 JSON만 안전하게 추출. 실패 시 throw 해서 호출부가 실패로 처리하게 한다.
 * @param {string} text @returns {any} */
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
    throw new Error(`요약 JSON 파싱 실패: ${text.slice(0, 200)}`);
  }
}
