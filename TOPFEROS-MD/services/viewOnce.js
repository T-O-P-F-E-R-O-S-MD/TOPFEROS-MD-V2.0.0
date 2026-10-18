

"use strict";

// 🦁 TOPFEROS MD V2.0.0
// VV MEDIA DOWNLOAD SERVICE

const fs = require("fs");
const path = require("path");

const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const SAVE_DIR = path.join(
  __dirname,
  "..",
  "media-saves"
);

const MAX_SIZE = 25 * 1024 * 1024;

fs.mkdirSync(SAVE_DIR, { recursive: true });

async function saveMedia(mediaMessage, type) {
  if (!mediaMessage || !type) {
    throw new Error("Medya oswa tip medya a manke.");
  }

  const allowedTypes = [
    "image",
    "video",
    "audio",
    "document"
  ];

  if (!allowedTypes.includes(type)) {
    throw new Error("Tip medya sa a pa sipòte.");
  }

  const stream = await downloadContentFromMessage(
    mediaMessage,
    type
  );

  const chunks = [];
  let totalSize = 0;

  for await (const chunk of stream) {
    totalSize += chunk.length;

    if (totalSize > MAX_SIZE) {
      throw new Error(
        "Medya a depase limit 25 MB."
      );
    }

    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  if (!buffer.length) {
    throw new Error("Medya a vid.");
  }

  const mime = (
    mediaMessage.mimetype || ""
  ).toLowerCase();

  const extensions = {
    image: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif"
    },
    video: {
      "video/mp4": "mp4",
      "video/3gpp": "3gp",
      "video/quicktime": "mov"
    },
    audio: {
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/aac": "aac",
      "audio/amr": "amr",
      "audio/wav": "wav",
      "audio/webm": "webm"
    },
    document: {
      "application/pdf": "pdf",
      "application/zip": "zip",
      "application/json": "json",
      "text/plain": "txt",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
    }
  };

  const extension =
    extensions[type]?.[mime] || "bin";

  const filename =
    `media_${Date.now()}_${require("crypto")
      .randomBytes(4)
      .toString("hex")}.${extension}`;

  const filepath = path.join(
    SAVE_DIR,
    filename
  );

  fs.writeFileSync(filepath, buffer, {
    flag: "wx"
  });

  return {
    filename,
    filepath,
    size: buffer.length,
    type,
    mimetype: mime || "application/octet-stream"
  };
}

module.exports = {
  saveMedia,
  SAVE_DIR,
  MAX_SIZE
};
