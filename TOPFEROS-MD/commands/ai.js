
"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║                    AI COMMAND                     ║
// ╚════════════════════════════════════════════════════╝

const {
  askAI,
  isAIConfigured
} = require("../services/ai");

function getForwardNotice(text) {
  const value = String(text || "").toLowerCase();

  if (
    /\b(bonjou|bonswa|mwen|ou|oubyen|kijan|poukisa|kisa|tanpri|mèsi|mesi|eske|èske|kounye|kapab|konvèsasyon)\b/.test(value)
  ) {
    return "💬 *Pou kontinye konvèsasyon an:* Fè *Forward* mesaj sa a tounen ban mwen pou m ka reprann konvèsasyon an kote nou te rete a. 🤖";
  }

  if (
    /\b(bonjour|bonsoir|merci|comment|pourquoi|qu'est-ce|vous|nous|conversation|continuer|aide)\b/.test(value)
  ) {
    return "💬 *Pour continuer cette conversation :* Transférez-moi ce message afin que je puisse reprendre notre échange là où nous nous sommes arrêtés. 🤖";
  }

  if (
    /\b(hello|hi|thanks|please|what|why|how|you|your|continue|conversation|help)\b/.test(value)
  ) {
    return "💬 *To continue this conversation:* Forward this message back to me so I can pick up where we left off. 🤖";
  }

  if (
    /\b(hola|gracias|por favor|cómo|como|ayuda|conversación|continuar)\b/.test(value)
  ) {
    return "💬 *Para continuar esta conversación:* Reenvíame este mensaje para que podamos retomar desde donde nos quedamos. 🤖";
  }

  return "💬 *Pou kontinye konvèsasyon an:* Fè *Forward* mesaj sa a tounen ban mwen pou m ka reprann konvèsasyon an kote nou te rete a. 🤖";
}

async function aiCommand(ctx) {
  const text = String(ctx?.text || "").trim();
  const prefix = String(ctx?.prefix || ".");

  if (!text) {
    await ctx.send([
      "🤖 TOPFEROS MD AI",
      "",
      "Please provide a question.",
      "",
      `Example: ${prefix}ai What is artificial intelligence?`,
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n"));

    return {
      success: false,
      reason: "Empty question."
    };
  }

  if (!isAIConfigured()) {
    await ctx.send([
      "🤖 TOPFEROS MD AI",
      "",
      "❌ Gemini AI is not configured.",
      "",
      "Please check GEMINI_API_KEY and GEMINI_MODEL.",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n"));

    return {
      success: false,
      reason: "AI is not configured."
    };
  }

  try {
    const answer = await askAI(text, {
      systemPrompt: [
        "You are the official AI assistant of TOPFEROS MD V2.0.0.",
        "Give accurate, useful, clear and natural answers.",
        "Answer in the same language as the user's question.",
        "Support Haitian Creole, French, English, Spanish, Portuguese and Chinese.",
        "If the user asks a question, answer it directly without an unnecessary greeting or introduction.",
        "If the user greets you, respond with an appropriate greeting.",
        "Use Google Search when current information is needed and the search tool is available.",
        "Never invent facts or claim you searched if you did not.",
        "If information is uncertain, say so clearly.",
        "Keep answers suitable for a general audience.",
        "Do not write the forwarding notice yourself; the calling code adds it below your answer."
      ].join(" "),
      temperature: 0.7,
      maxTokens: 1500
    });

    if (!answer) {
      throw new Error("Gemini returned an empty response.");
    }

    const notice = getForwardNotice(text + " " + answer);

    await ctx.send([
      "🤖 TOPFEROS MD AI",
      "",
      answer,
      "",
      "━━━━━━━━━━━━━━",
      notice,
      "━━━━━━━━━━━━━━",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n"));

    return {
      success: true,
      answer
    };
  } catch (error) {
    console.error(
      "[TOPFEROS MD AI COMMAND] Error:",
      error?.stack || error
    );

    await ctx.send([
      "🤖 TOPFEROS MD AI",
      "",
      "❌ The AI request failed.",
      "",
      "Please try again later.",
      "",
      "🦁 TECH BY TOPFEROS MD 🐑"
    ].join("\n"));

    return {
      success: false,
      reason: error?.message || String(error)
    };
  }
}

module.exports = {
  aiCommand
};
