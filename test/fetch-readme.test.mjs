import test from "node:test";
import assert from "node:assert/strict";
import { fetchRepoReadme } from "../src/fetch-readme.mjs";

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;
const originalWarn = console.warn;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
});

function repo() {
  return {
    repo: "acme/tool",
    owner: "acme",
    name: "tool",
  };
}

test("README 원문을 자르지 않고 반환하며 토큰이 있으면 인증한다", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  const fullReadme = "# title\n" + "a".repeat(20_000);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/acme/tool/readme");
    assert.equal(options.headers.Accept, "application/vnd.github.raw+json");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.headers["X-GitHub-Api-Version"], "2022-11-28");
    return new Response(fullReadme, { status: 200 });
  };

  assert.equal(await fetchRepoReadme(repo()), fullReadme);
});

test("토큰이 없으면 Authorization 없이 공개 README를 요청한다", async () => {
  delete process.env.GITHUB_TOKEN;
  globalThis.fetch = async (_url, options) => {
    assert.equal("Authorization" in options.headers, false);
    return new Response("# public", { status: 200 });
  };

  assert.equal(await fetchRepoReadme(repo()), "# public");
});

test("README가 없거나 조회가 실패하면 빈 문자열로 계속한다", async (t) => {
  await t.test("404", async () => {
    globalThis.fetch = async () => new Response("", { status: 404 });
    assert.equal(await fetchRepoReadme(repo()), "");
  });

  await t.test("GitHub API error", async () => {
    console.warn = () => {};
    globalThis.fetch = async () => new Response("rate limited", { status: 403 });
    assert.equal(await fetchRepoReadme(repo()), "");
  });

  await t.test("network error", async () => {
    console.warn = () => {};
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    assert.equal(await fetchRepoReadme(repo()), "");
  });
});
