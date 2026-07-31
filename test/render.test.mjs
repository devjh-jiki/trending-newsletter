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
