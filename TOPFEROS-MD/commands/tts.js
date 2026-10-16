"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                    TTS COMMAND                   ║
// ╚════════════════════════════════════════════════════╝

const axios = require("axios");

const {
  registerCommand
} = require("../src/messageHandler");

async function ttsCommand(ctx) {
  const text =
    String(ctx.text || "").trim();

  if (!text) {
    await ctx.send(
      [
        "❌ TEXT REQUIRED",
        "",
        "Use:",
        `${ctx.prefix}tts Your text here`,
        "",
        "Example:",
        `${ctx.prefix}tts Hello, welcome to TOPFEROS MD`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason:
        "No text provided."
    };
  }

  try {
    const url =
      "https://translate.google.com/translate_tts";

    const response =
      await axios.get(
        url,
        {
          params: {
            ie: "UTF-8",
            q: text,
            tl: "en",
            client: "tw-ob"
          },
          responseType:
            "arraybuffer",
          headers: {
            "User-Agent":
              "Mozilla/5.0"
          },
          timeout: 15000
        }
      );

        const audio = Buffer.from(response.data);

    if (
      !audio.length ||
      audio.length < 100
    ) {
      throw new Error(
        "TTS returned empty or invalid audio."
      );
    }

    // Verifye si repons lan sanble ak yon MP3.
    const isMp3 =
      audio.length > 3 &&
      (
        audio.subarray(0, 3).toString() === "ID3" ||
        (
          audio[0] === 0xff &&
          (audio[1] & 0xe0) === 0xe0
        )
      );

    if (!isMp3) {
      throw new Error(
        "TTS provider did not return valid MP3 audio."
      );
    }

    await ctx.sock.sendMessage(
      ctx.jid,
      {
        audio,
        mimetype: "audio/mpeg",
        ptt: false
      },
      {
        quoted: ctx.message
      }
    );

    return {
      success: true
    };
  } catch (error) {
    console.error(
      "[TTS] Error:",
      error?.stack ||
        error
    );

    await ctx.send(
      [
        "❌ TTS FAILED",
        "",
        "I could not generate the voice message.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      error:
        error?.message ||
        String(error)
    };
  }
}

registerCommand(
  "tts",
  ttsCommand,
  {
    aliases: [
      "say"
    ],
    description:
      "Convert text into a voice message.",
    usage:
      ".tts <text>",
    category:
      "MEDIA"
  }
);

module.exports = {
  ttsCommand
};