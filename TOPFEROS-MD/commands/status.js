"use strict";

const {
  getBaileys
} = require("../services/baileysRuntime");

const {
  STATUS_JID,
  getStatusContent
} = require("../src/statusHandler");

/*
|--------------------------------------------------------------------------
| GET QUOTED STATUS
|--------------------------------------------------------------------------
*/

function getQuotedMessage(message) {
  const content = message?.message;

  if (!content) return null;

  const containers = [
    content.extendedTextMessage,
    content.imageMessage,
    content.videoMessage,
    content.documentMessage
  ];

  for (const container of containers) {
    const contextInfo = container?.contextInfo;

    if (contextInfo?.remoteJid === STATUS_JID) {
      return {
        message: contextInfo.quotedMessage,
        participant: contextInfo.participant || null
      };
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| DOWNLOAD STATUS MEDIA — BAILEYS 7.x
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| SAVE / SEND STATUS
|--------------------------------------------------------------------------
*/

async function statusCommand(ctx, action) {
  const quoted = getQuotedMessage(ctx.message);

  if (!quoted?.message) {
    await ctx.send(
      [
        `❌ STATUS ${action.toUpperCase()}`,
        "",
        "Tanpri reponn Status WhatsApp la.",
        `Apre sa, voye ${action} san prefix.`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "status-not-quoted"
    };
  }

  const status = getStatusContent({
    message: quoted.message
  });

  const mediaTypes = [
    "image",
    "video",
    "audio"
  ];

  try {
    if (mediaTypes.includes(status.type)) {
      const media = status.content;

      const buffer = await downloadMedia(
        media,
        status.type
      );

      const caption =
        media.caption || "";

      const payload = {
        caption:
          caption || undefined
      };

      if (status.type === "image") {
        payload.image = buffer;
        payload.mimetype =
          media.mimetype || "image/jpeg";
      } else if (status.type === "video") {
        payload.video = buffer;
        payload.mimetype =
          media.mimetype || "video/mp4";
      } else {
        payload.audio = buffer;
        payload.mimetype =
          media.mimetype || "audio/ogg";
        payload.ptt = false;
      }

      await ctx.sock.sendMessage(
        ctx.jid,
        payload,
        {
          quoted: ctx.message
        }
      );
    } else if (status.type === "text") {
      await ctx.sock.sendMessage(
        ctx.jid,
        {
          text: String(status.content || "")
        },
        {
          quoted: ctx.message
        }
      );
    } else {
      await ctx.send(
        [
          "❌ Kalite Status sa a poko sipòte.",
          "",
          `Kalite: ${status.type}`,
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false,
        reason: "unsupported-status-type",
        type: status.type
      };
    }

    return {
      success: true,
      action,
      type: status.type,
      participant: quoted.participant
    };
  } catch (error) {
    console.error(
      `[STATUS ${action.toUpperCase()}]`,
      error?.stack || error
    );

    await ctx.send(
      [
        `❌ STATUS ${action.toUpperCase()} FAILED`,
        "",
        "Bot la pa t kapab jwenn medya Status la.",
        "Eseye ankò ak yon Status ki toujou disponib.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "media-processing-failed"
    };
  }
}

/*
|--------------------------------------------------------------------------
| COMMAND HANDLERS
|--------------------------------------------------------------------------
*/

async function saveCommand(ctx) {
  return statusCommand(ctx, "save");
}

async function sendCommand(ctx) {
  return statusCommand(ctx, "send");
}

module.exports = {
  saveCommand,
  sendCommand
};