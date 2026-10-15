"use strict";

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const settingPanel =
  require("../src/settingPanel");

// ============================================================
// TOPFEROS MD
// ANTI-DELETE SERVICE
// ============================================================

const CACHE_TTL =
  10 * 60 * 1000;

const MAX_CACHE_PER_CHAT =
  100;

const messageCache =
  new Map();

// ============================================================
// CACHE KEY
// ============================================================

function makeCacheKey(
  sessionId,
  messageId
) {
  return `${sessionId}:${messageId}`;
}

// ============================================================
// UNWRAP MESSAGE
// ============================================================

function unwrapMessage(
  message
) {
  let current =
    message;

  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
    "associatedChildMessage"
  ];

  let safety = 0;

  while (
    current &&
    safety < 10
  ) {
    safety++;

    let found = false;

    for (
      const wrapper of wrappers
    ) {
      if (
        current?.[wrapper]
          ?.message
      ) {
        current =
          current[
            wrapper
          ].message;

        found = true;

        break;
      }
    }

    if (!found) {
      break;
    }
  }

  return current || null;
}

// ============================================================
// GET MESSAGE TYPE
// ============================================================

function getMessageType(
  message
) {
  const content =
    unwrapMessage(
      message
    );

  if (!content) {
    return null;
  }

  if (
    content.conversation
  ) {
    return "text";
  }

  if (
    content.extendedTextMessage
  ) {
    return "text";
  }

  if (
    content.imageMessage
  ) {
    return "image";
  }

  if (
    content.videoMessage
  ) {
    return "video";
  }

  if (
    content.audioMessage
  ) {
    return "audio";
  }

  if (
    content.documentMessage
  ) {
    return "document";
  }

  if (
    content.stickerMessage
  ) {
    return "sticker";
  }

  if (
    content.contactMessage ||
    content.contactsArrayMessage
  ) {
    return "contact";
  }

  if (
    content.locationMessage ||
    content.liveLocationMessage
  ) {
    return "location";
  }

  return "unknown";
}

// ============================================================
// GET TEXT
// ============================================================

function getText(
  message
) {
  const content =
    unwrapMessage(
      message
    );

  if (!content) {
    return "";
  }

  if (
    typeof content.conversation ===
    "string"
  ) {
    return content.conversation;
  }

  if (
    typeof content.extendedTextMessage
      ?.text ===
    "string"
  ) {
    return content
      .extendedTextMessage
      .text;
  }

  if (
    typeof content.imageMessage
      ?.caption ===
    "string"
  ) {
    return content
      .imageMessage
      .caption;
  }

  if (
    typeof content.videoMessage
      ?.caption ===
    "string"
  ) {
    return content
      .videoMessage
      .caption;
  }

  if (
    typeof content.documentMessage
      ?.caption ===
    "string"
  ) {
    return content
      .documentMessage
      .caption;
  }

  return "";
}

// ============================================================
// GET ORIGINAL SENDER
// ============================================================

function getOriginalSender(
  message
) {
  return (
    message?.key?.participant ||
    message?.key?.remoteJid ||
    ""
  );
}

// ============================================================
// FORMAT JID
// ============================================================

function normalizeJid(
  jid
) {
  if (!jid) {
    return "";
  }

  return String(jid)
    .replace(
      /:\d+(?=@)/,
      ""
    );
}

// ============================================================
// FORMAT USER
// ============================================================

function formatUser(
  jid
) {
  const clean =
    normalizeJid(jid);

  if (!clean) {
    return "Unknown";
  }

  if (
    clean.includes("@g.us")
  ) {
    return clean;
  }

  return `@${clean.split("@")[0]}`;
}

// ============================================================
// FORMAT DURATION
// ============================================================

function formatDuration(
  seconds
) {
  const total =
    Number(seconds || 0);

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return "0:00";
  }

  const minutes =
    Math.floor(
      total / 60
    );

  const secs =
    Math.floor(
      total % 60
    );

  return `${minutes}:${String(
    secs
  ).padStart(2, "0")}`;
}

// ============================================================
// MESSAGE PREVIEW
// ============================================================

function getMessagePreview(
  message
) {
  const content =
    unwrapMessage(
      message
    );

  const type =
    getMessageType(
      message
    );

  if (
    type === "text"
  ) {
    return (
      getText(
        message
      ) || "[TEXT]"
    );
  }

  if (
    type === "audio"
  ) {
    const duration =
      content
        ?.audioMessage
        ?.seconds;

    return `🎙️ ▶️ ━━━━━━━━━ ${formatDuration(
      duration
    )}`;
  }

  if (
    type === "video"
  ) {
    return "🎥";
  }

  if (
    type === "image"
  ) {
    return "🖼️";
  }

  if (
    type === "document"
  ) {
    return "📄";
  }

  if (
    type === "sticker"
  ) {
    return "🏷️";
  }

  if (
    type === "contact"
  ) {
    return "👤";
  }

  if (
    type === "location"
  ) {
    return "📍";
  }

  return "📎";
}

// ============================================================
// SAVE MESSAGE IN CACHE
// ============================================================

function cacheMessage(
  sessionId,
  message
) {
  if (
    !sessionId ||
    !message?.key?.id ||
    !message?.message
  ) {
    return;
  }

  if (
    message?.key?.fromMe
  ) {
    return;
  }

  const chatId =
    message.key.remoteJid;

  if (!chatId) {
    return;
  }

  const key =
    makeCacheKey(
      sessionId,
      message.key.id
    );

  const chatMessages =
    messageCache.get(
      `${sessionId}:${chatId}`
    ) || [];

  chatMessages.push({
    message,
    createdAt: Date.now()
  });

  while (
    chatMessages.length >
    MAX_CACHE_PER_CHAT
  ) {
    chatMessages.shift();
  }

  messageCache.set(
    `${sessionId}:${chatId}`,
    chatMessages
  );

  messageCache.set(
    key,
    {
      message,
      createdAt: Date.now()
    }
  );
}

// ============================================================
// FIND CACHED MESSAGE
// ============================================================

function findCachedMessage(
  sessionId,
  messageKey
) {
  if (
    !sessionId ||
    !messageKey?.id
  ) {
    return null;
  }

  const key =
    makeCacheKey(
      sessionId,
      messageKey.id
    );

  const direct =
    messageCache.get(
      key
    );

  if (
    direct &&
    Date.now() -
      direct.createdAt <=
      CACHE_TTL
  ) {
    return direct.message;
  }

  const chatId =
    messageKey.remoteJid;

  const chatMessages =
    messageCache.get(
      `${sessionId}:${chatId}`
    ) || [];

  for (
    let i =
      chatMessages.length - 1;
    i >= 0;
    i--
  ) {
    const item =
      chatMessages[i];

    if (
      item?.message?.key?.id ===
        messageKey.id &&
      Date.now() -
        item.createdAt <=
        CACHE_TTL
    ) {
      return item.message;
    }
  }

  return null;
}

// ============================================================
// CHECK ANTI-DELETE
// ============================================================

function isAntiDeleteEnabled(sessionId) {
  try {
    const settings =
      settingPanel.getSessionSettings(sessionId);

    return settings?.automation?.antiDelete === true;
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Anti Delete settings error:",
      error.message
    );

    return false;
  }
}

// ============================================================
// DESTINATION
// ============================================================

function getDestination(sessionId, chatId) {
  try {
    const settings =
      settingPanel.getSessionSettings(sessionId);

    const mode = String(
      settings?.automation?.antiDeleteMode || "private"
    ).trim().toLowerCase();

    // Retounen mesaj la nan menm konvèsasyon an.
    if (
      mode === "same_chat" ||
      mode === "nan menm chat la"
    ) {
      return {
        jid: chatId,
        mode: "same-chat"
      };
    }

    // Voye mesaj la an prive bay kont bot la.
    if (
      mode === "private" ||
      mode === "an privé" ||
      mode === "an prive"
    ) {
      const botJid =
        sockUserJid(sessionId);

      if (!botJid) {
        return null;
      }

      return {
        jid: botJid,
        mode: "private"
      };
    }

    return null;
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Anti Delete destination error:",
      error.message
    );

    return null;
  }
}
// ============================================================
// LOCATION NAME
// ============================================================

function getDestination(sock, sessionId, chatId) {
  try {
    const settings =
      settingPanel.getSessionSettings(sessionId);

    const mode = String(
      settings?.automation?.antiDeleteMode || "private"
    ).trim().toLowerCase();

    if (
      mode === "same_chat" ||
      mode === "nan menm chat la"
    ) {
      return {
        jid: chatId,
        mode: "same-chat"
      };
    }

    if (
      mode === "private" ||
      mode === "an privé" ||
      mode === "an prive"
    ) {
      const botJid = String(
        sock?.user?.id || ""
      ).replace(/:\d+(?=@)/, "");

      if (!botJid) {
        return null;
      }

      return {
        jid: botJid,
        mode: "private"
      };
    }

    return null;
  } catch (error) {
    console.error(
      "[TOPFEROS MD] Anti Delete destination error:",
      error.message
    );

    return null;
  }
}

// ============================================================
// DOWNLOAD MEDIA
// ============================================================

async function downloadMedia(
  mediaMessage,
  type
) {
  if (!mediaMessage) {
    return null;
  }

  let streamType =
    type;

  if (
    type === "image"
  ) {
    streamType = "image";
  }

  if (
    type === "video"
  ) {
    streamType = "video";
  }

  if (
    type === "audio"
  ) {
    streamType = "audio";
  }

  if (
    type === "document"
  ) {
    streamType = "document";
  }

  const stream =
    await downloadContentFromMessage(
      mediaMessage,
      streamType
    );

  const chunks = [];

  for await (
    const chunk of stream
  ) {
    chunks.push(
      Buffer.from(chunk)
    );
  }

  return Buffer.concat(
    chunks
  );
}

// ============================================================
// RESTORE ORIGINAL MESSAGE
// ============================================================

async function restoreMessage(
  sock,
  destination,
  original
) {
  const content =
    unwrapMessage(
      original?.message
    );

  if (!content) {
    return false;
  }

  const type =
    getMessageType(
      original
    );

  // ----------------------------------------------------------
  // TEXT
  // ----------------------------------------------------------

  if (
    type === "text"
  ) {
    const text =
      getText(
        original
      );

    if (!text) {
      return false;
    }

    await sock.sendMessage(
      destination,
      {
        text
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // IMAGE
  // ----------------------------------------------------------

  if (
    type === "image"
  ) {
    const media =
      await downloadMedia(
        content.imageMessage,
        "image"
      );

    await sock.sendMessage(
      destination,
      {
        image: media,
        caption:
          content.imageMessage
            ?.caption ||
          undefined,
        mimetype:
          content.imageMessage
            ?.mimetype ||
          "image/jpeg"
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // VIDEO
  // ----------------------------------------------------------

  if (
    type === "video"
  ) {
    const media =
      await downloadMedia(
        content.videoMessage,
        "video"
      );

    await sock.sendMessage(
      destination,
      {
        video: media,
        caption:
          content.videoMessage
            ?.caption ||
          undefined,
        mimetype:
          content.videoMessage
            ?.mimetype ||
          "video/mp4"
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // AUDIO / VOICE
  // ----------------------------------------------------------

  if (
    type === "audio"
  ) {
    const audio =
      content.audioMessage;

    const media =
      await downloadMedia(
        audio,
        "audio"
      );

    /*
     * ptt: true se sa ki fè WhatsApp
     * montre li kòm yon VOICE NOTE nòmal.
     */
    await sock.sendMessage(
      destination,
      {
        audio: media,
        mimetype:
          audio?.mimetype ||
          "audio/ogg; codecs=opus",
        ptt:
          Boolean(
            audio?.ptt
          )
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // DOCUMENT
  // ----------------------------------------------------------

  if (
    type === "document"
  ) {
    const document =
      content.documentMessage;

    const media =
      await downloadMedia(
        document,
        "document"
      );

    await sock.sendMessage(
      destination,
      {
        document: media,
        mimetype:
          document?.mimetype ||
          "application/octet-stream",
        fileName:
          document?.fileName ||
          "restored-document"
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // STICKER
  // ----------------------------------------------------------

  if (
    type === "sticker"
  ) {
    const media =
      await downloadMedia(
        content.stickerMessage,
        "sticker"
      );

    await sock.sendMessage(
      destination,
      {
        sticker: media
      }
    );

    return true;
  }

  return false;
}

// ============================================================
// SEND ANTI-DELETE ALERT
// ============================================================

async function sendAlert(
  sock,
  destination,
  original,
  deletedBy,
  location
) {
  const originalSender =
    getOriginalSender(
      original
    );

  const preview =
    getMessagePreview(
      original
    );

  const alert =
`╔══════════════════╗
║  ⚠️ ANTI-DELETE  ║
║     DETECTED 🦁  ║
╚══════════════════╝

📍 Location : ${location}
🗑️ Deleted By: ${formatUser(
    deletedBy
  )}
👤 Sent By: ${formatUser(
    originalSender
  )}
✉️ Message : ${preview}

________________________
By TECH TOPFEROS`;

  const mentions = [];

  const deletedClean =
    normalizeJid(
      deletedBy
    );

  const senderClean =
    normalizeJid(
      originalSender
    );

  if (
    deletedClean &&
    deletedClean.includes(
      "@s.whatsapp.net"
    )
  ) {
    mentions.push(
      deletedClean
    );
  }

  if (
    senderClean &&
    senderClean.includes(
      "@s.whatsapp.net"
    ) &&
    !mentions.includes(
      senderClean
    )
  ) {
    mentions.push(
      senderClean
    );
  }

  await sock.sendMessage(
    destination,
    {
      text: alert,
      mentions
    }
  );
}

// ============================================================
// HANDLE NORMAL INCOMING MESSAGE
// ============================================================

async function handleIncomingMessage(
  sessionId,
  message
) {
  if (
    !sessionId ||
    !message?.message
  ) {
    return;
  }

  /*
   * Pa cache bot la voye tèt li.
   */
  if (
    message?.key?.fromMe
  ) {
    return;
  }

  /*
   * Pa cache status broadcast.
   */
  if (
    message?.key?.remoteJid ===
    "status@broadcast"
  ) {
    return;
  }

  cacheMessage(
    sessionId,
    message
  );
}

// ============================================================
// HANDLE DELETE EVENT
// ============================================================

async function handleDeleteEvent(
  sock,
  sessionId,
  revokeMessage
) {
  try {
    if (
      !sock ||
      !sessionId ||
      !revokeMessage?.message
    ) {
      return false;
    }

    if (
      !isAntiDeleteEnabled(
        sessionId
      )
    ) {
      return false;
    }

    const protocol =
      revokeMessage
        ?.message
        ?.protocolMessage;

    if (!protocol) {
      return false;
    }

    /*
     * Baileys:
     * protocolMessage.type === 0
     * = REVOKE
     */
    if (
      Number(protocol.type) !==
      0
    ) {
      return false;
    }

    const original =
      findCachedMessage(
        sessionId,
        protocol.key
      );

    if (!original) {
      console.warn(
        `⚠️ ANTI-DELETE: original message not found [${sessionId}]`
      );

      return false;
    }

    const originalChat =
      original?.key
        ?.remoteJid ||
      protocol?.key
        ?.remoteJid;

    if (!originalChat) {
      return false;
    }

    const destination =
  getDestination(
    sock,
    sessionId,
    originalChat
  );

    if (!destination) {
      return false;
    }

    /*
     * Outer message = moun ki efase a.
     */
    const deletedBy =
      revokeMessage?.key
        ?.participant ||
      revokeMessage?.participant ||
      revokeMessage?.key
        ?.remoteJid ||
      "";

    const location =
      await getLocationName(
        sock,
        originalChat
      );

    /*
     * 1. ALÈT LA VOYE AN PREMYE.
     */
    await sendAlert(
      sock,
      destination.jid,
      original,
      deletedBy,
      location
    );

    /*
     * 2. MESAJ ORIJINAL LA RESTORE APRÈ.
     */
    await restoreMessage(
      sock,
      destination.jid,
      original
    );

    return true;

  } catch (error) {

    console.error(
      `❌ ANTI-DELETE ERROR [${sessionId}]`,
      error?.stack ||
      error?.message ||
      error
    );

    return false;
  }
}

// ============================================================
// CLEAN CACHE
// ============================================================

function cleanupCache() {
  const now =
    Date.now();

  for (
    const [
      key,
      value
    ] of messageCache.entries()
  ) {
    if (
      value?.createdAt &&
      now -
        value.createdAt >
        CACHE_TTL
    ) {
      messageCache.delete(
        key
      );
    }
  }

  for (
    const [
      key,
      list
    ] of messageCache.entries()
  ) {
    if (
      !Array.isArray(list)
    ) {
      continue;
    }

    const filtered =
      list.filter(
        item =>
          item?.createdAt &&
          now -
            item.createdAt <=
            CACHE_TTL
      );

    if (
      filtered.length
    ) {
      messageCache.set(
        key,
        filtered
      );
    } else {
      messageCache.delete(
        key
      );
    }
  }
}

setInterval(
  cleanupCache,
  60 * 1000
).unref();

// ============================================================
// EXPORTS
// ============================================================

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

// ╔════════════════════════════════════════════════════╗
// ║             🚀 TECH BY TOPFEROS MD               ║
// ╚════════════════════════════════════════════════════╝