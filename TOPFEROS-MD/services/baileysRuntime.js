
"use strict";

// TOPFEROS MD V2.0.0
// BAILEYS 7 ESM RUNTIME LOADER

let baileysPromise;

function getBaileys() {
  if (!baileysPromise) {
    baileysPromise = import("@whiskeysockets/baileys");
  }

  return baileysPromise;
}

module.exports = {
  getBaileys
};
