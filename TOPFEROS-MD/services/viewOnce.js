"use strict";

// 🦁 TOPFEROS MD V2.0.0
// MEDIA SERVICE — VV2 / VVV

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const MEDIA_TYPES = [
  ["imageMessage", "image"],
  ["videoMessage", "video"],
  ["audioMessage", "audio"],
  ["documentMessage", "document"]
];

function unwrapMessage(input) {
  let content = input?.message || input;

  for (let i = 0; i < 10; i++) {
    if (!content || typeof content !== "object") {
      return null;
    }

    if (content.ephemeralMessage?.message) {
      content = content.ephemeralMessage.message;
      continue;
    }

    if (content.documentWithCaptionMessage?.message) {
      content = content.documentWithCaptionMessage.message;
      continue;
    }

    return content;
  }

  return null;
}

function getViewOnceMessage(input) {
  const content = unwrapMessage(input);

  if (!content) return null;

  const keys = [
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension"
  ];

  for (const key of keys) {
    if (content[key]?.message) {
      return content[key].message;
    }
  }

  return null;
}

function getViewOnceMedia(input) {
  const content = getViewOnceMessage(input);

  if (!content) return null;

  for (const [key, type] of MEDIA_TYPES) {
    if (content[key]) {
      return {
        type,
        message: content[key]
      };
    }
  }

  return null;
}

function getQuotedMessage(input) {
  const content = unwrapMessage(input);

  if (!content) return null;

  const queue = [content];
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

    if (current.contextInfo?.quotedMessage) {
      return {
        download: current.contextInfo.quotedMessage,
        text:
          current.contextInfo.quotedMessage.conversation ||
          current.contextInfo.quotedMessage
            .extendedTextMessage?.text ||
          ""
      };
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

function getNormalMedia(input) {
  const content = unwrapMessage(input);

  if (!content || getViewOnceMessage(content)) {
    return null;
  }

  for (const [key, type] of MEDIA_TYPES) {
    const item = content[key];

    if (item && !item.viewOnce) {
      return {
        type,
        message: item
      };
    }
  }

  return null;
}

async function downloadNormalMedia(media) {
  if (!media?.message || !media?.type) {
    throw new Error("Invalid media object");
  }

  const stream = await downloadContentFromMessage(
    media.message,
    media.type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function buildPayload(media, buffer) {
  const original = media.message;

  switch (media.type) {
    case "image":
      return {
        image: buffer,
        caption: original.caption || ""
      };

    case "video":
      return {
        video: buffer,
        caption: original.caption || "",
        mimetype: original.mimetype || "video/mp4"
      };

    case "audio":
      return {
        audio: buffer,
        mimetype: original.mimetype || "audio/ogg",
        ptt: Boolean(original.ptt)
      };

    case "document":
      return {
        document: buffer,
        mimetype:
          original.mimetype || "application/octet-stream",
        fileName: original.fileName || "TOPFEROS-MEDIA"
      };

    default:
      throw new Error("Unsupported media type");
  }
}

function normalizeJid(jid) {
  if (!jid || typeof jid !== "string") {
    return null;
  }

  return jid.replace(/:\d+@/, "@");
}

async function processMedia(ctx, sendBoth = false) {
  const { sock, message } = ctx;

  const chatId =
    ctx.jid ||
    message?.key?.remoteJid;

  const senderId = normalizeJid(
    ctx.sender ||
    message?.key?.participant ||
    (message?.key?.fromMe ? sock?.user?.id : chatId)
  );

  if (!sock || !chatId) {
    return { success: false };
  }

  const quoted = getQuotedMessage(message);

  if (!quoted) {
    await ctx.send(
      "❌ Reponn sou yon foto, videyo oswa odyo nòmal ak .vv2 oswa .vvv."
    );

    return { success: false };
  }

  if (getViewOnceMessage(quoted.download)) {
    await ctx.send(
      "🔒 Kòmand sa a pa telechaje ni transfere medya View Once."
    );

    return { success: false };
  }

  const media = getNormalMedia(quoted.download);

  if (!media) {
    await ctx.send(
      "❌ Mwen pa jwenn medya nòmal nan mesaj ou reponn lan."
    );

    return { success: false };
  }

  try {
    const buffer = await downloadNormalMedia(media);
    const payload = buildPayload(media, buffer);

    if (!sendBoth || !senderId || senderId === chatId) {
      await sock.sendMessage(chatId, payload);

      return { success: true };
    }

    await sock.sendMessage(senderId, payload);

    const sent = await sock.sendMessage(chatId, payload);

    if (sent?.key) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        await sock.sendMessage(chatId, {
          delete: sent.key
        });
      } catch (error) {
        console.error(
          "[TOPFEROS MD] Delete error:",
          error.message
        );
      }
    }

    return {
      success: true,
      dmSent: true,
      chatSent: true
    };
  } catch (error) {
    console.error(
      "[TOPFEROS MD MEDIA]",
      error.stack || error.message || error
    );

    await ctx.send("❌ Transfè medya a echwe.");

    return { success: false };
  }
}

async function vv2Command(ctx) {
  return processMedia(ctx, false);
}

async function vvvCommand(ctx) {
  return processMedia(ctx, true);
}

async function handleAutoViewOnce() {
  return {
    success: false,
    handled: false
  };
}

module.exports = {
  unwrapMessage,
  getViewOnceMessage,
  getViewOnceMedia,
  getQuotedMessage,
  getNormalMedia,
  vv2Command,
  vvvCommand,
  handleAutoViewOnce
};