"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║          GEMINI AI + GOOGLE SEARCH               ║
// ╚════════════════════════════════════════════════════╝

const { GoogleGenAI } = require("@google/genai");

/*
|--------------------------------------------------------------------------
| GEMINI CONFIGURATION
|--------------------------------------------------------------------------
*/

const GEMINI_API_KEY = String(
  process.env.GEMINI_API_KEY ||
  process.env.AI_API_KEY ||
  ""
).trim();

const GEMINI_MODEL = String(
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash"
).trim();

const GOOGLE_SEARCH_ENABLED =
  String(
    process.env.GEMINI_GOOGLE_SEARCH || "true"
  ).toLowerCase() === "true";

const SHOW_SOURCE_LINKS =
  String(
    process.env.GEMINI_SHOW_SOURCE_LINKS || "false"
  ).toLowerCase() === "true";

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY
    })
  : null;

/*
|--------------------------------------------------------------------------
| CONFIGURATION VALIDATION
|--------------------------------------------------------------------------
*/

function isAIConfigured() {
  return Boolean(
    ai &&
    GEMINI_API_KEY &&
    GEMINI_MODEL
  );
}

/*
|--------------------------------------------------------------------------
| CLEAN TEXT
|--------------------------------------------------------------------------
*/

function cleanResponse(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

/*
|--------------------------------------------------------------------------
| REMOVE LINKS FROM WHATSAPP ANSWERS
|--------------------------------------------------------------------------
*/

function removeSourceLinks(text) {
  if (SHOW_SOURCE_LINKS) {
    return cleanResponse(text);
  }

  let result = cleanResponse(text);

  // Remove Markdown links, keeping their readable labels.
  result = result.replace(
    /\[([^\]]+)\]\(https?:\/\/[^)\s]+\)/gi,
    "$1"
  );

  // Remove standalone URLs.
  result = result.replace(
    /https?:\/\/[^\s<>)\]]+/gi,
    ""
  );

  result = result.replace(
    /\bwww\.[^\s<>)\]]+/gi,
    ""
  );

  // Remove empty source/citation labels.
  result = result.replace(
    /^\s*(sources?|references?|sous|références?)\s*:\s*$/gim,
    ""
  );

  // Clean excess whitespace.
  result = result
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}

/*
|--------------------------------------------------------------------------
| DEFAULT SYSTEM PROMPT
|--------------------------------------------------------------------------
*/

function buildSystemPrompt(customPrompt, mode) {
  const basePrompt = [
    "You are the official AI assistant of TOPFEROS MD.",
    "Answer accurately, naturally, clearly and helpfully.",
    "Use the language selected by the user or the language of the question.",
    "Support Haitian Creole, French, English, Spanish, Portuguese and Chinese.",
    "For Haitian Creole, use natural and correct Haitian Creole.",
    "For current events, recent news, changing facts, prices, dates and updates,",
    "use Google Search when available before answering.",
    "Base current factual answers on information found through search.",
    "Never invent news, sources, dates or facts.",
    "If reliable current information cannot be found, say so clearly.",
    "Summarize information in your own words.",
    "Do not include URLs, hyperlinks or lists of source links in the answer.",
    "Do not claim to have searched if no search was actually performed.",
    "Never claim to perform actions you cannot perform.",
    "Keep answers appropriate for a general audience.",
    "Preserve the identity and name TOPFEROS MD.",
    "Do not add a bot footer unless the calling code requests one."
  ].join(" ");

  const modePrompt =
    mode === "chat"
      ? "Maintain conversational continuity using the supplied recent history."
      : "Answer the current question directly and stay focused on the request.";

  return [
    basePrompt,
    modePrompt,
    cleanResponse(customPrompt)
  ]
    .filter(Boolean)
    .join("\n\n");
}

/*
|--------------------------------------------------------------------------
| GEMINI GENERATION
|--------------------------------------------------------------------------
*/

async function generateAnswer(
  contents,
  systemPrompt,
  options = {}
) {
  if (!isAIConfigured()) {
    throw new Error(
      "Gemini AI is not configured. Check GEMINI_API_KEY and GEMINI_MODEL."
    );
  }

  const config = {
    systemInstruction: systemPrompt,

    temperature:
      typeof options.temperature === "number"
        ? options.temperature
        : 0.7,

    maxOutputTokens:
      typeof options.maxTokens === "number"
        ? options.maxTokens
        : 1200
  };

  /*
   * Google Search is a built-in Gemini tool.
   * Gemini decides when search is useful for the question.
   */

  if (GOOGLE_SEARCH_ENABLED) {
    config.tools = [
      {
        googleSearch: {}
      }
    ];
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config
  });

  const answer = cleanResponse(
    response?.text
  );

  if (!answer) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return removeSourceLinks(answer);
}

/*
|--------------------------------------------------------------------------
| ASK AI
|--------------------------------------------------------------------------
*/

async function askAI(prompt, options = {}) {
  const question = cleanResponse(prompt);

  if (!question) {
    throw new Error("AI prompt is empty.");
  }

  const systemPrompt = buildSystemPrompt(
    options.systemPrompt,
    "question"
  );

  return generateAnswer(
    question,
    systemPrompt,
    options
  );
}

/*
|--------------------------------------------------------------------------
| AI CHAT WITH CONVERSATION HISTORY
|--------------------------------------------------------------------------
*/

async function aiChat(
  prompt,
  history = [],
  options = {}
) {
  const question = cleanResponse(prompt);

  if (!question) {
    throw new Error(
      "AI chat message is empty."
    );
  }

  const contents = [];

  /*
   * Convert the existing history format into Gemini format.
   * Keep only recent, valid user and assistant messages.
   */

  if (Array.isArray(history)) {
    for (const item of history.slice(-12)) {
      if (
        !item ||
        !item.role ||
        typeof item.content !== "string" ||
        !item.content.trim()
      ) {
        continue;
      }

      const role =
        item.role === "assistant" ||
        item.role === "model"
          ? "model"
          : item.role === "user"
            ? "user"
            : null;

      if (!role) {
        continue;
      }

      contents.push({
        role,
        parts: [
          {
            text: cleanResponse(item.content)
          }
        ]
      });
    }
  }

  // Add the current user message.
  contents.push({
    role: "user",
    parts: [
      {
        text: question
      }
    ]
  });

  const systemPrompt = buildSystemPrompt(
    options.systemPrompt,
    "chat"
  );

  return generateAnswer(
    contents,
    systemPrompt,
    options
  );
}

/*
|--------------------------------------------------------------------------
| EXPORTS — KEEP EXISTING FUNCTION NAMES
|--------------------------------------------------------------------------
*/

module.exports = {
  askAI,
  aiChat,
  isAIConfigured
};