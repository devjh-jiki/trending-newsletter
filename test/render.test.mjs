import test from "node:test";
import assert from "node:assert/strict";
import { renderDiscordEmbed, renderNewsletter } from "../src/render.mjs";

function item(name = "tool", overrides = {}) {
  return {
    repo: {
      repo: `org/${name}`,
      url: `https://github.com/org/${name}`,
      language: "JavaScript",
      stars: 100,
      starsToday: 10,
      description: `${name} description`,
    },
    summary: {
      koDescription: `${name} 핵심 설명`,
      summary: `${name} 핵심 요약`,
      useCases: [`${name} 개발팀 — 기능 구현`, `${name} 운영팀 — 자동화`],
      ...overrides,
    },
  };
}

test("archive는 헤더로 핵심과 활용 사례를 구분하고 활용 사례를 불릿으로 표시한다", () => {
  const markdown = renderNewsletter(
    [
      item("tool", {
        roles: ["backend"],
        recommendReason: "백엔드 추천 이유",
        quickStart: "npm install",
        considerations: "표시되면 안 됨",
      }),
    ],
    { date: "2026-08-10", since: "daily", trend: "오늘의 흐름 본문" },
  );

  assert.match(markdown, /### 🔎 핵심\n\ntool 핵심 요약/);
  assert.match(
    markdown,
    /### 🎯 활용 사례\n\n- tool 개발팀 — 기능 구현\n- tool 운영팀 — 자동화/,
  );
  assert.doesNotMatch(
    markdown,
    /무엇인가|어디에 쓰나|살펴볼 점|직군별 추천|바로 써보기|백엔드 추천 이유|npm install|표시되면 안 됨/,
  );
});

test("핵심이나 활용 사례가 비어 있으면 해당 섹션을 생략한다", () => {
  const markdown = renderNewsletter([item("tool", { summary: "", useCases: [] })], {
    date: "2026-08-10",
  });

  assert.doesNotMatch(markdown, /### 🔎 핵심|### 🎯 활용 사례/);
});

test("daily와 weekly 제목 및 흐름 라벨을 유지한다", () => {
  const daily = renderNewsletter([item()], {
    date: "2026-08-10",
    since: "daily",
    trend: "daily trend",
  });
  const weekly = renderNewsletter([item()], {
    date: "2026-08-10",
    since: "weekly",
    trend: "weekly trend",
  });

  assert.match(daily, /^# GitHub Trending\(2026-08-10\)/);
  assert.match(daily, /## 📊 오늘의 흐름/);
  assert.match(weekly, /^# GitHub Weekly Trending\(2026-08-10\)/);
  assert.match(weekly, /## 📊 이번 주의 흐름/);
});

const discordOptions = {
  date: "2026-08-10",
  since: "weekly",
  trend: "이번 주의 흐름 본문",
  archiveUrl: "https://github.com/acme/news/blob/main/archive/weekly/2026-08-10.md",
};

test("Discord는 상위 5개 상세 분석과 전체 분석 링크를 표시한다", () => {
  const items = ["first", "second", "third", "fourth", "fifth", "sixth"].map((name) =>
    item(name),
  );

  const embed = renderDiscordEmbed(items, discordOptions);

  assert.match(embed.title, /GitHub Weekly/);
  assert.equal(embed.url, discordOptions.archiveUrl);
  assert.match(embed.description, /이번 주의 흐름 본문/);
  assert.match(embed.description, /first 핵심 요약[\s\S]*- first 개발팀 — 기능 구현/);
  assert.match(embed.description, /전체 상세 분석 보기/);
  assert.doesNotMatch(embed.description, /직군별 추천|Quick Start|바로 써보기/);
  assert.doesNotMatch(embed.description, /org\/sixth/);
});

test("Discord 제한 안에서 archive 링크를 보존한다", () => {
  const longText = "상세 분석 ".repeat(1_000);
  const items = ["first", "second", "third", "fourth", "fifth"].map((name) =>
    item(name, { summary: longText, useCases: [longText] }),
  );

  const embed = renderDiscordEmbed(items, discordOptions);

  assert.ok(embed.description.length <= 4096);
  assert.match(embed.description, /전체 상세 분석 보기/);
  assert.ok(embed.description.endsWith(`(${discordOptions.archiveUrl})`));
});

test("Discord 외부 분석의 코드 포맷이 archive 링크를 감싸지 못하게 한다", () => {
  const codeFence = "```bash\nnpm install\n```";
  const embed = renderDiscordEmbed(
    [item("tool", { summary: codeFence.repeat(500), useCases: ["`inline code`"] })],
    { ...discordOptions, trend: "`weekly trend`" },
  );

  assert.doesNotMatch(embed.description, /`/);
  assert.ok(embed.description.endsWith(`(${discordOptions.archiveUrl})`));
});

test("Discord는 레포별 활용 사례를 최대 2개만 표시한다", () => {
  const embed = renderDiscordEmbed(
    [item("tool", { useCases: ["첫째", "둘째", "셋째"] })],
    discordOptions,
  );

  assert.match(embed.description, /\*\*활용 사례\*\*\n- 첫째\n- 둘째/);
  assert.doesNotMatch(embed.description, /셋째/);
});
