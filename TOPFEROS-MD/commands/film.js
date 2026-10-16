
"use strict";

const axios = require("axios");
const { registerCommand } = require("../src/messageHandler");

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

  return (response.data.results || []).slice(0, 5);
}

async function filmCommand(ctx) {
  const query = String(ctx.text || "").trim();

  if (!query) {
    await ctx.send(
      [
        "🎬 TOPFEROS MD — FILM",
        "",
        "Itilizasyon:",
        `${ctx.prefix}film non fim nan`,
        "",
        "Egzanp:",
        `${ctx.prefix}film Spider-Man`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return { success: false, reason: "Missing query." };
  }

  try {
    await ctx.send("🔎 M ap chèche fim nan...");

    const results = await searchFilms(query);

    if (!results.length) {
      await ctx.send("❌ Mwen pa jwenn fim sa a.");
      return { success: false, reason: "No results." };
    }

    const lines = [
      "🎬 TOPFEROS MD — REZILTA FIM",
      ""
    ];

    for (const [index, film] of results.entries()) {
      const title = film.title || "Tit pa disponib";
      const date = film.release_date || "Dat pa disponib";
      const rating =
        typeof film.vote_average === "number"
          ? film.vote_average.toFixed(1) + "/10"
          : "Pa disponib";
      const overview =
        film.overview || "Pa gen rezime disponib.";

      lines.push(
        `${index + 1}. ${title}`,
        `📅 Dat sòti: ${date}`,
        `⭐ Nòt TMDB: ${rating}`,
        `📝 Rezime: ${overview.slice(0, 400)}`,
        `🔗 https://www.themoviedb.org/movie/${film.id}`,
        ""
      );
    }

    lines.push("🦁 TECH BY TOPFEROS MD 🐑");

    await ctx.send(lines.join("\n"));

    return {
      success: true,
      count: results.length
    };
  } catch (error) {
    console.error(
      "[FILM COMMAND] Error:",
      error?.response?.data || error?.stack || error
    );

    const apiMessage =
      error?.response?.data?.status_message;

    await ctx.send(
      [
        "❌ RECHÈCH FIM NAN PA MACHE",
        "",
        apiMessage || error?.message || "Erè enkoni.",
        "",
        "Verifye TMDB_API_KEY la nan Render.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      error: apiMessage || error?.message
    };
  }
}

registerCommand("film", filmCommand, {
  aliases: ["movie", "movies"],
  description: "Chèche enfòmasyon sou fim.",
  usage: ".film <non fim nan>",
  category: "MEDIA"
});

module.exports = { filmCommand };
