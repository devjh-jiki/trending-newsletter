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

test("여러 유효 직군의 레포는 공통에 한 번만 순서대로 나오고 단일 직군 레포는 해당 직군에 남는다", () => {
  let markdown;
  assert.doesNotThrow(() => {
    markdown = renderNewsletter(
      [
        item("shared-first", ["frontend", "backend"], "첫 번째 공통 추천 이유"),
        item("shared-second", ["frontend", "backend"], "두 번째 공통 추천 이유"),
        item("frontend-only", ["frontend"]),
        item("unassigned", []),
        item("roles-undefined", undefined),
        item("roles-not-array", "frontend"),
      ],
      { date: "2026-07-31" },
    );
  });
  const section = recommendationSection(markdown);

  assert.ok(section.indexOf("- **🌐 공통**") < section.indexOf("- **🧑‍💻 프론트엔드**"));
  assert.equal(section.match(/\[org\/shared-first\]/g)?.length, 1);
  assert.equal(section.match(/\[org\/shared-second\]/g)?.length, 1);
  assert.ok(section.indexOf("[org/shared-first]") < section.indexOf("[org/shared-second]"));
  assert.match(
    section,
    /- \*\*🌐 공통\*\*\n  - \[org\/shared-first\]\(https:\/\/github\.com\/org\/shared-first\) — 첫 번째 공통 추천 이유\n  - \[org\/shared-second\]\(https:\/\/github\.com\/org\/shared-second\) — 두 번째 공통 추천 이유/,
  );
  assert.match(section, /- \*\*🧑‍💻 프론트엔드\*\*[\s\S]*\[org\/frontend-only\]/);
  assert.doesNotMatch(section, /\[org\/unassigned\]/);
  assert.doesNotMatch(section, /\[org\/roles-undefined\]/);
  assert.doesNotMatch(section, /\[org\/roles-not-array\]/);
  assert.doesNotMatch(section, /- \*\*⚙️ 백엔드\/인프라\*\*/);
});

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
