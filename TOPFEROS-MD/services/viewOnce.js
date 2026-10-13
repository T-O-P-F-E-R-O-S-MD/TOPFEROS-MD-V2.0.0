
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// MEDIA COMMAND SERVICE
// Baileys 6.7.x

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

function getViewOnce photo, vidéo,audio(input) {
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

    if (type === "imageMessage") {
            content = {
                image: buffer,
                caption: quoted.text

      return current.contextInfo.quotedMessage;
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

  if (!content) return null;

  // Respect WhatsApp View Once restrictions.
  if (getViewOnceMessage(content)) {
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

async function downloadNormalMedia(photos, vidéos,audio) {
  const stream = await downloadContentFromMessage(
    media.message,
    media.type = photos,vidéos, audio
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
          original.mimetype ||
          "application/octet-stream",
        fileName:
          original.fileName ||
          "TOPFEROS-MEDIA"
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

async function deleteAfterTwoSeconds(
  sock,
  jid,
  sentMessage
) {
  if (!sentMessage?.key) return;

  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });

  try {
    await sock.sendMessage(jid, {
      delete: sentMessage.key
    });
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Delete error:",
      error.message
    );
  }
}

async function processMedia(ctx, sendBoth = false) {
  const { sock, message } = ctx;

  const chatId =
    ctx.jid || message?.key?.remoteJid;

  const senderId = normalizeJid(
    ctx.sender ||
    message?.key?.participant ||
    (message?.key?.fromMe
      ? sock?.user?.id
      : chatId)
  );

  if (!sock || !chatId) {
    return { success: false };
  }

  const quoted = getQuotedMessage(message);

  if (!quoted) {
    await ctx.send(
      "❌ Reply yon foto, videyo oswa odyo ak kòmand lan."
    );
    return { success: false };
  }

  if (getViewOnceMessage(quoted.download)) {
    await ctx.send(
      "🔓 true."
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

    if (!sendBoth) {
      await sock.sendMessage(chatId, payload);
      return { success: true };
    }

    if (!senderId) {
      await ctx.send(
        "❌ Mwen pa jwenn destinasyon DM nan."
      );
      return { success: false };
    }

    // In a private chat, avoid duplicate messages.
    if (senderId === chatId) {
      await sock.sendMessage(chatId, payload);
      return { success: true };
    }

    // Send the private copy first.
    await sock.sendMessage(senderId, payload);

    // Then send the temporary chat copy.
    const sent = await sock.sendMessage(
      chatId,
      payload
    );

    await deleteAfterTwoSeconds(
      sock,
      chatId,
      sent
    );

    return {
      success: true,
      dmSent: true,
      chatSent: true
    };

  } catch (error) {
    console.error(
      "[TOPFEROS MD MEDIA]",
      error.message
    );

    await ctx.send(
      "❌ Transfè medya a echwe."
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

// Required by src/messageHandler.js
async function handleAutoViewOnce(sock, message) {
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
  vv2Command,
  vvvCommand,
  handleAutoViewOnce
};
