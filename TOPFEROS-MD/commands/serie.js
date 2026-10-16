
"use strict";

const axios = require("axios");
const { registerCommand } = require("../src/messageHandler");

const {
  downloadAndSendVideo
} = require("../services/authorizedVideoSearch");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

async function searchSeries(query) {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY pa konfigire nan Render.");
  }

  const response = await axios.get(
    "https://api.themoviedb.org/3/search/tv",
    {
      params: {
        query,
        language: "fr-FR",
        page: 1,
        api_key: TMDB_API_KEY
      },
      timeout: 15000
    }
  );

  return response.data.results || [];
}

async function serieCommand(ctx) {
  const query = String(ctx.text || "").trim();

  if (!query) {
    await ctx.send(
      `📺 Itilizasyon: ${ctx.prefix}serie non seri a`
    );
    return { success: false };
  }

  try {
    await ctx.send("🔎 M ap verifye tit seri a sou TMDB...");

    const results = await searchSeries(query);
    const serie = results[0];

    if (!serie) {
      await ctx.send("❌ Mwen pa jwenn seri sa a sou TMDB.");
      return { success: false };
    }

    await ctx.send(
      "📺 Seri mwen jwenn:\n" +
      `Tit: ${serie.name}\n` +
      `Premye difizyon: ${serie.first_air_date || "Pa disponib"}\n` +
      `Nòt: ${Number(serie.vote_average || 0).toFixed(1)}/10\n` +
      `Rezime: ${(serie.overview || "Pa gen rezime.").slice(0, 350)}`
    );

    return await downloadAndSendVideo(
      ctx,
      serie.name,
      "seri"
    );
  } catch (error) {
    console.error("[SERIE]", error?.stack || error);

    await ctx.send(
      "❌ Rechèch seri a echwe: " +
      (error.message || "Erè enkoni.")
    );

    return { success: false, error: error.message };
  }
}

registerCommand("serie", serieCommand, {
  aliases: ["series", "tv"],
  description: "Chèche yon seri epi voye videyo ki otorize si disponib.",
  usage: ".serie <non seri a>",
  category: "MEDIA"
});

module.exports = { serieCommand };
