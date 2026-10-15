
"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║             GEMINI AI COMMAND                     ║
// ╚════════════════════════════════════════════════════╝

const {
  askAI,
  isAIConfigured
} = require("../services/ai");

/*
|--------------------------------------------------------------------------
| AI COMMAND
|--------------------------------------------------------------------------
*/

async function aiCommand(ctx) {
  const text = String(
    ctx?.text || ""
  ).trim();

  const prefix = String(
    ctx?.prefix || "."
  );

  if (!text) {
    await ctx.send(
      [
        "🤖 TOPFEROS MD AI",
        "",
        "Please provide a question.",
        "",
        `Example: ${prefix}ai What is artificial intelligence?`,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "Empty question."
    };
  }

  if (!isAIConfigured()) {
    await ctx.send(
      [
        "🤖 TOPFEROS MD AI",
        "",
        "❌ Gemini AI is not configured.",
        "",
        "Please check GEMINI_API_KEY and GEMINI_MODEL.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: "AI is not configured."
    };
  }

  try {
    const answer = await askAI(
      text,
      {
        systemPrompt: [
          "You are the official AI assistant of TOPFEROS MD V2.0.0.",
          "Give accurate, useful, clear and natural answers.",
          "Answer in the same language as the user's question.",
          "Support Haitian Creole, French, English, Spanish, Portuguese and Chinese.",
          "Use Google Search when current information is needed and the search tool is available.",
          "Never invent facts or claim you searched if you did not.",
          "If information is uncertain, say so clearly.",
          "Keep answers suitable for a general audience.",
          "Do not add the bot footer because the calling code adds it."
        ].join(" "),

        temperature: 0.7,
        maxTokens: 1500
      }
    );

    if (!answer) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    await ctx.send(
      [
        "🤖 TOPFEROS MD AI",
        "",
        answer,
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: true,
      answer
    };
  } catch (error) {
    console.error(
      "[TOPFEROS MD AI COMMAND] Error:",
      error?.stack || error
    );

    await ctx.send(
      [
        "🤖 TOPFEROS MD AI",
        "",
        "❌ The AI request failed.",
        "",
        "Please try again later.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return {
      success: false,
      reason: error?.message || String(error)
    };
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  aiCommand
};
