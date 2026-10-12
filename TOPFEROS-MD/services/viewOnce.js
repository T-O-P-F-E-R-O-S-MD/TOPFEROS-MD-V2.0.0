
"use strict";

// TOPFEROS MD V2.0.0 — View Once Service

function unwrapMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  let current = message;

  for (let i = 0; i < 10; i += 1) {
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
    const wrapped = current[key];

    if (
      wrapped?.message &&
      typeof wrapped.message === "object"
    ) {
      return wrapped.message;
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

  while (queue.length > 0) {
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

async function vv2Command(ctx) {
  const quoted = getQuotedMessage(ctx?.message);

  if (!quoted) {
    await ctx?.send?.(
      "❌ Mwen pa jwenn mesaj ou site a. Reponn mesaj la avèk .vv2."
    );

    return {
      success: false,
      reason: "quoted-message-not-found"
    };
  }

  const media = getViewOnceMedia(quoted);

  if (!media) {
    await ctx?.send?.(
      "❌ Mwen pa kapab konfime estrikti View Once mesaj sa a."
    );

    return {
      success: false,
      reason: "not-view-once"
    };
  }

  await ctx?.send?.([
    "╭━━〔 🦁 TOPFEROS MD 〕━━╮",
    "┃ 🔎 VIEW ONCE DETECTED",
    "┃ 🔐 Kontni an rete pwoteje",
    `┃ 📁 Kalite: ${media.type}`,
    "╰━━━━━━━━━━━━━━━━━━━━━━╯",
    "🦁 TECH BY TOPFEROS MD 🐑"
  ].join("\n"));

  return {
    success: true,
    type: media.type,
    inspected: true
  };
}

async function vvvCommand(ctx) {
  if (ctx?.isGroup) {
    await ctx?.send?.(
      "❌ Sèvi ak .vvv nan DM bot la."
    );

    return {
      success: false,
      reason: "group-chat-not-supported"
    };
  }

  return vv2Command(ctx);
}

async function handleAutoViewOnce(_sock, message) {
  const media = getViewOnceMedia(
    message?.message || message
  );

  if (!media) {
    return {
      success: false,
      ignored: true,
      reason: "not-view-once"
    };
  }

  // Kite medya View Once la entak.
  // Pa telechaje oswa redistribye li otomatikman.
  return {
    success: false,
    ignored: true,
    reason: "view-once-media-left-untouched",
    type: media.type
  };
}
async function handleAutoViewOnce(sock, message) {
  return {
    success: false,
    handled: false
  };
}

module.exports = {
  unwrapMessage,
  vv2Command,
  vvvCommand,
  handleAutoViewOnce,
  getViewOnceMessage,
  getViewOnceMedia,
  getQuotedMessage
};
