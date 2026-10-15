
"use strict";

require("dotenv").config();

const { askAI, isAIConfigured } = require("./services/ai");

async function testAI() {
  console.log("1. Konfigirasyon AI:", isAIConfigured());

  if (!isAIConfigured()) {
    console.log("ERÈ: GEMINI_API_KEY oswa GEMINI_MODEL manke.");
    process.exitCode = 1;
    return;
  }

  try {
    const answer = await askAI(
      "Reponn sèlman: TOPFEROS MD AI konekte!"
    );

    console.log("2. REPONS GEMINI:", answer);
    console.log("TÈS REYISI: Gemini reponn.");
  } catch (error) {
    console.error("TÈS ECHWE:", error.message);
    process.exitCode = 1;
  }
}

testAI();
