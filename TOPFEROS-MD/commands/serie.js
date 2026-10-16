
"use strict";

const axios = require("axios");
const { registerCommand } = require("../src/messageHandler");

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

  return (response.data.results || []).slice(0, 5);
}

async function serieCommand(ctx) {
  const query = String(ctx.text || "").trim();

  if (!query) {
    await ctx.send(
      [
        "📺 TOPFEROS MD — SERIE",
        "",
        "Itilizasyon:",
        `${ctx.prefix}serie non seri a`,
        "",
        "Egzanp:",
        `${ctx.prefix}serie Stranger Things`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return { success: false, reason: "Missing query." };
  }

  try {
    await ctx.send("🔎 M ap chèche seri a...");

    const results = await searchSeries(query);

    if (!results.length) {
      await ctx.send("❌ Mwen pa jwenn seri sa a.");
      return { success: false, reason: "No results." };
    }

    const lines = [
      "📺 TOPFEROS MD — REZILTA SERI",
      ""
    ];

    for (const [index, serie] of results.entries()) {
      const title =
        serie.name || "Tit pa disponib";

      const date =
        serie.first_air_date || "Dat pa disponib";

      const rating =
        typeof serie.vote_average === "number"
          ? serie.vote_average.toFixed(1) + "/10"
          : "Pa disponib";

      const overview =
        serie.overview || "Pa gen rezime disponib.";

      lines.push(
        `${index + 1}. ${title}`,
        `📅 Premye difizyon: ${date}`,
        `⭐ Nòt TMDB: ${rating}`,
        `📝 Rezime: ${overview.slice(0, 400)}`,
        `🔗 https://www.themoviedb.org/tv/${serie.id}`,
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
      "[SERIE COMMAND] Error:",
      error?.response?.data || error?.stack || error
    );

    const apiMessage =
      error?.response?.data?.status_message;

    await ctx.send(
      [
        "❌ RECHÈCH SERI A PA MACHE",
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

registerCommand("serie", serieCommand, {
  aliases: ["series", "tv"],
  description: "Chèche enfòmasyon sou seri televizyon.",
  usage: ".serie <non seri a>",
  category: "MEDIA"
});

module.exports = { serieCommand };
