
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// WHATSAPP TRANSLATOR

const fs = require("fs");
const path = require("path");

const { GoogleGenAI } = require("@google/genai");
const languageService = require("./language");

const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const FOOTER = "🦁 TECH BY TOPFEROS MD 🐑";
const BRAND = "TOPFEROS MD";
const LANGUAGE_FILE = "language.json";
const cache = new Map();
let warnedMissingKey = false;

function languageFile(sessionPath) {
  return path.join(sessionPath, LANGUAGE_FILE);
}

function readSessionLanguage(sessionPath, fallback = "en") {
  try {
    const data = JSON.parse(
      fs.readFileSync(languageFile(sessionPath), "utf8")
    );
    return languageService.normalizeLanguage(
      data.language || fallback
    );
  } catch {
    return languageService.normalizeLanguage(fallback);
  }
}

function saveSessionLanguage(sessionPath, value) {
  const language = languageService.resolveLanguage(value);

  if (!language) {
    throw new Error("Lang pa sipòte.");
  }

  fs.mkdirSync(sessionPath, { recursive: true });

  fs.writeFileSync(
    languageFile(sessionPath),
    JSON.stringify(
      {
        language,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  return language;
}

function protectTerms(text, options = {}) {
  const protectedItems = [];
  let output = String(text || "");

  const protect = (value) => {
    const term = String(value || "").trim();

    if (!term || !output.includes(term)) {
      return;
    }

    const token = `ZXQKEEP${protectedItems.length}QXZ`;

    protectedItems.push([token, term]);

    output = output.split(term).join(token);
  };

  // Pwoteje footer ak non bot chak sesyon.
  protect(options.footer);
  protect(options.botName);

  // Pwoteje valè orijinal TOPFEROS MD yo.
  protect(FOOTER);
  protect(BRAND);

  // Pwoteje lyen, imel, kòmand ak kòd.
  const patterns = [
    /https?:\/\/[^\s]+/gi,
    /www\.[^\s]+/gi,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    /(^|\s)([.!/][a-z0-9_-]+)(?=\s|$)/gim,
    /`[^`]+`/g
  ];

  for (const pattern of patterns) {
    output = output.replace(pattern, (match, prefix) => {
      const value =
        prefix && pattern.source.includes("\\s")
          ? match.slice(prefix.length)
          : match;

      const token = `ZXQKEEP${protectedItems.length}QXZ`;

      protectedItems.push([token, value]);

      return prefix && value !== match
        ? `${prefix}${token}`
        : token;
    });
  }

  return {
    output,
    protectedItems
  };
}

function restoreTerms(text, protectedItems) {
  let restored = String(text || "").trim();

  for (const [token, value] of protectedItems) {
    restored = restored.split(token).join(value);
  }

  return restored;
}

function getTargetLanguageName(language) {
  const names = {
    en: "English",
    fr: "French",
    es: "Spanish",
    es_do: "Dominican Spanish (natural Dominican usage)",
    pt: "Portuguese",
    zh: "Simplified Chinese",
    ht: "Haitian Creole (Kreyòl Ayisyen)"
  };

  return names[language] ||
    languageService.getLanguageName(language);
}

function getGeminiClient() {
  const apiKey = String(
    process.env.GEMINI_API_KEY || ""
  ).trim();

  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn(
        "[TRANSLATION] GEMINI_API_KEY is missing; messages will be sent without translation."
      );
      warnedMissingKey = true;
    }

    return null;
  }

  return new GoogleGenAI({ apiKey });
}

async function translateText(text, targetLanguage, options = {}) {
  const original = String(text || "");
  const lang =
    languageService.normalizeLanguage(targetLanguage);

  if (!original.trim() || lang === "en") {
    return original;
  }

  const { output, protectedItems } =
  protectTerms(original, options);

  // Pa voye mesaj ki pa gen tèks nòmal nan API a.
  if (!/[A-Za-zÀ-ž\u4e00-\u9fff]{3}/.test(output)) {
    return original;
  }

  const key = JSON.stringify([
  lang,
  output,
  protectedItems
]);

  if (cache.has(key)) {
    return cache.get(key);
  }

  const ai = getGeminiClient();

  if (!ai) {
    return original;
  }

  
const selectedModel = String(model).trim();

  const targetName = getTargetLanguageName(lang);

  const prompt = [
    `Translate the message below into ${targetName}.`,
    "Return only the translated message, with no explanation, quotes, or preamble.",
    "Preserve the original meaning, tone, line breaks, lists, punctuation, and emojis.",
    "Do not translate, change, remove, or reformat protected tokens that look like ZXQKEEP0QXZ.",
    "Keep URLs, email addresses, bot commands, code, numbers, and names exactly as provided.",
    "Keep the brand name TOPFEROS MD and the footer 🦁 TECH BY TOPFEROS MD 🐑 exactly unchanged.",
    "If the text is already in the target language, return it unchanged.",
    "",
    "MESSAGE:",
    output
  ].join("\n");

  try {
    
const response = await ai.models.generateContent({
  model: selectedModel,
  contents: prompt,

      config: {
        temperature: 0.1
      }
    });

    const translatedText =
      typeof response?.text === "string"
        ? response.text.trim()
        : "";

    if (!translatedText) {
      return original;
    }

    // Si Gemini retire yon token enpòtan, konsève mesaj orijinal la.
    const missingToken = protectedItems.some(
      ([token]) => !translatedText.includes(token)
    );

    if (missingToken) {
      console.warn(
        "[TRANSLATION] Gemini response omitted a protected token; original text retained."
      );
      return original;
    }

    const translated = restoreTerms(
      translatedText,
      protectedItems
    );

    cache.set(key, translated);

    if (cache.size > 500) {
      cache.delete(cache.keys().next().value);
    }

    return translated;
  } catch (error) {
    // Pa janm afiche kle API a nan mesaj erè yo.
    console.warn(
      "[TRANSLATION] Gemini request failed; sending original text:",
      error?.message || "unknown error"
    );

    return original;
  }
}

<CodeBlock language="javascript" editable>
async function translatePayload(
payload,
language,
options = {}
) {
if (!payload || typeof payload !== "object") {
return payload;
}
const result = { ...payload };
for (const field of ["text", "caption"]) {
if (typeof result[field] === "string") {
result[field] = await translateText(
result[field],
language,
options
);
}
}
return result;
}
</CodeBlock>

module.exports = {
  translateText,
  translatePayload,
  readSessionLanguage,
  saveSessionLanguage,
  FOOTER,
  BRAND
};
