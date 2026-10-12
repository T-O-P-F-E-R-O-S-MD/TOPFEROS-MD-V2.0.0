"use strict";

// ╔════════════════════════════════════════════════════╗
// ║              🦁 TOPFEROS MD V2.0.0               ║
// ║             AUTOMATIC COMMAND LOADER              ║
// ╚════════════════════════════════════════════════════╝

const fs = require("fs");
const path = require("path");

// Bon direksyon dosye kòmand yo
const COMMANDS_DIR = __dirname;

function loadCommands() {
  console.log(
    "🦁 [TOPFEROS MD] Chèche kòmand yo nan:",
    COMMANDS_DIR
  );

  if (!fs.existsSync(COMMANDS_DIR)) {
    console.error(
      "❌ Dosye commands/ lan pa egziste:",
      COMMANDS_DIR
    );

    return 0;
  }

  const files = fs
    .readdirSync(COMMANDS_DIR, {
      withFileTypes: true
    })
    .filter((entry) => {
      return (
        entry.isFile() &&
        entry.name.endsWith(".js") &&
        entry.name !== "index.js" &&
        !entry.name.startsWith("_")
      );
    })
    .map((entry) => entry.name)
    .sort();

  let loaded = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(
      COMMANDS_DIR,
      file
    );

    try {
      require(filePath);

      loaded++;

      console.log(
        `✅ [TOPFEROS MD] Kòmand chaje: ${file}`
      );
    } catch (error) {
      failed++;

      console.error(
        `❌ [TOPFEROS MD] Erè nan ${file}:`,
        error.stack || error.message || error
      );
    }
  }

  console.log(
    `📚 [TOPFEROS MD] ${loaded} fichye chaje; ${failed} echwe.`
  );

  return loaded;
}

module.exports = loadCommands;