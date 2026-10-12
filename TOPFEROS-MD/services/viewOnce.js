"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                 VIEW ONCE SERVICE                ║
// ╚════════════════════════════════════════════════════╝

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

/*
|--------------------------------------------------------------------------
| GET VIEW ONCE MESSAGE — TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

function getViewOnceMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  let current = message;

  // Verifye anvlòp mesaj yo san antre nan yon bouk san fen.
  for (let i = 0; i < 5; i++) {
    if (!current || typeof current !== "object") {
      return null;
    }

    if (current.viewOnceMessage?.message) {
      return current.viewOnceMessage.message;
    }

    if (current.viewOnceMessageV2?.message) {
      return current.viewOnceMessageV2.message;
    }

    if (current.viewOnceMessageV2Extension?.message) {
      return current.viewOnceMessageV2Extension.message;
    }

    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
      continue;
    }

    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
      continue;
    }

    // Pa gen lòt anvlòp nou rekonèt.
    return null;
  }

  return null;
}
/*
|--------------------------------------------------------------------------
| GET MEDIA
|--------------------------------------------------------------------------
*/

function getViewOnceMedia(message) {
  const viewOnce =
    getViewOnceMessage(message);

  if (!viewOnce) {
    return null;
  }

  if (viewOnce.imageMessage) {
    return {
      type: "image",
      message: viewOnce.imageMessage
    };
  }

  if (viewOnce.videoMessage) {
    return {
      type: "video",
      message: viewOnce.videoMessage
    };
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| DOWNLOAD MEDIA
|--------------------------------------------------------------------------
*/

async function downloadViewOnce(message) {
  const media =
    getViewOnceMedia(message);

  if (!media) {
    return null;
  }

  const stream =
    await downloadContentFromMessage(
      media.message,
      media.type
    );

  const chunks = [];

  for await (
    const chunk of stream
  ) {
    chunks.push(
      Buffer.from(chunk)
    );
  }

  return {
    type: media.type,

    buffer:
      Buffer.concat(chunks),

    mimetype:
      media.message.mimetype ||
      (
        media.type === "image"
          ? "image/jpeg"
          : "video/mp4"
      ),

    caption:
      media.message.caption ||
      ""
  };
}

/*
|--------------------------------------------------------------------------
| SEND DECODED VIEW ONCE
|--------------------------------------------------------------------------
*/

async function sendDecodedViewOnce(
  sock,
  jid,
  message,
  options = {}
) {
  const decoded =
    await downloadViewOnce(
      message
    );

  if (!decoded) {
    return {
      success: false,
      reason:
        "Not a supported ViewOnce message."
    };
  }

  if (
    decoded.type === "image"
  ) {
    await sock.sendMessage(
      jid,
      {
        image:
          decoded.buffer,

        mimetype:
          decoded.mimetype,

        caption:
          decoded.caption ||
          undefined
      },
      {
        quoted:
          options.quoted || undefined
      }
    );
  }

  if (
    decoded.type === "video"
  ) {
    await sock.sendMessage(
      jid,
      {
        video:
          decoded.buffer,

        mimetype:
          decoded.mimetype,

        caption:
          decoded.caption ||
          undefined
      },
      {
        quoted:
          options.quoted || undefined
      }
    );
  }

  return {
    success: true,
    type:
      decoded.type
  };
}

/*
|--------------------------------------------------------------------------
| GET QUOTED MESSAGE — TOPFEROS MD V2.0.0
|--------------------------------------------------------------------------
*/

function getQuotedMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const root = message.message || message;
  const visited = new Set();
  const queue = [root];

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
      return current.contextInfo.quotedMessage;
    }

    for (const [key, value] of Object.entries(current)) {
      if (
        value &&
        typeof value === "object" &&
        key !== "contextInfo"
      ) {
        queue.push(value);
      }
    }
  }

  return null;
}
/*
|--------------------------------------------------------------------------
| UNWRAP QUOTED MESSAGE
|--------------------------------------------------------------------------
*/

function unwrapQuotedMessage(quoted) {
  if (!quoted || typeof quoted !== "object") {
    return null;
  }

  let message = quoted;

  // Retire anvlòp mesaj ki ka kache kontni an.
  for (let i = 0; i < 5; i++) {
    if (message.ephemeralMessage?.message) {
      message = message.ephemeralMessage.message;
      continue;
    }

    if (message.viewOnceMessage?.message) {
      return message;
    }

    if (message.viewOnceMessageV2?.message) {
      return message;
    }

    if (message.viewOnceMessageV2Extension?.message) {
      return message;
    }

    if (message.documentWithCaptionMessage?.message) {
      message = message.documentWithCaptionMessage.message;
      continue;
    }

    break;
  }

  return message;
}
/*
|--------------------------------------------------------------------------
| VV2 COMMAND
|--------------------------------------------------------------------------
*/

async function vv2Command(ctx) {
  const quoted =
    getQuotedMessage(
      ctx.message
    );

  if (!quoted) {
    await ctx.send(
      [
        "❌ VIEW ONCE NOT FOUND",
        "",
        "Reply sou ViewOnce photo/video a epi tape:",
        `${ctx.prefix}vv2`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false
    };
  }

  const result =
    await sendDecodedViewOnce(
      ctx.sock,
      ctx.jid,
      quoted,
      {
        quoted:
          ctx.message
      }
    );

  if (!result.success) {
    await ctx.send(
      [
        "❌ INVALID VIEW ONCE",
        "",
        "Mwen pa jwenn yon ViewOnce photo/video sou mesaj ou reply la.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| AUTO VIEW ONCE IN DM
|--------------------------------------------------------------------------
|
| Lè ViewOnce antre dirèkteman nan DM bot la,
| pa bezwen prefix.
|
|--------------------------------------------------------------------------
*/

async function handleAutoViewOnce(
  sock,
  message
) {
  const jid =
    message?.key?.remoteJid ||
    "";

  /*
   * Pa trete groups.
   */

  if (
    jid.endsWith("@g.us")
  ) {
    return {
      success: false,
      ignored: true
    };
  }

  /*
   * Pa trete status.
   */

  if (
    jid === "status@broadcast"
  ) {
    return {
      success: false,
      ignored: true
    };
  }

  /*
   * Verifye si se ViewOnce.
   */

  const media =
    getViewOnceMedia(
      message?.message
    );

  if (!media) {
    return {
      success: false,
      ignored: true
    };
  }

  /*
   * Dekode epi voye nan menm DM lan.
   */

  return sendDecodedViewOnce(
    sock,
    jid,
    message.message
  );
}

/*
|--------------------------------------------------------------------------
| VVV COMMAND — VIEW ONCE DETECTOR
|--------------------------------------------------------------------------
*/

async function vvvCommand(ctx) {
  // Kòmand lan dwe itilize nan DM.
  if (ctx.isGroup) {
    await ctx.send(
      [
        "❌ PRIVATE CHAT ONLY",
        "",
        "Tanpri itilize .vvv nan DM bot la.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "private-chat-only"
    };
  }

  const quoted = getQuotedMessage(ctx.message);

  if (!quoted) {
    await ctx.send(
      [
        "🔎 VIEW ONCE DETECTOR",
        "",
        "❌ Mwen pa jwenn yon mesaj site.",
        "",
        "Reponn mesaj ou vle idantifye a avèk .vvv.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "no-quoted-message"
    };
  }

  const viewOnce = getViewOnceMessage(quoted);

  if (!viewOnce) {
    await ctx.send(
      [
        "🔎 VIEW ONCE DETECTOR",
        "",
        "❌ Mesaj la pa gen estrikti View Once mwen rekonèt la.",
        "",
        "Sa pa vle di mesaj la pa t View Once; enfòmasyon sa a ka pa disponib.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "view-once-not-detected"
    };
  }

  const media = getViewOnceMedia(quoted);

  const contentTypes = {
    imageMessage: "IMAGE",
    videoMessage: "VIDEO",
    audioMessage: "AUDIO",
    documentMessage: "DOCUMENT",
    stickerMessage: "STICKER",
    contactMessage: "CONTACT",
    locationMessage: "LOCATION"
  };

  let type = "OTHER";

  for (const key of Object.keys(contentTypes)) {
    if (viewOnce[key]) {
      type = contentTypes[key];
      break;
    }
  }

  const mimetype =
    media?.message?.mimetype ||
    viewOnce.audioMessage?.mimetype ||
    viewOnce.documentMessage?.mimetype ||
    "Not available";

  await ctx.send(
    [
      "╭━━〔 🦁 TOPFEROS MD 〕━━╮",
      "┃",
      "┃ 🔎 VIEW ONCE DETECTOR",
      "┃",
      "┃ 🔐 View Once: YES",
      `┃ 📁 Type: ${type}`,
      `┃ 🧾 MIME: ${mimetype}`,
      "┃",
      "╰━━━━━━━━━━━━━━━━━━━━━━╯",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n")
  );

  return {
    success: true,
    type,
    mimetype
  };
}

module.exports = {
  vv2Command,
  vvvCommand,
  handleAutoViewOnce,
  getViewOnceMessage,
  getViewOnceMedia,
  downloadViewOnce,
  sendDecodedViewOnce,
  getQuotedMessage
};