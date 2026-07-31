# Common Role Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여러 직군에 추천된 레포를 `🌐 공통`에 한 번만 표시하고 단일 직군 레포만 각 직군 목록에 남긴다.

**Architecture:** 기존 `Summary.roles` 스키마와 LLM 프롬프트는 유지한다. `renderRoleRecommendations`가 유효 역할 ID를 중복 제거한 뒤 공통 추천과 단일 직군 추천을 결정하며, 공개 진입점인 `renderNewsletter`의 최종 Markdown으로 동작을 검증한다.

**Tech Stack:** Node.js ESM, 내장 `node:test`, 내장 `node:assert/strict`

## Global Constraints

- 유효한 `roles`가 2개 이상인 레포는 `🌐 공통` 목록에 한 번만 표시한다.
- 공통 목록으로 이동한 레포는 개별 직군 목록에서 제거한다.
- 유효한 `roles`가 정확히 1개인 레포만 해당 직군 목록에 표시한다.
- 유효한 역할이 없는 레포는 추천 섹션에 표시하지 않는다.
- `🌐 공통`은 개별 직군보다 먼저 표시한다.
- 레포 순서와 `recommendReason`은 유지한다.
- 기존 아카이브, LLM 스키마·프롬프트, 디스코드 출력은 변경하지 않는다.

---

### Task 1: 공통 추천 분류와 Markdown 출력

**Files:**
- Create: `test/render.test.mjs`
- Modify: `src/render.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `renderNewsletter(items, opts)`와 `ROLE_LABELS`
- Produces: 기존 `renderNewsletter(items, opts): string` 인터페이스는 그대로 유지하며, 직군별 추천 Markdown에 선택적인 `- **🌐 공통**` 목록을 추가한다.

- [ ] **Step 1: 다중 역할과 단일 역할 분류의 실패 테스트 작성**

`test/render.test.mjs`를 만들고 실제 `renderNewsletter` 출력을 검사한다.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { renderNewsletter } from "../src/render.mjs";

function item(name, roles, reason = `${name} 추천 이유`) {
  return {
    repo: {
      repo: `org/${name}`,
      url: `https://github.com/org/${name}`,
      language: "JavaScript",
      stars: 100,
      starsToday: 10,
      description: `${name} 설명`,
    },
    summary: {
      koDescription: `${name} 설명`,
      overview: `${name} 개요`,
      quickStart: "",
      roles,
      recommendReason: reason,
    },
  };
}

function recommendationSection(markdown) {
  return markdown.split("> 총", 1)[0];
}

test("여러 유효 직군의 레포는 공통에 한 번만 나오고 단일 직군 레포는 해당 직군에 남는다", () => {
  const markdown = renderNewsletter(
    [
      item("shared", ["frontend", "backend"]),
      item("frontend-only", ["frontend"]),
      item("unassigned", []),
    ],
    { date: "2026-07-31" },
  );
  const section = recommendationSection(markdown);

  assert.ok(section.indexOf("- **🌐 공통**") < section.indexOf("- **🧑‍💻 프론트엔드**"));
  assert.equal(section.match(/\[org\/shared\]/g)?.length, 1);
  assert.match(section, /- \*\*🌐 공통\*\*[\s\S]*\[org\/shared\]/);
  assert.match(section, /- \*\*🧑‍💻 프론트엔드\*\*[\s\S]*\[org\/frontend-only\]/);
  assert.doesNotMatch(section, /\[org\/unassigned\]/);
  assert.doesNotMatch(section, /- \*\*⚙️ 백엔드\/인프라\*\*/);
});
```

이 테스트가 잡는 회귀는 다중 역할 레포가 다시 개별 직군마다 반복되거나, 단일 역할 레포가 공통으로 잘못 이동하는 변경이다.

- [ ] **Step 2: 내장 테스트 실행 명령 추가**

`package.json`의 `scripts`를 다음처럼 갱신한다.

```json
"scripts": {
  "start": "node src/index.mjs",
  "test": "node --test"
}
```

- [ ] **Step 3: 테스트를 실행해 예상한 이유로 실패하는지 확인**

Run: `npm test -- test/render.test.mjs`

Expected: FAIL. 현재 출력에는 `🌐 공통`이 없고 `org/shared`가 프론트엔드와 백엔드에 두 번 나타난다.

- [ ] **Step 4: 최소 공통 분류 구현**

`src/render.mjs`의 `renderRoleRecommendations`에서 유효 역할을 중복 제거해 항목별로 한 번 계산한다.

```js
function renderRoleRecommendations(items) {
  const lines = [];
  const validRoleIds = new Set(Object.keys(ROLE_LABELS));
  const classified = items.map((it) => ({
    it,
    roles: [
      ...new Set(
        (Array.isArray(it.summary.roles) ? it.summary.roles : []).filter((role) =>
          validRoleIds.has(role),
        ),
      ),
    ],
  }));

  const commonPicks = classified.filter(({ roles }) => roles.length >= 2);
  if (commonPicks.length) {
    lines.push("- **🌐 공통**");
    for (const { it } of commonPicks) {
      const reason = it.summary.recommendReason ? ` — ${it.summary.recommendReason}` : "";
      lines.push(`  - [${it.repo.repo}](${it.repo.url})${reason}`);
    }
  }

  for (const [roleId, label] of Object.entries(ROLE_LABELS)) {
    const picks = classified.filter(({ roles }) => roles.length === 1 && roles[0] === roleId);
    if (picks.length === 0) continue;
    lines.push(`- **${label}**`);
    for (const { it } of picks) {
      const reason = it.summary.recommendReason ? ` — ${it.summary.recommendReason}` : "";
      lines.push(`  - [${it.repo.repo}](${it.repo.url})${reason}`);
    }
  }
  return lines;
}
```

- [ ] **Step 5: 첫 테스트가 통과하는지 확인**

Run: `npm test -- test/render.test.mjs`

Expected: 1 test passed, 0 failed.

- [ ] **Step 6: 중복·알 수 없는 역할 경계 조건의 실패 테스트 작성**

`test/render.test.mjs`에 다음 테스트를 추가한다.

```js
test("중복되거나 알 수 없는 역할은 공통 판정 개수를 늘리지 않는다", () => {
  const markdown = renderNewsletter(
    [
      item("duplicate", ["frontend", "frontend", "unknown"]),
      item("unknown-only", ["unknown"]),
    ],
    { date: "2026-07-31" },
  );
  const section = recommendationSection(markdown);

  assert.doesNotMatch(section, /- \*\*🌐 공통\*\*/);
  assert.equal(section.match(/\[org\/duplicate\]/g)?.length, 1);
  assert.match(section, /- \*\*🧑‍💻 프론트엔드\*\*[\s\S]*\[org\/duplicate\]/);
  assert.doesNotMatch(section, /\[org\/unknown-only\]/);
});
```

이 테스트가 잡는 회귀는 동일 역할의 중복 또는 잘못된 역할 ID가 역할 수를 부풀려 레포를 공통으로 이동시키는 변경이다. Step 4의 최소 구현에는 이미 경계 조건 처리가 포함되어 있으므로, 테스트가 즉시 통과하면 구현을 잠시 되돌린 상태에서 실패를 확인한 뒤 복원해 RED-GREEN 증거를 남긴다.

- [ ] **Step 7: 전체 테스트와 문법 검증**

Run: `npm test && node --check src/render.mjs && node --check test/render.test.mjs`

Expected: 모든 테스트 통과, 두 문법 검사 모두 exit code 0.

- [ ] **Step 8: 변경 범위 확인**

Run: `git diff --check && git status --short`

Expected: 공백 오류가 없고 `src/render.mjs`, `test/render.test.mjs`, `package.json`, 이 계획 문서만 구현 관련 변경으로 표시된다. 기존 `.idea/`, `.serena/`는 건드리지 않는다.

- [ ] **Step 9: 구현 커밋**

```bash
git add src/render.mjs test/render.test.mjs package.json docs/superpowers/plans/2026-07-31-common-role-recommendations.md
git commit -m "feat: 직군별 추천에 공통 섹션 추가"
```
