
"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const {
  downloadMedia,
  removeFile
} = require("./mediaDownloader");

const {
  convertToVideo
} = require("./mediaConverter");

const MAX_SIZE = 100 * 1024 * 1024;
const ARCHIVE_API = "https://archive.org";

function hasAllowedLicense(metadata) {
  const license = String(
    metadata?.metadata?.licenseurl ||
    metadata?.metadata?.license ||
    ""
  ).toLowerCase();

  return (
    license.includes("creativecommons.org/publicdomain/zero/1.0") ||
    license.includes("creativecommons.org/publicdomain/mark/1.0") ||
    license.includes("creativecommons.org/licenses/by/") ||
    license.includes("creativecommons.org/licenses/by-sa/")
  );
}

async function searchArchiveVideo(title) {
  const response = await axios.get(
    `${ARCHIVE_API}/advancedsearch.php`,
    {
      params: {
        q: `title:"${title.replace(/["\\]/g, " ")}" AND mediatype:movies`,
        fl: ["identifier", "title"],
        rows: 8,
        page: 1,
        output: "json"
      },
      timeout: 20000
    }
  );

  const docs = response.data?.response?.docs || [];

  for (const doc of docs) {
    if (!doc.identifier) continue;

    try {
      const metaResponse = await axios.get(
        `${ARCHIVE_API}/metadata/${encodeURIComponent(doc.identifier)}`,
        { timeout: 20000 }
      );

      const metadata = metaResponse.data;

      if (!hasAllowedLicense(metadata)) continue;

      const files = metadata.files || [];

      const candidates = files
        .filter(file => {
          const name = String(file.name || "");
          const size = Number(file.size || 0);

          return (
            /\.mp4$/i.test(name) &&
            size > 0 &&
            size <= MAX_SIZE &&
            !file.source?.includes("derivative")
          );
        })
        .sort((a, b) => Number(a.size) - Number(b.size));

      if (!candidates.length) continue;

      const file = candidates[0];

      return {
        title: doc.title || title,
        identifier: doc.identifier,
        license:
          metadata.metadata.licenseurl ||
          metadata.metadata.license ||
          "Creative Commons",
        url:
          `${ARCHIVE_API}/download/` +
          `${encodeURIComponent(doc.identifier)}/` +
          file.name.split("/").map(encodeURIComponent).join("/")
      };
    } catch (error) {
      console.warn(
        "[AUTHORIZED VIDEO SEARCH]",
        doc.identifier,
        error.message
      );
    }
  }

  return null;
}

async function downloadAndSendVideo(ctx, title, category) {
  let originalFile = null;
  let convertedFile = null;

  try {
    await ctx.send(
      `🔎 M ap chèche yon videyo ${category} ki gen lisans apwopriye: ${title}`
    );

    const result = await searchArchiveVideo(title);

    if (!result) {
      await ctx.send(
        "❌ Mwen pa jwenn yon fichye MP4 ki gen lisans apwopriye " +
        "nan rezilta mwen verifye yo.\n\n" +
        "TMDB sèvi pou enfòmasyon sou tit la; li pa bay fim nan dirèkteman."
      );

      return { success: false, reason: "No authorized video found." };
    }

    await ctx.send("⬇️ Mwen jwenn yon fichye ki sanble otorize. M ap telechaje li...");

    const downloaded = await downloadMedia(result.url, {
      timeout: 120000
    });

    originalFile = downloaded.path;

    if (
      !originalFile ||
      !fs.existsSync(originalFile) ||
      fs.statSync(originalFile).size > MAX_SIZE
    ) {
      throw new Error("Fichye a pa valab oswa li depase 100 MB.");
    }

    convertedFile = await convertToVideo(originalFile);

    if (
      !convertedFile ||
      !fs.existsSync(convertedFile)
    ) {
      throw new Error("Konvèsyon MP4 la echwe.");
    }

    if (fs.statSync(convertedFile).size > MAX_SIZE) {
      throw new Error("Videyo final la depase limit 100 MB.");
    }

    await ctx.sock.sendMessage(
      ctx.jid,
      {
        video: fs.readFileSync(convertedFile),
        mimetype: "video/mp4",
        caption:
          `🎬 ${result.title}\n` +
          `📚 Sous: Internet Archive\n` +
          `📜 Lisans: ${result.license}\n` +
          "🦁 TECH BY TOPFEROS MD 🐑"
      },
      { quoted: ctx.message }
    );

    return {
      success: true,
      title: result.title,
      identifier: result.identifier
    };
  } catch (error) {
    console.error(
      "[AUTHORIZED VIDEO]",
      error?.stack || error
    );

    await ctx.send(
      "❌ Mwen pa t kapab telechaje oswa voye videyo a.\n" +
      (error.message || "Erè enkoni.")
    );

    return {
      success: false,
      error: error.message
    };
  } finally {
    if (convertedFile) removeFile(convertedFile);
    if (originalFile) removeFile(originalFile);
  }
}

module.exports = {
  searchArchiveVideo,
  downloadAndSendVideo
};
