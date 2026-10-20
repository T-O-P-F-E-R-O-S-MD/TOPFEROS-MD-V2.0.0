
"use strict";

const { askAI } = require("./ai");

const sessions = new Map();
const MAX_HISTORY = 20;

function getSessionKey(jid) {
  return String(jid || "").trim();
}

function getSession(jid) {
  const key = getSessionKey(jid);
  return key ? sessions.get(key) || null : null;
}

function createSession(jid) {
  const key = getSessionKey(jid);

  if (!key) {
    throw new Error("Invalid chat JID.");
  }

  const session = {
    jid: key,
    active: true,
    history: [],
    lastAIText: null,
    waitingForQuestion: false,
    busy: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  sessions.set(key, session);
  return session;
}

function getOrCreateSession(jid) {
  return getSession(jid) || createSession(jid);
}

function hasSession(jid) {
  const session = getSession(jid);
  return Boolean(session && session.active);
}

function addHistory(session, role, content) {
  const text = String(content || "").trim();

  if (!session || !text) return;

  session.history.push({
    role: role === "assistant" ? "assistant" : "user",
    content: text,
    timestamp: new Date().toISOString()
  });

  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }

  session.updatedAt = new Date().toISOString();
}

const SYSTEM_PROMPT = [
  "You are TOPFEROS MD V2.0.0 AI Chat.",
  "You are a professional multilingual AI assistant.",
  "Understand and communicate in all languages supported by your model.",
  "Automatically detect the language of every new user message.",
  "Always answer in the same language as the user's latest message.",
  "If the user changes language, change your response language immediately.",
  "Understand dialects, slang, regional expressions and mixed languages whenever possible.",
  "Use conversation history to remember previous information.",
  "Never let the language of previous messages override the language of the latest question.",
  "When asked to translate, translate into the language requested by the user.",
  "Preserve meaning, tone and context when translating.",
  "If the language is unclear, ask for clarification.",
  "Answer naturally, accurately and professionally.",
  "Never claim you generated an image unless an image tool was actually used."
].join(" ");

async function requestAI(session, text) {
  if (session.busy) {
    return {
      busy: true,
      session,
      answer: null
    };
  }

  session.busy = true;

  try {
    const answer = await askAI(text, {
      systemPrompt: SYSTEM_PROMPT,
      history: session.history,
      temperature: 0.7,
      maxTokens: 1500
    });

    addHistory(session, "user", text);
    addHistory(session, "assistant", answer);

    return {
      busy: false,
      session,
      answer
    };
  } finally {
    session.busy = false;
  }
}

async function startAIChat(jid, message) {
  const text = String(message || "").trim();

  if (!text) {
    throw new Error("AI Chat message is empty.");
  }

  const existing = getSession(jid);

  if (existing?.busy) {
    return {
      busy: true,
      session: existing,
      answer: null
    };
  }

  const session = createSession(jid);
  return requestAI(session, text);
}

async function continueAIChat(jid, userMessage) {
  const session = getSession(jid);
  const text = String(userMessage || "").trim();

  if (!session || !session.active || !text) {
    return null;
  }

  return requestAI(session, text);
}

function setLastAIMessage(jid, messageId, text) {
  const session = getSession(jid);

  if (!session || !session.active) return false;

  session.lastAIMessageId = messageId || null;
  session.lastAIText = String(text || "").trim();
  session.updatedAt = new Date().toISOString();

  return true;
}

function isReplyToLastAIMessage(jid, quotedMessageId) {
  const session = getSession(jid);

  if (!session || !session.active ||
      !session.lastAIMessageId || !quotedMessageId) {
    return false;
  }

  return String(quotedMessageId) === String(session.lastAIMessageId);
}


function normalizeMessageText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function getForwardQuestion(jid, incomingText) {
  const session = getSession(jid);

  if (!session?.active || !session.lastAIText) {
    return null;
  }

  const incoming = normalizeMessageText(incomingText);
  const previous = normalizeMessageText(session.lastAIText);

  if (!incoming || !previous) {
    return null;
  }

  // Rekonèt mesaj konplè AI a ki transfere.
  if (incoming === previous) {
    return "";
  }

  // Jwenn dènye repons AI a nan istwa konvèsasyon an.
  const lastAnswer =
    [...session.history]
      .reverse()
      .find(item => item.role === "assistant")
      ?.content || "";

  const normalizedAnswer =
    normalizeMessageText(lastAnswer);

  // Rekonèt repons AI a san enstriksyon Forward la.
  if (
    normalizedAnswer &&
    incoming === normalizedAnswer
  ) {
    return "";
  }

  // Rekonèt Forward ki gen yon nouvo kesyon ajoute.
  for (const reference of [previous, normalizedAnswer]) {
    if (
      reference &&
      incoming.startsWith(reference)
    ) {
      return incoming.slice(reference.length).trim();
    }
  }

  return null;
}

function isForwardOfLastAIMessage(jid, incomingText) {
  return getForwardQuestion(jid, incomingText) !== null;
}

function setWaitingForQuestion(jid, waiting = true) {
  const session = getSession(jid);

  if (!session?.active) return false;

  session.waitingForQuestion = Boolean(waiting);
  session.updatedAt = new Date().toISOString();

  return true;
}

function isWaitingForQuestion(jid) {
  const session = getSession(jid);

  return Boolean(
    session?.active && session.waitingForQuestion
  );
}

function getChatHistory(jid) {
  const session = getSession(jid);
  return session ? session.history.map(item => ({ ...item })) : [];
}

function getSessionInfo(jid) {
  const session = getSession(jid);

  if (!session) return null;

  return {
    jid: session.jid,
    active: session.active,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastAIMessageId: session.lastAIMessageId,
    historyLength: session.history.length
  };
}

module.exports = {
  createSession,
  getSession,
  getOrCreateSession,
  hasSession,
  startAIChat,
  continueAIChat,
  setLastAIMessage,
  isReplyToLastAIMessage,
  isForwardOfLastAIMessage,
  getChatHistory,
  getSessionInfo,
  getForwardQuestion,
  setWaitingForQuestion,
  isWaitingForQuestion,
};
