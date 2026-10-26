const { app, BrowserWindow, Menu, ipcMain, dialog, session } = require("electron");
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split("?")[0]);
        let filePath = path.join(rootDir, urlPath === "/" ? "/index.html" : urlPath);

        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        if (!fs.existsSync(filePath)) {
          const withHtml = `${filePath}.html`;
          filePath = fs.existsSync(withHtml) ? withHtml : filePath;
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, "index.html");
        }
        if (!fs.existsSync(filePath)) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const mime = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500);
        res.end("Server error");
      }
    });

    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
    server.on("error", reject);
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    // Packaged builds get their icon embedded in the .exe via build.icon (package.json);
    // in dev the window would otherwise show the generic Electron icon.
    ...(isDev && { icon: path.join(__dirname, "..", "build", "icon.ico") }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL(DEV_URL);
  } else {
    const outDir = path.join(process.resourcesPath, "app-out");
    const port = await startStaticServer(outDir);
    await win.loadURL(`http://127.0.0.1:${port}`);
  }
  return win;
}

function openPdfDialog(browserWindow) {
  const target = browserWindow || BrowserWindow.getFocusedWindow();
  if (!target) return;
  dialog
    .showOpenDialog(target, {
      properties: ["openFile"],
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    })
    .then(({ canceled, filePaths }) => {
      if (canceled || !filePaths[0]) return;
      const bytes = fs.readFileSync(filePaths[0]);
      target.webContents.send("open-file", { name: path.basename(filePaths[0]), bytes });
    });
}

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open PDF…",
          accelerator: "CmdOrCtrl+O",
          click: (_menuItem, browserWindow) => openPdfDialog(browserWindow),
        },
        { type: "separator" },
        { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => createWindow() },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const SAVE_FILTER_NAMES = {
  pdf: "PDF Document",
  zip: "Zip Archive",
  svg: "SVG Image",
  txt: "Text File",
  md: "Markdown",
  rtf: "Rich Text Format",
  html: "HTML Document",
  docx: "Word Document",
  pptx: "PowerPoint Presentation",
  xlsx: "Excel Workbook",
  epub: "EPUB Book",
  png: "PNG Image",
  jpg: "JPEG Image",
  jpeg: "JPEG Image",
};

ipcMain.handle("save-file", async (event, { suggestedName, bytes, extension }) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  const ext = extension || "pdf";
  const filterName = SAVE_FILTER_NAMES[ext] || ext.toUpperCase();
  const { canceled, filePath } = await dialog.showSaveDialog(target, {
    defaultPath: suggestedName,
    filters: [{ name: filterName, extensions: [ext] }],
  });
  if (canceled || !filePath) return { saved: false };
  fs.writeFileSync(filePath, Buffer.from(bytes));
  return { saved: true, filePath };
});

ipcMain.handle("new-window", async () => {
  await createWindow();
});

// TSA servers generally don't send CORS headers, so timestamp requests go through the main
// process as plain Node HTTP rather than a renderer `fetch`.
ipcMain.handle("tsa-request", async (_event, { url, body }) => {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const bodyBuffer = Buffer.from(body);
    const req = mod.request(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/timestamp-query", "Content-Length": bodyBuffer.length },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`TSA responded with HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timestamp request timed out")));
    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });
});

const watchedFoldersFile = () => path.join(app.getPath("userData"), "watched-folders.json");
const watchers = new Map(); // folderPath -> { watcher, knownFiles: Set<string>, timers: Map<string, Timeout> }

function loadWatchedFolderPaths() {
  try {
    return JSON.parse(fs.readFileSync(watchedFoldersFile(), "utf8"));
  } catch {
    return [];
  }
}

function saveWatchedFolderPaths(paths) {
  try {
    fs.mkdirSync(path.dirname(watchedFoldersFile()), { recursive: true });
    fs.writeFileSync(watchedFoldersFile(), JSON.stringify(paths));
  } catch {
    // Best-effort — losing the persisted list just means watchers don't survive a restart.
  }
}

function broadcastFileAdded(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("watch-folder:file-added", payload);
  }
}

function startWatchingFolder(folderPath) {
  if (watchers.has(folderPath)) return true;
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return false;

  const knownFiles = new Set(
    fs
      .readdirSync(folderPath)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
  );
  const timers = new Map();

  let watcher;
  try {
    watcher = fs.watch(folderPath, { persistent: true }, (_eventType, filename) => {
      if (!filename || !filename.toLowerCase().endsWith(".pdf")) return;

      clearTimeout(timers.get(filename));
      timers.set(
        filename,
        setTimeout(() => {
          timers.delete(filename);
          const fullPath = path.join(folderPath, filename);
          if (!fs.existsSync(fullPath) || knownFiles.has(filename)) return;
          knownFiles.add(filename);
          try {
            const bytes = fs.readFileSync(fullPath);
            broadcastFileAdded({ folderPath, filePath: fullPath, name: filename, bytes });
          } catch {
            // Unreadable (permissions, already moved again, etc.) — skip silently.
          }
        }, 700)
      );
    });
  } catch {
    return false;
  }

  watchers.set(folderPath, { watcher, knownFiles, timers });
  return true;
}

function stopWatchingFolder(folderPath) {
  const entry = watchers.get(folderPath);
  if (!entry) return;
  for (const t of entry.timers.values()) clearTimeout(t);
  entry.watcher.close();
  watchers.delete(folderPath);
}

ipcMain.handle("watch-folder:pick", async (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(target, { properties: ["openDirectory"] });
  if (canceled || !filePaths[0]) return null;
  return filePaths[0];
});

ipcMain.handle("watch-folder:add", (_event, folderPath) => {
  const ok = startWatchingFolder(folderPath);
  if (ok) {
    const current = loadWatchedFolderPaths();
    if (!current.includes(folderPath)) saveWatchedFolderPaths([...current, folderPath]);
  }
  return Array.from(watchers.keys());
});

ipcMain.handle("watch-folder:remove", (_event, folderPath) => {
  stopWatchingFolder(folderPath);
  saveWatchedFolderPaths(loadWatchedFolderPaths().filter((p) => p !== folderPath));
  return Array.from(watchers.keys());
});

ipcMain.handle("watch-folder:list", () => Array.from(watchers.keys()));

app.whenReady().then(() => {
  const ALLOWED_PERMISSIONS = new Set(["media", "fullscreen"]);
  const permissionHandler = (_webContentsOrNull, permission) => ALLOWED_PERMISSIONS.has(permission);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permissionHandler(_webContents, permission));
  });
  session.defaultSession.setPermissionCheckHandler(permissionHandler);

  buildMenu();
  createWindow();
  for (const folderPath of loadWatchedFolderPaths()) {
    if (!startWatchingFolder(folderPath)) {
      saveWatchedFolderPaths(loadWatchedFolderPaths().filter((p) => p !== folderPath));
    }
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
