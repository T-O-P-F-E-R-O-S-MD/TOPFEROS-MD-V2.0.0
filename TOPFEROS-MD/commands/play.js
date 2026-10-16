
"use strict";

/*
|--------------------------------------------------------------------------
| TOPFEROS MD V2.0.0
| PLAY COMMAND - AUTOMATIC YT-DLP
|--------------------------------------------------------------------------
|
| .play song <non mizik oswa URL>
| .play vid <non videyo oswa URL>
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const {
  downloadMedia,
  isMediaFile,
  removeFile
} = require("../services/mediaDownloader");

const {
  convertToAudio,
  convertToVideo
} = require("../services/mediaConverter");

const PROJECT_DIR = path.resolve(__dirname, "..");
const PYTHON_PACKAGES = path.join(
  PROJECT_DIR,
  "python-packages"
);
const TEMP_DIR = path.join(
  os.tmpdir(),
  "topferos-md-media"
);

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function isValidMedia(file) {
  try {
    return Boolean(
      file &&
      fs.existsSync(file) &&
      fs.statSync(file).isFile() &&
      fs.statSync(file).size > 0
    );
  } catch {
    return false;
  }
}

/*
|--------------------------------------------------------------------------
| SEARCH AND DOWNLOAD WITH YT-DLP
|--------------------------------------------------------------------------
*/

function downloadYouTubeSearch(query, type) {
  return new Promise((resolve, reject) => {
    ensureTempDir();

    const id = crypto.randomBytes(12).toString("hex");
    const prefix = `topferos-${Date.now()}-${id}`;
    const outputTemplate = path.join(
      TEMP_DIR,
      `${prefix}.%(ext)s`
    );

    const pythonPath = [
      PYTHON_PACKAGES,
      process.env.PYTHONPATH || ""
    ]
      .filter(Boolean)
      .join(path.delimiter);

    const format =
      type === "song"
        ? "bestaudio/best"
        : "best[ext=mp4]/best";

    const args = [
      "-m",
      "yt_dlp",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--restrict-filenames",
      "--max-filesize",
      "100M",
      "--socket-timeout",
      "30",
      "--retries",
      "2",
      "--match-filter",
      "!is_live",
      "-f",
      format,
      "-o",
      outputTemplate,
      `ytsearch1:${query}`
    ];

    const child = spawn("python3", args, {
      env: {
        ...process.env,
        PYTHONPATH: pythonPath
      },
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });

    let stderr = "";
    let settled = false;

    function cleanupPartialFiles() {
      try {
        for (const name of fs.readdirSync(TEMP_DIR)) {
          if (name.startsWith(prefix + ".")) {
            fs.rmSync(path.join(TEMP_DIR, name), {
              force: true
            });
          }
        }
      } catch {}
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      cleanupPartialFiles();
      reject(error);
    }

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();

      if (stderr.length > 12000) {
        stderr = stderr.slice(-12000);
      }
    });

    child.on("error", error => {
      fail(
        new Error(
          `yt-dlp pa t kapab demare: ${error.message}`
        )
      );
    });

    child.on("close", code => {
      if (settled) return;

      if (code !== 0) {
        fail(
          new Error(
            stderr.trim() ||
            `yt-dlp fini ak kòd erè ${code}.`
          )
        );
        return;
      }

      let files = [];

      try {
        files = fs.readdirSync(TEMP_DIR)
          .filter(name => name.startsWith(prefix + "."))
          .map(name => path.join(TEMP_DIR, name))
          .filter(file => {
            try {
              const stats = fs.statSync(file);

              return (
                stats.isFile() &&
                stats.size > 0 &&
                stats.size <= MAX_FILE_SIZE
              );
            } catch {
              return false;
            }
          });
      } catch (error) {
        fail(
          new Error(
            `Pa kapab verifye rezilta telechajman an: ${error.message}`
          )
        );
        return;
      }

      if (!files.length) {
        fail(
          new Error(
            "yt-dlp pa jwenn fichye a, oswa fichye a depase 100 MB."
          )
        );
        return;
      }

      files.sort((a, b) =>
        fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs
      );

      settled = true;
      resolve(files[0]);
    });
  });
}

/*
|--------------------------------------------------------------------------
| SEND MEDIA
|--------------------------------------------------------------------------
*/

async function sendAudio(ctx, filePath) {
  if (!isValidMedia(filePath)) {
    throw new Error("Fichye odyo a pa valab.");
  }

  await ctx.sock.sendMessage(
    ctx.jid,
    {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg",
      ptt: false
    },
    { quoted: ctx.message }
  );
}

async function sendVideo(ctx, filePath) {
  if (!isValidMedia(filePath)) {
    throw new Error("Fichye videyo a pa valab.");
  }

  await ctx.sock.sendMessage(
    ctx.jid,
    {
      video: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      caption: "🎬 TOPFEROS MD MEDIA"
    },
    { quoted: ctx.message }
  );
}

/*
|--------------------------------------------------------------------------
| PLAY COMMAND
|--------------------------------------------------------------------------
*/

async function playCommand(ctx) {
  const input = String(ctx.text || "").trim();

  if (!input) {
    await ctx.send(
      [
        "🎵 TOPFEROS MD PLAY",
        "",
        "🎵 Mizik:",
        `${ctx.prefix}play song non mizik la`,
        "",
        "🎬 Videyo:",
        `${ctx.prefix}play vid non videyo a`,
        "",
        "Ou kapab mete yon URL medya tou.",
        "",
        "🦁 TECH BY TOPFEROS MD 🐑"
      ].join("\n")
    );

    return { success: false, reason: "Missing input." };
  }

  const match = input.match(/^(\S+)\s+([\s\S]+)$/);

  if (!match) {
    await ctx.send(
      `❌ Itilizasyon: ${ctx.prefix}play song non an oswa ${ctx.prefix}play vid non an`
    );

    return { success: false, reason: "Missing query." };
  }

  const type = match[1].toLowerCase();
  const query = match[2].trim();

  if (!["song", "vid"].includes(type)) {
    await ctx.send(
      [
        "❌ Kalite medya a pa valab.",
        `${ctx.prefix}play song non mizik la`,
        `${ctx.prefix}play vid non videyo a`
      ].join("\n")
    );

    return { success: false, reason: "Invalid type." };
  }

  if (!query) {
    await ctx.send("❌ Mete non medya a oswa URL la.");

    return { success: false, reason: "Missing query." };
  }

  let directUrl = false;

  try {
    const parsed = new URL(query);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL la dwe itilize HTTP oswa HTTPS.");
    }

    directUrl = true;
  } catch (error) {
    if (error.message === "URL la dwe itilize HTTP oswa HTTPS.") {
      await ctx.send(`❌ ${error.message}`);
      return { success: false, reason: "Invalid protocol." };
    }
  }

  let downloadedFile = null;
  let convertedFile = null;

  try {
    await ctx.send(
      type === "song"
        ? "🔎🎵 M ap chèche epi telechaje mizik la..."
        : "🔎🎬 M ap chèche epi telechaje videyo a..."
    );

    if (directUrl) {
      const result = await downloadMedia(query);
      downloadedFile = result.path;
    } else {
      downloadedFile = await downloadYouTubeSearch(query, type);
    }

    if (!isMediaFile(downloadedFile)) {
      throw new Error(
        "Telechajman an pa bay yon fichye medya ki valab."
      );
    }

    await ctx.send("⚙️ M ap prepare fichye a pou WhatsApp...");

    if (type === "song") {
      convertedFile = await convertToAudio(downloadedFile);
      await sendAudio(ctx, convertedFile);
    } else {
      convertedFile = await convertToVideo(downloadedFile);
      await sendVideo(ctx, convertedFile);
    }

    return {
      success: true,
      type,
      action: "send"
    };
  } catch (error) {
    console.error(
      "[PLAY COMMAND] Error:",
      error?.stack || error
    );

    try {
      await ctx.send(
        [
          "❌ Mwen pa t kapab voye medya a.",
          "",
          `Rezon: ${error?.message || "Erè enkoni."}`,
          "",
          "Eseye yon lòt rechèch oswa yon lòt URL.",
          "",
          "🦁 TECH BY TOPFEROS MD 🐑"
        ].join("\n")
      );
    } catch (sendError) {
      console.error(
        "[PLAY COMMAND] Error reply failed:",
        sendError.message
      );
    }

    return {
      success: false,
      error: error?.message || String(error)
    };
  } finally {
    if (convertedFile) removeFile(convertedFile);
    if (downloadedFile) removeFile(downloadedFile);
  }
}

module.exports = { playCommand };
