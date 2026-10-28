
"use strict";

const {
  getBaileys
} = require("./baileysRuntime");

const settingPanel = require("../src/settingPanel");

const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_PER_CHAT = 100;
const messageCache = new Map();

function makeChatKey(sessionId, chatId) {
  return `${sessionId}:chat:${chatId}`;
}

function makeMessageKey(sessionId, chatId, messageId) {
  return `${sessionId}:message:${chatId}:${messageId}`;
}

function unwrapMessage(message) {
  let current = message;
  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
    "associatedChildMessage"
  ];

  for (let i = 0; current && i < 10; i++) {
    let found = false;

    for (const wrapper of wrappers) {
      if (current[wrapper]?.message) {
        current = current[wrapper].message;
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return current || null;
}

function getMessageType(message) {
  const content = unwrapMessage(message?.message || message);
  if (!content) return null;

  if (content.conversation || content.extendedTextMessage) return "text";
  if (content.imageMessage) return "image";
  if (content.videoMessage) return "video";
  if (content.audioMessage) return "audio";
  if (content.documentMessage) return "document";
  if (content.stickerMessage) return "sticker";
  if (content.contactMessage || content.contactsArrayMessage) return "contact";
  if (content.locationMessage || content.liveLocationMessage) return "location";

  return "unknown";
}

function getText(message) {
  const content = unwrapMessage(message?.message || message);
  if (!content) return "";

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ""
  );
}

function normalizeJid(jid) {
  return String(jid || "").replace(/:\d+(?=@)/, "");
}

function formatUser(jid) {
  const clean = normalizeJid(jid);
  if (!clean) return "Unknown";
  if (clean.endsWith("@g.us")) return clean;
  return `@${clean.split("@")[0]}`;
}

function getMessagePreview(message) {
  const type = getMessageType(message);

  if (type === "text") return getText(message) || "[TEXT]";
  if (type === "image") return "🖼️ Image";
  if (type === "video") return "🎥 Video";
  if (type === "audio") return "🎙️ Audio";
  if (type === "document") return "📄 Document";
  if (type === "sticker") return "🏷️ Sticker";
  if (type === "contact") return "👤 Contact";
  if (type === "location") return "📍 Location";

  return "📎 Attachment";
}

function cacheMessage(sessionId, message) {
  const chatId = message?.key?.remoteJid;
  const messageId = message?.key?.id;

  if (
    !sessionId ||
    !chatId ||
    !messageId ||
    !message?.message ||
    message.key.fromMe ||
    chatId === "status@broadcast"
  ) return;

  const now = Date.now();
  const chatKey = makeChatKey(sessionId, chatId);
  const messageKey = makeMessageKey(sessionId, chatId, messageId);

  const list = messageCache.get(chatKey) || [];

  const existing = list.findIndex(
    item => item.message?.key?.id === messageId
  );

  const item = {
    message,
    createdAt: now
  };

  if (existing >= 0) list[existing] = item;
  else list.push(item);

  while (list.length > MAX_CACHE_PER_CHAT) list.shift();

  messageCache.set(chatKey, list);
  messageCache.set(messageKey, item);
}

function findCachedMessage(sessionId, messageKey) {
  if (!sessionId || !messageKey?.id) return null;

  const chatId = messageKey.remoteJid || "";
  const now = Date.now();

  if (chatId) {
    const direct = messageCache.get(
      makeMessageKey(sessionId, chatId, messageKey.id)
    );

    if (direct && now - direct.createdAt <= CACHE_TTL) {
      return direct.message;
    }

    const list = messageCache.get(makeChatKey(sessionId, chatId)) || [];

    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i];

      if (
        item.message?.key?.id === messageKey.id &&
        now - item.createdAt <= CACHE_TTL
      ) return item.message;
    }
  }

  // Si remoteJid manke nan protocol key la, chèche nan cache sesyon an.
  for (const [key, value] of messageCache.entries()) {
    if (!key.startsWith(`${sessionId}:chat:`) || !Array.isArray(value)) {
      continue;
    }

    for (let i = value.length - 1; i >= 0; i--) {
      const item = value[i];

      if (
        item.message?.key?.id === messageKey.id &&
        now - item.createdAt <= CACHE_TTL
      ) return item.message;
    }
  }

  return null;
}

function isAntiDeleteEnabled(sessionId) {
  try {
    const settings = settingPanel.getSessionSettings(sessionId);
    return settings?.automation?.antiDelete === true;
  } catch (error) {
    console.error("[TOPFEROS MD] Anti Delete settings error:", error.message);
    return false;
  }
}

function getDestination(sock, sessionId, chatId) {
  try {
    const settings = settingPanel.getSessionSettings(sessionId);
    const mode = String(
      settings?.automation?.antiDeleteMode || "private"
    ).trim().toLowerCase();

    if ([
      "same_chat",
      "same-chat",
      "nan menm chat la",
      "même chat"
    ].includes(mode)) {
      return { jid: chatId, mode: "same-chat" };
    }

    if ([
      "private",
      "an privé",
      "an prive",
      "privé"
    ].includes(mode)) {
      const botJid = normalizeJid(sock?.user?.id || sock?.user?.jid);
      return botJid ? { jid: botJid, mode: "private" } : null;
    }

    // Si mòd la pa rekonèt, pa kite sèvis la fè aksyon sou yon JID enkoni.
    return null;
  } catch (error) {
    console.error("[TOPFEROS MD] Anti Delete destination error:", error.message);
    return null;
  }
}

async function getLocationName(sock, chatId) {
  if (!chatId) return "Unknown chat";
  if (!chatId.endsWith("@g.us")) return "Private chat";

  try {
    const metadata = await sock.groupMetadata(chatId);
    return metadata?.subject || chatId;
  } catch {
    return chatId;
  }
}

async function downloadMedia(mediaMessage, type) {
  if (!mediaMessage) {
    throw new Error("Media message is missing.");
  }

  const {
    downloadContentFromMessage
  } = await getBaileys();

  const stream = await downloadContentFromMessage(
    mediaMessage,
    type
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function restoreMessage(sock, destination, original) {
  const content = unwrapMessage(original?.message);
  if (!content) return false;

  const type = getMessageType(original);

  if (type === "text") {
    const text = getText(original);
    if (!text) return false;

    await sock.sendMessage(destination, { text });
    return true;
  }

  if (type === "image") {
    const media = await downloadMedia(content.imageMessage, "image");

    await sock.sendMessage(destination, {
      image: media,
      caption: content.imageMessage.caption || undefined,
      mimetype: content.imageMessage.mimetype || "image/jpeg"
    });

    return true;
  }

  if (type === "video") {
    const media = await downloadMedia(content.videoMessage, "video");

    await sock.sendMessage(destination, {
      video: media,
      caption: content.videoMessage.caption || undefined,
      mimetype: content.videoMessage.mimetype || "video/mp4"
    });

    return true;
  }

  if (type === "audio") {
    const audio = content.audioMessage;
    const media = await downloadMedia(audio, "audio");

    await sock.sendMessage(destination, {
      audio: media,
      mimetype: audio.mimetype || "audio/ogg; codecs=opus",
      ptt: Boolean(audio.ptt)
    });

    return true;
  }

  if (type === "document") {
    const document = content.documentMessage;
    const media = await downloadMedia(document, "document");

    await sock.sendMessage(destination, {
      document: media,
      mimetype: document.mimetype || "application/octet-stream",
      fileName: document.fileName || "restored-document"
    });

    return true;
  }

  if (type === "sticker") {
    const media = await downloadMedia(content.stickerMessage, "sticker");
    await sock.sendMessage(destination, { sticker: media });
    return true;
  }

  // WhatsApp pa pèmèt tout kalite mesaj orijinal yo retabli menm jan an.
  return false;
}

async function sendAlert(sock, destination, original, deletedBy, location) {
  const sender = normalizeJid(
    original?.key?.participant || original?.key?.remoteJid
  );

  const deleted = normalizeJid(deletedBy);
  const mentions = [];

  for (const jid of [deleted, sender]) {
    if (
      jid &&
      jid.endsWith("@s.whatsapp.net") &&
      !mentions.includes(jid)
    ) mentions.push(jid);
  }

  const alert =
`╔══════════════════╗
║  ⚠️ ANTI-DELETE  ║
║     DETECTED 🦁  ║
╚══════════════════╝

📍 Location: ${location}
🗑️ Deleted by: ${formatUser(deletedBy)}
👤 Sent by: ${formatUser(sender)}
✉️ Message: ${getMessagePreview(original)}

________________________
🦁 TECH BY TOPFEROS MD`;

  await sock.sendMessage(destination, { text: alert, mentions });
}

async function handleIncomingMessage(sessionId, message) {
  cacheMessage(sessionId, message);
}

async function handleDeleteEvent(sock, sessionId, revokeMessage) {
  try {
    if (!sock || !sessionId || !revokeMessage?.message) return false;
    if (!isAntiDeleteEnabled(sessionId)) return false;

    const protocol = revokeMessage.message.protocolMessage;
    if (!protocol || Number(protocol.type) !== 0 || !protocol.key?.id) {
      return false;
    }

    const original = findCachedMessage(sessionId, protocol.key);

    if (!original) {
      console.warn(
        `[TOPFEROS MD] Anti Delete: original message not found (${sessionId})`
      );
      return false;
    }

    const chatId = original.key?.remoteJid || protocol.key.remoteJid;
    if (!chatId) return false;

    const destination = getDestination(sock, sessionId, chatId);
    if (!destination?.jid) return false;

    const deletedBy =
      revokeMessage.key?.participant ||
      revokeMessage.participant ||
      revokeMessage.key?.remoteJid ||
      "";

    const location = await getLocationName(sock, chatId);

    await sendAlert(sock, destination.jid, original, deletedBy, location);

    const restored = await restoreMessage(sock, destination.jid, original);

    if (!restored) {
      console.warn(
        `[TOPFEROS MD] Anti Delete: message type not restorable (${getMessageType(original)})`
      );
    }

    return restored;
  } catch (error) {
    console.error(
      `[TOPFEROS MD] Anti Delete error [${sessionId}]:`,
      error?.stack || error?.message || error
    );

    return false;
  }
}

function cleanupCache() {
  const now = Date.now();

  for (const [key, value] of messageCache.entries()) {
    if (Array.isArray(value)) {
      const filtered = value.filter(
        item => now - item.createdAt <= CACHE_TTL
      );

      if (filtered.length) messageCache.set(key, filtered);
      else messageCache.delete(key);
    } else if (!value?.createdAt || now - value.createdAt > CACHE_TTL) {
      messageCache.delete(key);
    }
  }
}

setInterval(cleanupCache, 60 * 1000).unref();

module.exports = {
  handleIncomingMessage,
  handleDeleteEvent,
  cacheMessage,
  findCachedMessage,
  getMessageType,
  getMessagePreview,
  restoreMessage,
  cleanupCache
};
