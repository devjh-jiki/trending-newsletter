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
      summary: `${name} 무엇인지 상세 설명`,
      useCases: `${name} 활용처 상세 설명`,
      considerations: `${name} 도입 전 확인사항`,
      ...overrides,
    },
  };
}

test("archive는 상세 분석만 표시하고 추천과 Quick Start를 제거한다", () => {
  const markdown = renderNewsletter(
    [
      item("tool", {
        roles: ["backend"],
        recommendReason: "백엔드 추천 이유",
        quickStart: "npm install",
      }),
    ],
    { date: "2026-08-10", since: "daily", trend: "오늘의 흐름 본문" },
  );

  assert.match(markdown, /\*\*무엇인가\*\*[\s\S]*tool 무엇인지 상세 설명/);
  assert.match(markdown, /\*\*어디에 쓰나\*\*[\s\S]*tool 활용처 상세 설명/);
  assert.match(markdown, /\*\*살펴볼 점\*\*[\s\S]*tool 도입 전 확인사항/);
  assert.doesNotMatch(
    markdown,
    /직군별 추천|바로 써보기|백엔드 추천 이유|npm install/,
  );
});

test("고려사항이 없으면 살펴볼 점 라벨을 생략한다", () => {
  const markdown = renderNewsletter([item("tool", { considerations: "" })], {
    date: "2026-08-10",
  });

  assert.doesNotMatch(markdown, /살펴볼 점/);
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
  assert.match(embed.description, /first 무엇인지 상세 설명[\s\S]*first 활용처 상세 설명/);
  assert.match(embed.description, /전체 상세 분석 보기/);
  assert.doesNotMatch(embed.description, /직군별 추천|Quick Start|바로 써보기/);
  assert.doesNotMatch(embed.description, /org\/sixth/);
});

test("Discord 제한 안에서 archive 링크를 보존한다", () => {
  const longText = "상세 분석 ".repeat(1_000);
  const items = ["first", "second", "third", "fourth", "fifth"].map((name) =>
    item(name, { summary: longText, useCases: longText }),
  );

  const embed = renderDiscordEmbed(items, discordOptions);

  assert.ok(embed.description.length <= 4096);
  assert.match(embed.description, /전체 상세 분석 보기/);
  assert.ok(embed.description.endsWith(`(${discordOptions.archiveUrl})`));
});

test("Discord 외부 분석의 코드 포맷이 archive 링크를 감싸지 못하게 한다", () => {
  const codeFence = "```bash\nnpm install\n```";
  const embed = renderDiscordEmbed(
    [item("tool", { summary: codeFence.repeat(500), useCases: "`inline code`" })],
    { ...discordOptions, trend: "`weekly trend`" },
  );

  assert.doesNotMatch(embed.description, /`/);
  assert.ok(embed.description.endsWith(`(${discordOptions.archiveUrl})`));
});
