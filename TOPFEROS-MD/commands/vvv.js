
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// VVV COMMAND
// Same Chat + Private DM + Delete after 1 second

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

// 🦁 TOPFEROS MD V2.0.0
// VVV SERVICE CONNECTION

const viewonce = require("../services/viewOnce");

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

function getQuoted(message) {
  const content = message?.message || {};

  const wrapper =
    content.ephemeralMessage?.message ||
    content;

  for (const value of Object.values(wrapper)) {
    if (value?.contextInfo?.quotedMessage) {
      return value.contextInfo.quotedMessage;
    }
  }

  return null;
}

function getMedia(quoted) {
  if (!quoted) return null;

  // Do not bypass View Once restrictions.
  if (
    quoted.viewOnceMessage ||
    quoted.viewOnceMessageV2 ||
    quoted.viewOnceMessageV2Extension
  ) {
    return null;
  }

  const content =
    quoted.ephemeralMessage?.message ||
    quoted;

  const types = [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"]
  ];

  for (const [key, type] of types) {
    if (content[key]?.mediaKey) {
      return {
        media: content[key],
        type
      };
    }
  }

  return null;
}

async function execute(context) {
  const { sock, message } = context || {};

  if (!sock || !message) return;

  const chatId = message.key?.remoteJid;
  const sender = message.key?.participant ||
    chatId;

  if (!chatId || !sender) return;

  const dmId = sender.endsWith("@g.us")
    ? null
    : sender;

  if (!dmId || dmId.endsWith("@g.us")) {
    return;
  }

  // 🦁 TOPFEROS MD V2.0.0
// VVV SERVICE CONNECTION

const quoted = viewonce.getQuotedMessage(message);
const found = viewonce.findMedia(quoted);

  if (!found) {
    await sock.sendMessage(chatId, {
      text: "❌ Reply sou yon medya nòmal ki ka pataje."
    }, { quoted: message });
    return;
  }

  try {
    const buffer = await viewonce.downloadMedia(
  found.media,
  found.type
);

    const buffer = Buffer.concat(chunks);
    if (!buffer.length) return;

    const payload = {};

    payload[found.type] = buffer;

    if (found.type === "image" ||
        found.type === "video") {
      payload.caption = found.media.caption || "";
    }

    if (found.type === "audio") {
      payload.mimetype =
        found.media.mimetype || "audio/ogg";
      payload.ptt = Boolean(found.media.ptt);
    }

    if (found.type === "document") {
      payload.mimetype =
        found.media.mimetype ||
        "application/octet-stream";
      payload.fileName =
        found.media.fileName || "document";
    }

    const sent = await sock.sendMessage(
      chatId,
      payload,
      { quoted: message }
    );

    try {
      await sock.sendMessage(dmId, payload);
    } catch (dmError) {
      console.error("[VVV DM ERROR]", dmError);
    }

    await sleep(1000);

    if (sent?.key) {
      await sock.sendMessage(chatId, {
        delete: sent.key
      });
    }

    console.log("[VVV] Processing complete");

  } catch (error) {
    console.error("[VVV ERROR]", error);
  }
}

module.exports = {
  name: "vvv",
  aliases: [],
  description:
    "Send permitted media to chat and private DM.",
  usage: ".vvv",
  execute
};
