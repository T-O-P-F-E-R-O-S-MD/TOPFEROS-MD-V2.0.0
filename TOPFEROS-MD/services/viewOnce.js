
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// MEDIA SERVICE
// Compatible with commands/vv2.js
// Baileys 7.x — TOPFEROS MD V2.0.0

const {
  getBaileys
} = require("./baileysRuntime");

const MEDIA_TYPES = [
  ["imageMessage", "image"],
  ["videoMessage", "video"],
  ["audioMessage", "audio"],
  ["documentMessage", "document"]
];

function unwrapMessage(input) {
  let current = input?.message || input;

  for (let i = 0; i < 10; i++) {
    if (!current) return null;

    // Respect WhatsApp View Once restrictions.
    if (
      current.viewOnceMessage ||
      current.viewOnceMessageV2 ||
      current.viewOnceMessageV2Extension
    ) {
      return null;
    }

    if (current.ephemeralMessage) {
      current = current.ephemeralMessage.message;
      continue;
    }

    if (current.documentWithCaptionMessage) {
      current =
        current.documentWithCaptionMessage.message;
      continue;
    }

    break;
  }

  return current;
}

function getQuotedMessage(message) {
  const content = unwrapMessage(message);

  if (!content) return null;

  for (const value of Object.values(content)) {
    const quoted =
      value?.contextInfo?.quotedMessage;

    if (quoted) return quoted;
  }

  return null;
}

function findMedia(message) {
  const content = unwrapMessage(message);

  if (!content) return null;

  for (const [key, type] of MEDIA_TYPES) {
    if (content[key]) {
      return {
        type,
        media: content[key]
      };
    }
  }

  return null;
}

async function downloadMedia(media, type) {
  const {
    downloadContentFromMessage
  } = await getBaileys();

  const stream = await downloadContentFromMessage(
    media,
    type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function handleVV2(context) {
  const { sock, message } = context || {};

  if (!sock || !message) return false;

  const chatId = message.key?.remoteJid;

  if (!chatId) return false;

  const quoted = getQuotedMessage(message);

  if (!quoted) return false;

  const found = findMedia(quoted);

  if (!found) return false;

  const { type, media } = found;

  const buffer = await downloadMedia(
    media,
    type
  );

  if (!buffer.length) return false;

  const options = {};

  if (type === "image") {
    options.image = buffer;
    options.caption = media.caption || "";
  }

  if (type === "video") {
    options.video = buffer;
    options.caption = media.caption || "";
    options.mimetype =
      media.mimetype || "video/mp4";
  }

  if (type === "audio") {
    options.audio = buffer;
    options.mimetype =
      media.mimetype || "audio/ogg";
    options.ptt = Boolean(media.ptt);
  }

  if (type === "document") {
    options.document = buffer;
    options.mimetype =
      media.mimetype ||
      "application/octet-stream";
    options.fileName =
      media.fileName || "document";
  }

  await sock.sendMessage(chatId, options, {
    quoted: message
  });

  console.log(
    `[VV2] Media processed | type=${type}`
  );

  return true;
}

module.exports = {
  handleVV2,
  unwrapMessage,
  getQuotedMessage,
  findMedia,
  downloadMedia
};
