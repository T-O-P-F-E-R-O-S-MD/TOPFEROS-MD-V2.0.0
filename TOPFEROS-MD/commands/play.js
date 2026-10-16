
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| PLAY COMMAND
|--------------------------------------------------------------------------
|
| .play song <non mizik oswa URL>
| .play vid <non videyo oswa URL>
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const axios = require("axios");

const {
  downloadMedia,
  isMediaFile,
  removeFile
} = require("../services/mediaDownloader");

const {
  convertToAudio,
  convertToVideo
} = require("../services/mediaConverter");

const YOUTUBE_API_KEY =
  process.env.YOUTUBE_API_KEY || "";

async function sendAudio(ctx, filePath) {
  if (!isMediaFile(filePath)) {
    throw new Error("Fichye odyo a pa egziste oswa li vid.");
  }

  await ctx.sock.sendMessage(
    ctx.jid,
    {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg",
      ptt: false
    },
    { quoted: ctx.message }
  );
}

async function sendVideo(ctx, filePath) {
  if (!isMediaFile(filePath)) {
    throw new Error("Fichye videyo a pa egziste oswa li vid.");
  }

  await ctx.sock.sendMessage(
    ctx.jid,
    {
      video: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      caption: "🎬 TOPFEROS MD MEDIA"
    },
    { quoted: ctx.message }
  );
}

async function searchYouTube(query, type) {
  if (!YOUTUBE_API_KEY) {
    throw new Error(
      "YOUTUBE_API_KEY pa konfigire nan Render."
    );
  }

  const searchQuery =
    type === "song"
      ? `${query} official audio`
      : query;

  const response = await axios.get(
    "https://www.googleapis.com/youtube/v3/search",
    {
      params: {
        part: "snippet",
        type: "video",
        maxResults: 5,
        q: searchQuery,
        key: YOUTUBE_API_KEY
      },
      timeout: 15000
    }
  );

  return (response.data.items || [])
    .filter(item => item.id && item.id.videoId)
    .map(item => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      videoId: item.id.videoId,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));
}

async function playCommand(ctx) {
  const input = String(ctx.text || "").trim();

  if (!input) {
    await ctx.send(
      [
        "🎵 TOPFEROS MD PLAY",
        "",
        "🎵 Chèche mizik:",
        `${ctx.prefix}play song non mizik la`,
        "",
        "🎬 Chèche videyo:",
        `${ctx.prefix}play vid non videyo a`,
        "",
        "🔗 URL medya ki sipòte:",
        `${ctx.prefix}play song URL`,
        `${ctx.prefix}play vid URL`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "Missing input."
    };
  }

  const match = input.match(/^(\S+)\s+([\s\S]+)$/);

  if (!match) {
    await ctx.send(
      [
        "❌ Ou dwe presize kalite medya a ak non an oswa URL la.",
        "",
        `${ctx.prefix}play song non mizik la`,
        `${ctx.prefix}play vid non videyo a`
      ].join("\n")
    );

    return {
      success: false,
      reason: "Missing query or URL."
    };
  }

  const type = match[1].toLowerCase();
  const queryOrUrl = match[2].trim();

  if (!["song", "vid"].includes(type)) {
    await ctx.send(
      [
        "❌ Kalite medya sa a pa valab.",
        "",
        `${ctx.prefix}play song non mizik la`,
        `${ctx.prefix}play vid non videyo a`
      ].join("\n")
    );

    return {
      success: false,
      reason: "Invalid media type."
    };
  }

  if (!queryOrUrl) {
    await ctx.send("❌ Mete non medya a oswa URL la.");

    return {
      success: false,
      reason: "Missing query or URL."
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(queryOrUrl);
  } catch {
    parsedUrl = null;
  }

  /*
  |--------------------------------------------------------------------------
  | SEARCH BY NAME
  |--------------------------------------------------------------------------
  */

  if (!parsedUrl) {
    try {
      await ctx.send(
        type === "song"
          ? "🔎 M ap chèche mizik la..."
          : "🔎 M ap chèche videyo a..."
      );

      const results = await searchYouTube(
        queryOrUrl,
        type
      );

      if (!results.length) {
        await ctx.send(
          "❌ Mwen pa jwenn rezilta pou rechèch sa a."
        );

        return {
          success: false,
          reason: "No search results."
        };
      }

      const lines = [
        type === "song"
          ? "🎵 TOPFEROS MD — REZILTA MIZIK"
          : "🎬 TOPFEROS MD — REZILTA VIDEYO",
        ""
      ];

      results.forEach((item, index) => {
        lines.push(
          `${index + 1}. ${item.title}`,
          `🎤 Chèn: ${item.channel}`,
          `🔗 ${item.url}`,
          ""
        );
      });

      lines.push(
        "ℹ️ Rechèch sa a bay lyen yo; li pa telechaje fichye yo.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      );

      await ctx.send(lines.join("\n"));

      return {
        success: true,
        action: "search",
        type,
        count: results.length,
        results
      };
    } catch (error) {
      console.error(
        "[PLAY SEARCH] Error:",
        error?.response?.data || error?.stack || error
      );

      const apiMessage =
        error?.response?.data?.error?.message;

      await ctx.send(
        [
          "❌ RECHÈCH LA PA MACHE",
          "",
          apiMessage || error.message || "Erè enkoni.",
          "",
          "Verifye YOUTUBE_API_KEY la ak YouTube Data API v3.",
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );

      return {
        success: false,
        error: apiMessage || error.message
      };
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PROCESS DIRECT URL
  |--------------------------------------------------------------------------
  */

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    await ctx.send(
      "❌ URL la dwe kòmanse ak http:// oswa https://."
    );

    return {
      success: false,
      reason: "Invalid URL protocol."
    };
  }

  let downloadedFile = null;
  let convertedFile = null;

  try {
    await ctx.send(
      [
        "⏳ TOPFEROS MD MEDIA",
        "",
        "📥 M ap telechaje oswa prepare medya a...",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    const download = await downloadMedia(queryOrUrl);

    downloadedFile = download.path;

    if (!isMediaFile(downloadedFile)) {
      throw new Error(
        "Fichye medya ki telechaje a pa valab."
      );
    }

    await ctx.send(
      "⚙️ M ap konvèti fichye a pou WhatsApp..."
    );

    if (type === "song") {
      convertedFile = await convertToAudio(downloadedFile);
      await sendAudio(ctx, convertedFile);
    } else {
      convertedFile = await convertToVideo(downloadedFile);
      await sendVideo(ctx, convertedFile);
    }

    return {
      success: true,
      type,
      action: "send"
    };
  } catch (error) {
    console.error(
      "[PLAY COMMAND] Error:",
      error?.stack || error
    );

    try {
      await ctx.send(
        [
          "❌ TOPFEROS MD MEDIA",
          "",
          "Mwen pa t kapab trete oswa voye medya sa a.",
          `Rezon: ${error?.message || "Erè enkoni."}`,
          "",
          "Verifye URL la epi eseye yon lòt sous medya ki otorize telechajman.",
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );
    } catch (sendError) {
      console.error(
        "[PLAY COMMAND] Could not send error message:",
        sendError.message
      );
    }

    return {
      success: false,
      error: error?.message || String(error)
    };
  } finally {
    if (convertedFile) {
      removeFile(convertedFile);
    }

    if (downloadedFile) {
      removeFile(downloadedFile);
    }
  }
}

module.exports = {
  playCommand
};
