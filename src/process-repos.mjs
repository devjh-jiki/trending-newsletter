// 각 레포의 README 조회와 LLM 분석을 순차 처리하고 실패를 레포 단위로 격리한다.

import { fetchRepoReadme } from "./fetch-readme.mjs";
import { fallbackSummary, summarizeRepo } from "./summarize.mjs";

/**
 * @typedef {import("./fetch-trending.mjs").TrendingRepo} TrendingRepo
 * @typedef {import("./summarize.mjs").Summary} Summary
 * @typedef {{ repo: TrendingRepo, summary: Summary }} Item
 */

/**
 * @param {TrendingRepo[]} repos
 * @param {{
 *   fetchReadme?: typeof fetchRepoReadme,
 *   summarize?: typeof summarizeRepo,
 *   fallback?: typeof fallbackSummary,
 *   logger?: Pick<Console, "log" | "warn">
 * }} [deps]
 * @returns {Promise<Item[]>}
 */
export async function summarizeRepos(repos, deps = {}) {
  const fetchReadme = deps.fetchReadme || fetchRepoReadme;
  const summarize = deps.summarize || summarizeRepo;
  const fallback = deps.fallback || fallbackSummary;
  const logger = deps.logger || console;
  const items = [];

  for (const repo of repos) {
    try {
      const readme = await fetchReadme(repo);
      const summary = await summarize(repo, readme);
      items.push({ repo, summary });
      logger.log(`  ✓ ${repo.repo}`);
    } catch {
      logger.warn(`  ✗ ${repo.repo}: 요약 실패 — fallback 사용`);
      items.push({ repo, summary: fallback(repo) });
    }
  }

  return items;
}
