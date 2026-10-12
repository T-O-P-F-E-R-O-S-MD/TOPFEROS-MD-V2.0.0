"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                 VIEW ONCE SERVICE                ║
// ╚════════════════════════════════════════════════════╝

function unwrapMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  let current = message;

  for (let i = 0; i < 10; i++) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
      continue;
    }

    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
      continue;
    }

    return current;
  }

  return null;
}

function getViewOnceMessage(message) {
  const current = unwrapMessage(message);

  if (!current) return null;

  const wrappers = [
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension"
  ];

  for (const key of wrappers) {
    if (current[key]?.message) {
      return current[key].message;
    }
  }

  return null;
}

function getViewOnceMedia(message) {
  const content = getViewOnceMessage(message);

  if (!content) return null;

  const types = [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"],
    ["stickerMessage", "sticker"]
  ];

  for (const [key, type] of types) {
    if (content[key]) {
      return {
        type,
        message: content[key]
      };
    }
  }

  return null;
}

function getQuotedMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const root = unwrapMessage(message.message || message);

  if (!root) return null;

  const queue = [root];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();

    if (
      !current ||
      typeof current !== "object" ||
      visited.has(current)
    ) {
      continue;
    }

    visited.add(current);

    const quoted = current.contextInfo?.quotedMessage;

    if (quoted && typeof quoted === "object") {
      return quoted;
    }

    for (const [key, value] of Object.entries(current)) {
      if (
        key !== "contextInfo" &&
        value &&
        typeof value === "object"
      ) {
        queue.push(value);
      }
    }
  }

  return null;
}

async function vvvCommand(ctx) {
  if (ctx.isGroup) {
    await ctx.send("❌ Sèvi ak .vvv nan DM bot la.");
    return { success: false };
  }

  const quoted = getQuotedMessage(ctx.message);

  if (!quoted) {
    await ctx.send("❌ Mwen pa jwenn mesaj site a.");
    return { success: false };
  }

  const content = getViewOnceMessage(quoted);

  if (!content) {
    await ctx.send("❌ Mwen pa kapab konfime estrikti View Once mesaj sa a.");
    return { success: false };
  }

  const media = getViewOnceMedia(quoted);

  await ctx.send(
    [
      "╭━━〔 🦁 TOPFEROS MD 〕━━╮",
      "┃ 🔎 VIEW ONCE DETECTOR",
      "┃ 🔐 View Once: YES",
      `┃ 📁 Type: ${media?.type || "OTHER"}`,
      "╰━━━━━━━━━━━━━━━━━━━━━━╯",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n")
  );

  return {
    success: true,
    type: media?.type || "other"
  };
}

module.exports = {
  unwrapMessage,
  getViewOnceMessage,
  getViewOnceMedia,
  getQuotedMessage,
  vvvCommand,
  vv2Command
};