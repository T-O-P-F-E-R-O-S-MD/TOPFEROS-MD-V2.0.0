
"use strict";

const axios = require("axios");
const { askAI } = require("./ai");

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| AI STATUS REACTION SERVICE
| GEMINI + SMART EMOJI FALLBACK
|--------------------------------------------------------------------------
*/

const DEFAULT_TIMEOUT = 15000;

/*
|--------------------------------------------------------------------------
| SMART FALLBACK EMOJI
|--------------------------------------------------------------------------
*/

const FALLBACK_EMOJIS = [
  "❤️", "💚", "💙", "💜", "💕", "💖",
  "😍", "🥰", "😘", "😊", "😎", "🤩",
  "😂", "🤣", "😅", "😁", "😄", "😆",
  "🔥", "💯", "👏", "🙌", "💪", "🚀",
  "✨", "🌟", "⭐", "🎉", "🥳", "🏆",
  "🙏", "🤲", "🕊️", "😇", "🤍",
  "😢", "😭", "💔", "🥺", "😔", "😞",
  "🤔", "😮", "😱", "👀", "😲", "🤯",
  "👍", "👌", "🤝", "👑", "🌹", "🌍",
  "🎶", "🎵", "🎧", "⚽", "🏀", "🎮",
  "🎂", "🎊", "🌺", "🌞", "💐",

  // Nouvo emoji TOPFEROS MD
  "🤭", "🥶", "😶‍🌫️", "🫥", "👹", "☠️",
  "👻", "🥴", "🧠", "👰🏼‍♂️", "👰", "🧟",
  "🧚‍♀️", "🧜‍♂️", "🦁", "🐜", "🌚", "🌈",
  "🍇", "🎇", "🌃", "🌌", "🪦", "🩻",
  "🛏️", "🛌🏿", "💘", "❤️‍🔥", "🔴", "🇭🇹"
];

function randomEmoji(emojis) {
  return emojis[
    Math.floor(Math.random() * emojis.length)
  ];
}

function getFallbackEmoji(statusData = {}) {
  const text = String(
    statusData.text ||
    statusData.caption ||
    ""
  ).toLowerCase();

  const categories = [
    {
      pattern: /amour|love|renmen|cheri|bébé|heart|lanmou/i,
      emojis: ["❤️", "🥰", "😍", "💕", "💖"]
    },
    {
      pattern: /lol|mdr|haha|blag|funny|drôle|😂|🤣/i,
      emojis: ["😂", "🤣", "😆", "😅"]
    },
    {
      pattern: /bondye|dieu|god|jesus|jésus|prière|lapriyè|amen/i,
      emojis: ["🙏", "🤲", "🕊️", "😇"]
    },
    {
      pattern: /triste|sad|cry|kriye|doulè|mouri|décès|rip/i,
      emojis: ["😢", "🥺", "😔", "💔"]
    },
    {
      pattern: /success|succès|reyisi|motivation|travay|objectif|goal/i,
      emojis: ["💪", "🔥", "🚀", "🏆", "💯"]
    },
    {
      pattern: /anniversaire|birthday|fèt|celebration|félicitations/i,
      emojis: ["🎉", "🥳", "🎂", "🎊"]
    },
    {
      pattern: /football|foutbòl|soccer|match|goal|but/i,
      emojis: ["⚽", "🏆", "🔥", "👏"]
    },
    {
      pattern: /music|musique|mizik|song|chanson/i,
      emojis: ["🎶", "🎵", "🎧", "🔥"]
    }
  ];

  for (const category of categories) {
    if (category.pattern.test(text)) {
      return randomEmoji(category.emojis);
    }
  }

  return randomEmoji(FALLBACK_EMOJIS);
}

/*
|--------------------------------------------------------------------------
| EXTRACT EMOJI
|--------------------------------------------------------------------------
*/

function extractEmoji(text) {
  if (typeof text !== "string") {
    return null;
  }

  const value = text
    .replace(/```/g, "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "");

  if (!value) {
    return null;
  }

  const emojiRegex =
    /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/gu;

  const matches = value.match(emojiRegex);

  return matches?.[0] || null;
}

/*
|--------------------------------------------------------------------------
| EXTRACT AI TEXT
|--------------------------------------------------------------------------
*/

function extractAIText(response) {
  if (!response) {
    return "";
  }

  if (typeof response === "string") {
    return response.trim();
  }

  const data = response.data || response;

  const content =
    data?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(item =>
        typeof item === "string"
          ? item
          : item?.text || ""
      )
      .join("")
      .trim();
  }

  const completion =
    data?.choices?.[0]?.text;

  if (typeof completion === "string") {
    return completion.trim();
  }

  const geminiParts =
    data?.candidates?.[0]?.content?.parts;

  if (Array.isArray(geminiParts)) {
    return geminiParts
      .map(part => part?.text || "")
      .join("")
      .trim();
  }

  return String(
    data?.response ||
    data?.text ||
    ""
  ).trim();
}

/*
|--------------------------------------------------------------------------
| BUILD STATUS PROMPT
|--------------------------------------------------------------------------
*/

function buildPrompt(statusData = {}) {
  const text = String(
    statusData.text ||
    statusData.caption ||
    ""
  ).trim();

  const mediaType = String(
    statusData.mediaType || "none"
  ).toLowerCase();

  return [
    "You are TOPFEROS MD V2.0.0 AI Status Reaction.",
    "",
    "Analyze this WhatsApp Status.",
    "Choose exactly ONE natural Unicode emoji.",
    "",
    "STRICT RULES:",
    "- Return exactly ONE emoji.",
    "- No words or explanations.",
    "- No punctuation.",
    "- No multiple emojis.",
    `- You may choose any suitable emoji, including these: ${FALLBACK_EMOJIS.join(" ")}`,
    "- Match the status emotion and meaning.",
    "- Match romance, humor, sadness, motivation,",
    "  celebration, faith, music and sports naturally.",
    "- Never invent information.",
    "- For unknown content choose a neutral emoji.",
    "",
    `STATUS TEXT: ${text || "[No text or caption]"}`,
    `MEDIA TYPE: ${mediaType}`,
    "",
    "Return ONE emoji only."
  ].join("\n");
}

/*
|--------------------------------------------------------------------------
| CALL AI
|--------------------------------------------------------------------------
*/

async function callAI(prompt, options = {}) {
  const apiUrl = String(
    options.apiUrl ||
    process.env.AI_API_URL ||
    ""
  ).trim();

  if (apiUrl) {
    const apiKey = String(
      options.apiKey ||
      process.env.AI_API_KEY ||
      ""
    ).trim();

    const model = String(
      options.model ||
      process.env.AI_MODEL ||
      "gpt-4o-mini"
    ).trim();

    const headers = {
      "Content-Type": "application/json"
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await axios.post(
      apiUrl,
      {
        model,
        messages: [
          {
            role: "system",
            content:
              "Return exactly one appropriate Unicode emoji."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature:
          options.temperature ?? 0.4,
        max_tokens:
          options.maxTokens ?? 20
      },
      {
        headers,
        timeout:
          Number(
            options.timeout ||
            process.env.AI_TIMEOUT_MS ||
            DEFAULT_TIMEOUT
          ) || DEFAULT_TIMEOUT
      }
    );

    return extractAIText(response);
  }

  /*
  |--------------------------------------------------------------------------
  | EXISTING GEMINI SERVICE
  |--------------------------------------------------------------------------
  */

  if (typeof askAI !== "function") {
    throw new Error(
      "Gemini askAI service is unavailable."
    );
  }

  const response = await askAI(prompt, {
    systemPrompt:
      "Return exactly ONE appropriate Unicode emoji. No words.",
    temperature:
      options.temperature ?? 0.4,
    maxTokens:
      options.maxTokens ?? 20
  });

  return extractAIText(response);
}

/*
|--------------------------------------------------------------------------
| CHOOSE EMOJI WITH SOURCE TRACKING
|--------------------------------------------------------------------------
*/

async function chooseEmojiWithSource(
  statusData = {},
  options = {}
) {
  try {
    const prompt = buildPrompt(statusData);

    const response = await callAI(
      prompt,
      options
    );

    const emoji = extractEmoji(response);

    if (emoji) {
      return {
        emoji,
        source: "ai"
      };
    }

    console.warn(
      "[AI REACTION] Invalid AI response. Using smart fallback."
    );

  } catch (error) {
    console.error(
      "[AI REACTION] AI request failed:",
      error?.message || error
    );
  }

  return {
    emoji: getFallbackEmoji(statusData),
    source: "fallback"
  };
}

/*
|--------------------------------------------------------------------------
| CHOOSE EMOJI
|--------------------------------------------------------------------------
*/

async function chooseEmoji(
  statusData = {},
  options = {}
) {
  const result = await chooseEmojiWithSource(
    statusData,
    options
  );

  return result.emoji;
}

/*
|--------------------------------------------------------------------------
| ANALYZE STATUS
|--------------------------------------------------------------------------
*/

async function analyzeStatus(
  statusData = {},
  options = {}
) {
  const result = await chooseEmojiWithSource(
    statusData,
    options
  );

  return {
    emoji: result.emoji,
    source: result.source,

    statusText: String(
      statusData.text ||
      statusData.caption ||
      ""
    ).trim(),

    mediaType:
      statusData.mediaType || "none",

    messageId:
      statusData.messageId || null,

    participant:
      statusData.participant || null
  };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  chooseEmoji,
  analyzeStatus,
  extractEmoji,
  extractAIText,
  buildPrompt,
  callAI,
  getFallbackEmoji
};
