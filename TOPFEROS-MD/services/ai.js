
"use strict";

const { GoogleGenAI } = require("@google/genai");

const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY;

const MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getAIClient() {
  if (!API_KEY) {
    throw new Error(
      "Gemini API key is missing. Set GEMINI_API_KEY in .env or Railway Variables."
    );
  }

  return new GoogleGenAI({
    apiKey: API_KEY
  });
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(item =>
      item &&
      ["user", "assistant", "model"].includes(item.role) &&
      typeof item.content === "string" &&
      item.content.trim()
    )
    .map(item => ({
      role:
        item.role === "assistant" || item.role === "model"
          ? "model"
          : "user",
      parts: [
        {
          text: item.content.trim()
        }
      ]
    }));
}

async function askAI(prompt, options = {}) {
  const text = String(prompt || "").trim();

  if (!text) {
    throw new Error("AI prompt cannot be empty.");
  }

  const ai = getAIClient();

  const history = normalizeHistory(options.history);

  // The latest user message may already be in the supplied history.
  // Remove it from history because it is sent separately below.
  if (
    history.length > 0 &&
    history[history.length - 1].role === "user" &&
    history[history.length - 1].parts[0].text === text
  ) {
    history.pop();
  }

  const config = {
    systemInstruction:
      String(options.systemPrompt || "You are a helpful AI assistant."),
    temperature:
      Number.isFinite(Number(options.temperature))
        ? Number(options.temperature)
        : 0.7,
    maxOutputTokens:
      Number.isFinite(Number(options.maxTokens))
        ? Number(options.maxTokens)
        : 1500
  };

  const chat = ai.chats.create({
    model: MODEL,
    history,
    config
  });

  const response = await chat.sendMessage({
    message: text
  });

  const answer = String(response.text || "").trim();

  if (!answer) {
    throw new Error(
      "Gemini returned an empty response. Please try again."
    );
  }

  return answer;
}

async function aiChat(prompt, history = [], options = {}) {
  return askAI(prompt, {
    ...options,
    history
  });
}

function isAIConfigured() {
  return Boolean(API_KEY);
}

module.exports = {
  askAI,
  aiChat,
  isAIConfigured
};
