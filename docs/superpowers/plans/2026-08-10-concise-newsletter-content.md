# Concise Newsletter Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace verbose repository analysis with a clearly separated core summary and 2–4 scannable use-case bullets while removing considerations everywhere.

**Architecture:** Keep full README ingestion unchanged, but tighten the LLM output contract to `koDescription`, `summary`, and `useCases: string[]`. Render the shared structured result as Markdown headers and bullets in archives, and as a compact top-five summary with at most two use cases per repository in Discord.

**Tech Stack:** Node.js 20 ESM, built-in `fetch`, built-in `node:test`, existing Anthropic/OpenAI-compatible clients, Markdown archive, Discord embed.

## Global Constraints

- Do not truncate README input or archive analysis output by character count.
- Remove `considerations` from prompts, normalized data, fallback data, archive output, Discord output, docs, and tests.
- Keep `useCases` to 2–4 concise `사용 주체 — 구체적인 활용 상황` items.
- Do not repeat the same fact across `koDescription`, `summary`, and `useCases`.
- Preserve Discord's 4,096-character limit, archive link, top-five policy, and external-backtick sanitization.
- Preserve Anthropic `max_tokens: 4096`, safe stop-reason handling, and repository-level fallback.
- Do not modify historical archive files.

---

### Task 1: Tighten the LLM summary schema

**Files:**
- Modify: `src/summarize.mjs`
- Modify: `test/summarize.test.mjs`

**Interfaces:**
- Consumes: full README and repository metadata through `summarizeRepo(repo, readme)`.
- Produces: `Summary = { koDescription: string, summary: string, useCases: string[] }`.

- [ ] **Step 1: Write failing schema-normalization tests**

```js
test("활용 사례는 문자열 배열만 정리해 최대 4개로 정규화한다", async () => {
  mockLlmResponse({
    koDescription: "한 줄 설명",
    summary: "핵심 요약",
    useCases: [" 개발팀 — 기능 구현 ", 42, "", "마케팅팀 — 캠페인", "운영팀 — 자동화", "보안팀 — 점검", "초과 항목"],
    considerations: "렌더링되면 안 됨",
  });

  assert.deepEqual(await summarizeRepo(repo(), "# readme"), {
    koDescription: "한 줄 설명",
    summary: "핵심 요약",
    useCases: ["개발팀 — 기능 구현", "마케팅팀 — 캠페인", "운영팀 — 자동화", "보안팀 — 점검"],
  });
});

test("활용 사례가 배열이 아니면 빈 배열로 정규화한다", async () => {
  mockLlmResponse({ koDescription: "설명", summary: "요약", useCases: "문자열" });
  assert.deepEqual((await summarizeRepo(repo(), "# readme")).useCases, []);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test test/summarize.test.mjs`

Expected: FAIL because `useCases` is currently normalized as a string and `considerations` remains in the result.

- [ ] **Step 3: Implement the concise prompt and schema**

Use this JSON contract:

```json
{
  "koDescription": "프로젝트의 정체성을 설명하는 한 문장",
  "summary": "해결 문제, 핵심 기능, 차별점을 담은 짧은 문단",
  "useCases": [
    "사용 주체 — 구체적인 활용 상황"
  ]
}
```

Tell the model to select only essential facts, avoid exhaustive installation/tool/constraint lists, avoid repetition, and return 2–4 use cases. Normalize by filtering non-strings and empty strings, trimming, and taking the first four. Make fallback return an empty array.

- [ ] **Step 4: Update existing Anthropic and fallback fixtures**

Replace string `useCases` fixtures with arrays and remove `considerations` expectations. Keep tests proving full README input, 4,096 output tokens, safe `max_tokens` errors, and private-content-free parse errors.

- [ ] **Step 5: Run the summarizer and full tests**

Run: `node --test test/summarize.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: renderer tests may fail only where they still expect the old schema; unrelated tests pass.

---

### Task 2: Render clear archive and Discord sections

**Files:**
- Modify: `src/render.mjs`
- Modify: `test/render.test.mjs`

**Interfaces:**
- Consumes: items with `summary.summary: string` and `summary.useCases: string[]`.
- Produces: archive Markdown with `### 🔎 핵심` and `### 🎯 활용 사례`; Discord embed with at most two use-case bullets per repository.

- [ ] **Step 1: Write failing archive-format tests**

```js
test("archive는 헤더로 핵심과 활용 사례를 구분하고 활용 사례를 불릿으로 표시한다", () => {
  const markdown = renderNewsletter([item("tool", {
    summary: "핵심 요약",
    useCases: ["개발팀 — 기능 구현", "운영팀 — 자동화"],
    considerations: "표시되면 안 됨",
  })]);

  assert.match(markdown, /### 🔎 핵심\n\n핵심 요약/);
  assert.match(markdown, /### 🎯 활용 사례\n\n- 개발팀 — 기능 구현\n- 운영팀 — 자동화/);
  assert.doesNotMatch(markdown, /무엇인가|어디에 쓰나|살펴볼 점|표시되면 안 됨/);
});
```

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `node --test test/render.test.mjs`

Expected: FAIL because the renderer uses bold old labels and treats `useCases` as a string.

- [ ] **Step 3: Implement archive headers and bullets**

Render non-empty `summary.summary` under `### 🔎 핵심`. Render non-empty `summary.useCases` under `### 🎯 활용 사례`, prefixing every item with `- `. Remove the considerations branch entirely.

- [ ] **Step 4: Add failing Discord use-case limit tests**

```js
test("Discord는 레포별 활용 사례를 최대 2개만 표시한다", () => {
  const embed = renderDiscordEmbed([
    item("tool", { useCases: ["첫째", "둘째", "셋째"] }),
  ], discordOptions);

  assert.match(embed.description, /- 첫째\n- 둘째/);
  assert.doesNotMatch(embed.description, /셋째/);
});
```

- [ ] **Step 5: Implement compact Discord rendering**

Sanitize the summary and the first two use cases with the existing backtick remover. Render the use cases below `**활용 사례**` as bullets. Keep body clipping and the reserved archive footer unchanged.

- [ ] **Step 6: Run renderer and full tests**

Run: `node --test test/render.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

---

### Task 3: Align documentation, verify, commit, push, and send

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-10-concise-newsletter-content.md`

**Interfaces:**
- Consumes: the completed concise schema and render behavior.
- Produces: current user documentation, a pushed `main`, and one verified Daily Discord delivery.

- [ ] **Step 1: Update README schema documentation**

Document `useCases` as 2–4 concise bullet items and remove `considerations`. Describe the archive labels as `핵심` and `활용 사례`.

- [ ] **Step 2: Run final verification**

Run: `npm test`

Expected: all tests PASS.

Run: `for file in src/*.mjs; do node --check "$file"; done`

Expected: every file exits successfully.

Run: `rg -n "considerations|무엇인가|어디에 쓰나|살펴볼 점" src README.md`

Expected: no production or user-documentation matches.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Commit only intended files**

```bash
git add src/summarize.mjs src/render.mjs test/summarize.test.mjs test/render.test.mjs README.md docs/superpowers/plans/2026-08-10-concise-newsletter-content.md
git commit -m "feat: 뉴스레터 분석을 핵심 중심으로 간소화"
```

Keep `.idea/` and `.serena/` untracked and unstaged.

- [ ] **Step 4: Push and run the Daily workflow**

```bash
git push origin main
gh workflow run daily.yml --ref main
```

Monitor the run to completion. Verify all repositories log `✓`, the archive contains no removed labels, and the log contains `[discord] 발송 완료`.
