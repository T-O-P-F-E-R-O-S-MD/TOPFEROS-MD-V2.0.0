
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// NEON POSTGRESQL SESSION STORE

const { Pool } = require("pg");

const crypto = require("crypto");

function getEncryptionKey() {
  const value = String(
    process.env.SESSION_ENCRYPTION_KEY || ""
  ).trim();

  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY dwe genyen 64 karaktè egzadesimal."
    );
  }

  return Buffer.from(value, "hex");
}

function encryptSessionData(content) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(String(content), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64")
  ].join(":");
}

function decryptSessionData(content) {
  const parts = String(content).split(":");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error(
      "Fòma done sesyon chifre a pa valab."
    );
  }

  const [, ivText, tagText, encryptedText] = parts;

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64")
  );

  decipher.setAuthTag(
    Buffer.from(tagText, "base64")
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encryptedText, "base64")
    ),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

let pool = null;
let initialization = null;

function getPool() {
  if (pool) return pool;

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL manke nan Render Environment."
    );
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
  });

  pool.on("error", (error) => {
    console.error(
      "[NEON] Idle database connection error:",
      error.message
    );
  });

  return pool;
}

async function initializeSessionStore() {
  if (initialization) {
    return initialization;
  }

  initialization = (async () => {
    const db = getPool();

    await db.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        session_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (session_id, file_name)
      )
    `);

    console.log(
      "[NEON] WhatsApp session storage ready."
    );

    return true;
  })();

  try {
    return await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

function validateName(value, label) {
  const name = String(value || "").trim();

  if (
    !name ||
    name.length > 255 ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".."
  ) {
    throw new Error(
      `Invalid ${label}.`
    );
  }

  return name;
}

async function saveSessionFile(
  sessionId,
  fileName,
  content
) {
  await initializeSessionStore();

  const id = validateName(
    sessionId,
    "session ID"
  );

  const name = validateName(
    fileName,
    "file name"
  );

  const value =
    typeof content === "string"
      ? content
      : JSON.stringify(content);

  await getPool().query(
    `
      INSERT INTO whatsapp_sessions
        (session_id, file_name, content, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (session_id, file_name)
      DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = NOW()
    `,
        [id, name, encryptSessionData(value)]
  );

  return true;
}

async function getSessionFile(
  sessionId,
  fileName
) {
  await initializeSessionStore();

  const result = await getPool().query(
    `
      SELECT content
      FROM whatsapp_sessions
      WHERE session_id = $1
        AND file_name = $2
      LIMIT 1
    `,
    [
      validateName(sessionId, "session ID"),
      validateName(fileName, "file name")
    ]
  );

 const content = result.rows[0]?.content;

  return content == null
    ? null
    : decryptSessionData(content);
}

async function listSessionFiles(sessionId) {
  await initializeSessionStore();

  const result = await getPool().query(
    `
      SELECT file_name, content
      FROM whatsapp_sessions
      WHERE session_id = $1
      ORDER BY file_name
    `,
    [
      validateName(sessionId, "session ID")
    ]
  );

   return result.rows.map(row => ({
    file_name: row.file_name,
    content: decryptSessionData(row.content)
  }));
}

async function listSessionIds() {
  await initializeSessionStore();

  const result = await getPool().query(`
    SELECT DISTINCT session_id
    FROM whatsapp_sessions
    ORDER BY session_id
  `);

  return result.rows.map(
    row => row.session_id
  );
}

async function deleteSessionFile(
  sessionId,
  fileName
) {
  await initializeSessionStore();

  await getPool().query(
    `
      DELETE FROM whatsapp_sessions
      WHERE session_id = $1
        AND file_name = $2
    `,
    [
      validateName(sessionId, "session ID"),
      validateName(fileName, "file name")
    ]
  );

  return true;
}

async function closeSessionStore() {
  if (pool) {
    const current = pool;
    pool = null;
    initialization = null;
    await current.end();
  }
}


module.exports = {
  encryptSessionData,
  decryptSessionData,
  getPool,
  initializeSessionStore,
  saveSessionFile,
  getSessionFile,
  listSessionFiles,
  listSessionIds,
  deleteSessionFile,
  closeSessionStore
};
