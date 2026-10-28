
"use strict";

// 🦁 TOPFEROS MD V2.0.0
// NEON AUTHENTICATION STATE FOR BAILEYS

const {
  getBaileys
} = require("./baileysRuntime");

const {
  initializeSessionStore,
  saveSessionFile,
  getSessionFile
} = require("./sessionStore");

function useNeonAuthState(sessionId) {
  return createNeonAuthState(sessionId);
}

async function createNeonAuthState(sessionId) {
  const baileys = await getBaileys();

  const {
    initAuthCreds,
    BufferJSON,
    proto
  } = baileys;

  const id = String(sessionId || "").trim();

  if (!/^\d{8,15}$/.test(id)) {
    throw new Error("Invalid WhatsApp session ID.");
  }

  await initializeSessionStore();

  const storedCreds = await getSessionFile(
    id,
    "creds.json"
  );

  const creds = storedCreds
    ? JSON.parse(storedCreds, BufferJSON.reviver)
    : initAuthCreds();

  // Serialize database writes for this auth state.
  let pendingWrite = Promise.resolve();

  function enqueueWrite(task) {
    const operation = pendingWrite
      .catch(() => {})
      .then(task);

    pendingWrite = operation;
    return operation;
  }

  function keyFileName(type, keyId) {
    return `${type}-${String(keyId)
      .replace(/\//g, "__")}.json`;
  }

  const keys = {
    async get(type, ids) {
      // Wait for previous writes before reading.
      await pendingWrite;

      const result = {};

      for (const keyId of ids) {
        const stored = await getSessionFile(
          id,
          keyFileName(type, keyId)
        );

        if (stored === null) {
          continue;
        }

        let value = JSON.parse(
          stored,
          BufferJSON.reviver
        );

        if (
          type === "app-state-sync-key" &&
          value
        ) {
          value =
            proto.Message.AppStateSyncKeyData
              .fromObject(value);
        }

        result[keyId] = value;
      }

      return result;
    },

    async set(data) {
      return enqueueWrite(async () => {
        for (const category of Object.keys(data)) {
          const entries = data[category] || {};

          for (const keyId of Object.keys(entries)) {
            const value = entries[keyId];

            const filename = keyFileName(
              category,
              keyId
            );

            if (value === null || value === undefined) {
              await deleteStoredKey(id, filename);
            } else {
              await saveSessionFile(
                id,
                filename,
                JSON.stringify(
                  value,
                  BufferJSON.replacer
                )
              );
            }
          }
        }
      });
    }
  };

  async function saveCreds() {
    return enqueueWrite(() =>
      saveSessionFile(
        id,
        "creds.json",
        JSON.stringify(
          creds,
          BufferJSON.replacer
        )
      )
    );
  }

  async function flush() {
    await pendingWrite;
  }

  return {
    state: {
      creds,
      keys
    },
    saveCreds,
    flush
  };
}

async function deleteStoredKey(id, filename) {
  const {
    deleteSessionFile
  } = require("./sessionStore");

  await deleteSessionFile(id, filename);
}

module.exports = {
  useNeonAuthState
};
