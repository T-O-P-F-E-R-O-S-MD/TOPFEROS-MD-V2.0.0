
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const axios = require("axios");
const { spawn } = require("child_process");

const PROJECT_DIR = path.resolve(__dirname, "..");
const PYTHON_PACKAGES = path.join(PROJECT_DIR, "python-packages");
const TEMP_DIR = path.join(os.tmpdir(), "topferos-md-media");

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

function createTempFile(extension = "bin") {
  ensureTempDir();

  const id = crypto.randomBytes(12).toString("hex");
  return path.join(
    TEMP_DIR,
    `${Date.now()}-${id}.${extension}`
  );
}

function normalizeUrl(value) {
  const input = String(value || "").trim();

  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    throw new Error(
      "Yon URL HTTP oswa HTTPS ki valab obligatwa."
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(
      "Se URL HTTP ak HTTPS sèlman ki sipòte."
    );
  }

  return parsed.toString();
}

function getExtension(url, contentType = "") {
  try {
    const extension = path.extname(
      new URL(url).pathname
    ).replace(".", "").toLowerCase();

    if (
      extension &&
      /^[a-z0-9]{1,8}$/.test(extension)
    ) {
      return extension;
    }
  } catch {}

  const types = {
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  const mime = String(contentType)
    .toLowerCase()
    .split(";")[0]
    .trim();

  return types[mime] || "bin";
}

function runYtDlp(url, outputTemplate) {
  return new Promise((resolve, reject) => {
    ensureTempDir();

    const pythonPath = [
      PYTHON_PACKAGES,
      process.env.PYTHONPATH || ""
    ]
      .filter(Boolean)
      .join(path.delimiter);

    const child = spawn(
      "python3",
      [
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
        "-o",
        outputTemplate,
        url
      ],
      {
        env: {
          ...process.env,
          PYTHONPATH: pythonPath
        },
        windowsHide: true
      }
    );

    let stderr = "";
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();

      if (stderr.length > 20000) {
        stderr = stderr.slice(-20000);
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

      const prefix = outputTemplate.split(".%(ext)s")[0];
      const expectedPrefix = path.basename(prefix);

      let files = [];

      try {
        files = fs.readdirSync(TEMP_DIR)
          .filter(name =>
            name.startsWith(expectedPrefix + ".")
          )
          .map(name => path.join(TEMP_DIR, name))
          .filter(file => {
            try {
              const stats = fs.statSync(file);

              return (
                stats.isFile() &&
                stats.size > 0
              );
            } catch {
              return false;
            }
          });
      } catch (error) {
        fail(
          new Error(
            `Li pa posib verifye fichye medya a: ${error.message}`
          )
        );
        return;
      }

      if (!files.length) {
        fail(
          new Error(
            "yt-dlp fini, men li pa jwenn fichye medya a."
          )
        );
        return;
      }

      files.sort((a, b) =>
        fs.statSync(b).mtimeMs -
        fs.statSync(a).mtimeMs
      );

      settled = true;
      resolve(files[0]);
    });
  });
}

async function downloadMedia(inputUrl, options = {}) {
  const url = normalizeUrl(inputUrl);

  ensureTempDir();

  const isDirectFile =
    /\.(mp3|m4a|aac|ogg|opus|wav|flac|mp4|m4v|mov|webm|jpg|jpeg|png|webp)(?:$)/i
      .test(new URL(url).pathname);

  if (
    !isDirectFile &&
    options.useYtDlp !== false
  ) {
    const template = createTempFile("download")
      .replace(/\.download$/, ".%(ext)s");

    const filePath = await runYtDlp(
      url,
      template
    );

    const stats = fs.statSync(filePath);

    if (stats.size > MAX_FILE_SIZE) {
      removeFile(filePath);

      throw new Error(
        "Fichye medya a depase limit 100 MB."
      );
    }

    return {
      success: true,
      url,
      path: filePath,
      size: stats.size,
      contentType: "",
      extension: path.extname(filePath)
        .slice(1)
        .toLowerCase()
    };
  }

  const response = await axios.get(url, {
    responseType: "stream",
    timeout: Number(options.timeout || 120000),
    maxRedirects: Number(
      options.maxRedirects || MAX_REDIRECTS
    ),
    maxContentLength: MAX_FILE_SIZE,
    maxBodyLength: MAX_FILE_SIZE,
    validateStatus: status =>
      status >= 200 && status < 300,
    headers: {
      "User-Agent": "TOPFEROS-MD/2.0.0"
    }
  });

  const contentType = String(
    response.headers["content-type"] || ""
  );

  const contentLength = Number(
    response.headers["content-length"] || 0
  );

  if (
    contentLength > MAX_FILE_SIZE
  ) {
    response.data.destroy();

    throw new Error(
      "Fichye a depase limit 100 MB."
    );
  }

  const extension =
    options.extension ||
    getExtension(url, contentType);

  const output =
    options.output ||
    createTempFile(extension);

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(output);
    let downloaded = 0;
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;

      response.data.destroy();
      writer.destroy();

      fs.rm(output, { force: true }, () => {});
      reject(error);
    }

    response.data.on("data", chunk => {
      downloaded += chunk.length;

      if (downloaded > MAX_FILE_SIZE) {
        fail(
          new Error(
            "Fichye a depase limit 100 MB."
          )
        );
      }
    });

    response.data.on("error", fail);
    writer.on("error", fail);

    writer.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve();
    });

    response.data.pipe(writer);
  });

  const stats = fs.statSync(output);

  if (stats.size === 0) {
    removeFile(output);

    throw new Error(
      "Telechajman an fini, men fichye a vid."
    );
  }

  return {
    success: true,
    url,
    path: output,
    size: stats.size,
    contentType,
    extension
  };
}

function isMediaFile(filePath) {
  try {
    return Boolean(
      filePath &&
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile() &&
      fs.statSync(filePath).size > 0
    );
  } catch {
    return false;
  }
}

function removeFile(filePath) {
  if (!filePath) return false;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return true;
  } catch (error) {
    console.warn(
      "[MEDIA DOWNLOADER] Cleanup failed:",
      error.message
    );

    return false;
  }
}

module.exports = {
  TEMP_DIR,
  ensureTempDir,
  createTempFile,
  normalizeUrl,
  getExtension,
  downloadMedia,
  isMediaFile,
  removeFile
};
