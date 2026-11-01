
"use strict";

// TOPFEROS MD V2.0.0
// PERMANENT SETTINGS PANEL ACCESS CODE STORE
// Neon PostgreSQL

const {
  initializeSessionStore,
  getPool
} = require("./sessionStore");

async function initializePanelAccessCodeStore() {
  await initializeSessionStore();

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS panel_access_codes (
      session_id TEXT PRIMARY KEY,
      access_code VARCHAR(6) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("[NEON] Panel access-code storage ready.");
}

async function getOrCreateAccessCode(sessionId, createCode) {
  const id = String(sessionId || "").replace(/\D/g, "");

  if (!id) {
    throw new Error("Invalid WhatsApp session ID.");
  }

  await initializePanelAccessCodeStore();

  const db = getPool();

  const existing = await db.query(
    `SELECT access_code
     FROM panel_access_codes
     WHERE session_id = $1
     LIMIT 1`,
    [id]
  );

  if (existing.rows.length) {
    return existing.rows[0].access_code;
  }

  const newCode = createCode();

  await db.query(
    `INSERT INTO panel_access_codes
       (session_id, access_code)
     VALUES ($1, $2)
     ON CONFLICT (session_id) DO NOTHING`,
    [id, newCode]
  );

  const saved = await db.query(
    `SELECT access_code
     FROM panel_access_codes
     WHERE session_id = $1
     LIMIT 1`,
    [id]
  );

  if (!saved.rows.length) {
    throw new Error("Unable to save panel access code.");
  }

  return saved.rows[0].access_code;
}

async function verifyAccessCode(sessionId, submittedCode) {
  const id = String(sessionId || "").replace(/\D/g, "");
  const code = String(submittedCode || "").trim().toUpperCase();

  if (!id || !/^[A-Z0-9]{6}$/.test(code)) {
    return false;
  }

  await initializePanelAccessCodeStore();

  const result = await getPool().query(
    `SELECT access_code
     FROM panel_access_codes
     WHERE session_id = $1
     LIMIT 1`,
    [id]
  );

  if (!result.rows.length) {
    return false;
  }

  return result.rows[0].access_code === code;
}

async function deleteAccessCode(sessionId) {
  const id = String(sessionId || "").replace(/\D/g, "");

  if (!id) return false;

  await initializePanelAccessCodeStore();

  const result = await getPool().query(
    `DELETE FROM panel_access_codes
     WHERE session_id = $1`,
    [id]
  );

  return result.rowCount > 0;
}

module.exports = {
  initializePanelAccessCodeStore,
  getOrCreateAccessCode,
  verifyAccessCode,
  deleteAccessCode
};
