// 디스코드 Webhook 알림 공용 모듈.
// 여러 프로젝트(뉴스레터, 토스 매매 리포트, 향후 알람)에서 재사용한다.
// 의존성 없음 (Node 18+ 내장 fetch 사용).
//
// 사용 예:
//   import { sendDiscord, sendDiscordEmbed } from "./discord-notify.mjs";
//
//   await sendDiscord(process.env.DISCORD_WEBHOOK_NEWSLETTER, "오늘의 뉴스레터가 도착했습니다");
//
//   await sendDiscordEmbed(process.env.DISCORD_WEBHOOK_TOSS, {
//     title: "📈 토스 매매 리포트",
//     description: "오늘 3건 체결",
//     color: 0x2ecc71,
//     fields: [{ name: "수익률", value: "+1.2%", inline: true }],
//     url: "https://github.com/...",
//   });

const DISCORD_CONTENT_LIMIT = 2000; // 메시지 content 글자 제한

/**
 * 일반 텍스트 메시지를 디스코드 채널로 보낸다.
 * @param {string} webhookUrl
 * @param {string} content
 * @param {{ username?: string }} [opts]
 * @returns {Promise<void>}
 */
export async function sendDiscord(webhookUrl, content, opts = {}) {
  assertWebhook(webhookUrl);
  const text = String(content ?? "");
  // 2000자 초과 시 잘라서 보냄
  const safe = text.length > DISCORD_CONTENT_LIMIT
    ? text.slice(0, DISCORD_CONTENT_LIMIT - 1) + "…"
    : text;
  await post(webhookUrl, {
    content: safe,
    ...(opts.username ? { username: opts.username } : {}),
  });
}

/**
 * @typedef {Object} EmbedField
 * @property {string} name
 * @property {string} value
 * @property {boolean} [inline]
 *
 * @typedef {Object} Embed
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [url]
 * @property {number} [color]       - 정수 색상 (예: 0x5865F2)
 * @property {EmbedField[]} [fields]
 * @property {string} [timestamp]   - ISO8601, 생략 시 현재 시각
 * @property {{ text: string }} [footer]
 */

/**
 * 임베드(카드형) 메시지를 보낸다.
 * @param {string} webhookUrl
 * @param {Embed} embed
 * @param {{ username?: string, content?: string }} [opts]
 * @returns {Promise<void>}
 */
export async function sendDiscordEmbed(webhookUrl, embed, opts = {}) {
  assertWebhook(webhookUrl);
  const payload = {
    ...(opts.content ? { content: opts.content } : {}),
    ...(opts.username ? { username: opts.username } : {}),
    embeds: [
      {
        timestamp: embed.timestamp || new Date().toISOString(),
        ...embed,
      },
    ],
  };
  await post(webhookUrl, payload);
}

/** @param {string} webhookUrl @param {object} payload */
async function post(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  // 디스코드는 성공 시 204 No Content
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText} ${body}`);
  }
}

/** @param {string} webhookUrl */
function assertWebhook(webhookUrl) {
  if (!webhookUrl || !/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(webhookUrl)) {
    throw new Error("유효한 Discord webhook URL이 필요합니다 (DISCORD_WEBHOOK_* 환경변수 확인).");
  }
}
