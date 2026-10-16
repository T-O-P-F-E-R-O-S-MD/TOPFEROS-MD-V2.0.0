
"use strict";

const axios = require("axios");
const { registerCommand } = require("../src/messageHandler");

const {
  downloadAndSendVideo
} = require("../services/authorizedVideoSearch");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

async function searchFilms(query) {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY pa konfigire nan Render.");
  }

  const response = await axios.get(
    "https://api.themoviedb.org/3/search/movie",
    {
      params: {
        query,
        language: "fr-FR",
        include_adult: false,
        page: 1,
        api_key: TMDB_API_KEY
      },
      timeout: 15000
    }
  );

  return response.data.results || [];
}

async function filmCommand(ctx) {
  const query = String(ctx.text || "").trim();

  if (!query) {
    await ctx.send(
      `🎬 Itilizasyon: ${ctx.prefix}film non fim nan`
    );
    return { success: false };
  }

  try {
    await ctx.send("🔎 M ap verifye tit fim nan sou TMDB...");

    const results = await searchFilms(query);
    const film = results[0];

    if (!film) {
      await ctx.send("❌ Mwen pa jwenn fim sa a sou TMDB.");
      return { success: false };
    }

    await ctx.send(
      "🎬 Fim mwen jwenn:\n" +
      `Tit: ${film.title}\n` +
      `Dat sòti: ${film.release_date || "Pa disponib"}\n` +
      `Nòt: ${Number(film.vote_average || 0).toFixed(1)}/10\n` +
      `Rezime: ${(film.overview || "Pa gen rezime.").slice(0, 350)}`
    );

    return await downloadAndSendVideo(
      ctx,
      film.title,
      "fim"
    );
  } catch (error) {
    console.error("[FILM]", error?.stack || error);

    await ctx.send(
      "❌ Rechèch fim nan echwe: " +
      (error.message || "Erè enkoni.")
    );

    return { success: false, error: error.message };
  }
}

registerCommand("film", filmCommand, {
  aliases: ["movie", "movies"],
  description: "Chèche yon fim epi voye videyo ki otorize si disponib.",
  usage: ".film <non fim nan>",
  category: "MEDIA"
});

module.exports = { filmCommand };
