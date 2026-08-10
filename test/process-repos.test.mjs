import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRepos } from "../src/process-repos.mjs";

test("한 레포 분석이 실패해도 fallback 후 다음 레포를 계속 처리한다", async () => {
  const repos = [{ repo: "org/first" }, { repo: "org/second" }];
  const processed = [];
  const logger = { log() {}, warn() {} };

  const items = await summarizeRepos(repos, {
    fetchReadme: async (repo) => `README for ${repo.repo}`,
    summarize: async (repo, readme) => {
      processed.push({ repo: repo.repo, readme });
      if (repo.repo === "org/first") throw new Error("invalid JSON");
      return { summary: "second analysis" };
    },
    fallback: (repo) => ({ summary: `fallback for ${repo.repo}` }),
    logger,
  });

  assert.deepEqual(processed, [
    { repo: "org/first", readme: "README for org/first" },
    { repo: "org/second", readme: "README for org/second" },
  ]);
  assert.deepEqual(items, [
    { repo: repos[0], summary: { summary: "fallback for org/first" } },
    { repo: repos[1], summary: { summary: "second analysis" } },
  ]);
});
