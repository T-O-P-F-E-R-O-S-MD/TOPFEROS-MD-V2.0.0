
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// MEDIA SERVICE — TECH BY TOPFEROS MD

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

function unwrapMessage(message) {
  let current = message?.message || message;

  for (let i = 0; i < 10; i++) {
    if (!current || typeof current !== "object") {
      return null;
    }

    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (
      current.documentWithCaptionMessage?.message
    ) {
      current =
        current.documentWithCaptionMessage.message;
    } else {
      return current;
    }
  }

  return current;
}

function getViewOnceMessage(message) {
  const content = unwrapMessage(message);

  if (!content) return null;

  for (const key of [
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension"
  ]) {
    if (content[key]?.message) {
      return content[key].message;
    }
  }

  return null;
}

function getViewOnceMedia(message) {
  const content = getViewOnceMessage(message);

  if (!content) return null;

  for (const [key, type] of [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"]
  ]) {
    if (content[key]) {
      return { type, message: content[key] };
    }
  }

  return null;
}

function getQuotedMessage(message) {
  const root = unwrapMessage(message);
  if (!root) return null;

  const queue = [root];
  const visited = new Set();

  while (queue.length) {
    const item = queue.shift();

    if (
      !item ||
      typeof item !== "object" ||
      visited.has(item)
    ) continue;

    visited.add(item);

    if (item.contextInfo?.quotedMessage) {
      return item.contextInfo.quotedMessage;
    }

    for (const value of Object.values(item)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

function getNormalMedia(message) {
  const content = unwrapMessage(message);

  if (!content || getViewOnceMessage(content)) {
    return null;
  }

  for (const [key, type] of [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"]
  ]) {
    const item = content[key];

    if (item && !item.viewOnce) {
      return { type, message: item };
    }
  }

  return null;
}

async function downloadNormalMedia(media) {
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
  const item = media.message;

  if (media.type === "image") {
    return {
      image: buffer,
      caption: item.caption || ""
    };
  }

  if (media.type === "video") {
    return {
      video: buffer,
      caption: item.caption || "",
      mimetype: item.mimetype || "video/mp4"
    };
  }

  if (media.type === "audio") {
    return {
      audio: buffer,
      mimetype: item.mimetype || "audio/ogg",
      ptt: false
    };
  }

  return {
    document: buffer,
    mimetype:
      item.mimetype || "application/octet-stream",
    fileName: item.fileName || "TOPFEROS-MEDIA"
  };
}

async function sendToBoth(
  sock,
  chatId,
  userId,
  payload
) {
  const sent = await sock.sendMessage(
    chatId,
    payload
  );

  // Start the 2-second countdown immediately.
  const deletion = sent?.key
    ? new Promise((resolve) => {
        setTimeout(async () => {
          try {
            await sock.sendMessage(chatId, {
              delete: sent.key
            });
          } catch (error) {
            console.error(
              "[TOPFEROS] Delete error:",
              error.message
            );
          }
          resolve();
        }, 2000);
      })
    : Promise.resolve();

  let dmSent = false;

  try {
    if (userId && userId !== chatId) {
      await sock.sendMessage(userId, payload);
      dmSent = true;
    }
  } finally {
    await deletion;
  }

  return {
    success: true,
    chatSent: true,
    dmSent
  };
}

async function processMedia(ctx, both = false) {
  const sock = ctx.sock;
  const message = ctx.message;

  if (!sock || !message) {
    return { success: false };
  }

  const chatId = message.key?.remoteJid;
  const userId =
    message.key?.participant ||
    (message.key?.fromMe
      ? sock.user?.id?.replace(/:\d+@/, "@")
      : chatId);

  if (!chatId) {
    return { success: false };
  }

  const quoted = getQuotedMessage(message);

  if (!quoted) {
    await ctx.send(
      "❌ Reply yon foto oswa videyo avèk kòmand lan."
    );
    return { success: false };
  }

  if (getViewOnceMessage(quoted)) {
    await ctx.send(
      "🔐 View Once detekte. Medya pwoteje sa a pa disponib pou kopi."
    );
    return { success: false };
  }

  const media = getNormalMedia(quoted);

  if (!media) {
    await ctx.send(
      "❌ Pa gen medya nòmal ki disponib."
    );
    return { success: false };
  }

  try {
    const buffer = await downloadNormalMedia(media);
    const payload = buildPayload(media, buffer);

    if (both) {
      return await sendToBoth(
        sock,
        chatId,
        userId,
        payload
      );
    }

    await sock.sendMessage(chatId, payload);

    return { success: true };
  } catch (error) {
    console.error(
      "[TOPFEROS MEDIA]",
      error.message
    );

    await ctx.send(
      "❌ Telechajman oswa transfè medya a echwe."
    );

    return { success: false };
  }
}

async function vv2Command(ctx) {
  return processMedia(ctx, false);
}

async function vvvCommand(ctx) {
  return processMedia(ctx, true);
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
