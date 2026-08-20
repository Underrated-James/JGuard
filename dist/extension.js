"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode5 = __toESM(require("vscode"));

// src/storage/MetadataStore.ts
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));
var MetadataStore = class {
  constructor(storageBaseDir) {
    this.storageBaseDir = storageBaseDir;
  }
  getCheckpointsDir() {
    return path.join(this.storageBaseDir, "checkpoints");
  }
  getSessionsDir() {
    return path.join(this.storageBaseDir, "sessions");
  }
  getCheckpointPath(id) {
    return path.join(this.getCheckpointsDir(), `${id}.json`);
  }
  getSessionPath(id) {
    return path.join(this.getSessionsDir(), `${id}.json`);
  }
  /**
   * Initializes the directory structure.
   */
  async initialize() {
    await fs.mkdir(this.getCheckpointsDir(), { recursive: true });
    await fs.mkdir(this.getSessionsDir(), { recursive: true });
  }
  /**
   * Writes a checkpoint to disk atomically.
   * @param id The checkpoint ID.
   * @param checkpoint The checkpoint data.
   */
  async write(id, checkpoint) {
    const cpPath = this.getCheckpointPath(id);
    const tmpPath = `${cpPath}.tmp.${Date.now()}`;
    await fs.writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), "utf-8");
    await fs.rename(tmpPath, cpPath);
  }
  /**
   * Reads a checkpoint from disk.
   * @param id The checkpoint ID.
   * @returns The checkpoint data.
   */
  async read(id) {
    const cpPath = this.getCheckpointPath(id);
    const content = await fs.readFile(cpPath, "utf-8");
    return JSON.parse(content);
  }
  /**
   * Deletes a checkpoint from disk.
   * @param id The checkpoint ID.
   */
  async delete(id) {
    const cpPath = this.getCheckpointPath(id);
    try {
      await fs.unlink(cpPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  /**
   * L1: Writes a checkpoint session to disk atomically.
   */
  async writeSession(id, session) {
    const sessionPath = this.getSessionPath(id);
    const tmpPath = `${sessionPath}.tmp.${Date.now()}`;
    await fs.writeFile(tmpPath, JSON.stringify(session, null, 2), "utf-8");
    await fs.rename(tmpPath, sessionPath);
  }
  /**
   * L1: Reads a checkpoint session from disk.
   */
  async readSession(id) {
    const sessionPath = this.getSessionPath(id);
    const content = await fs.readFile(sessionPath, "utf-8");
    return JSON.parse(content);
  }
  /**
   * L1: Deletes a checkpoint session from disk.
   */
  async deleteSession(id) {
    const sessionPath = this.getSessionPath(id);
    try {
      await fs.unlink(sessionPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
};

// src/storage/ObjectStore.ts
var fs3 = __toESM(require("fs/promises"));
var path2 = __toESM(require("path"));

// src/core/Hasher.ts
var crypto = __toESM(require("crypto"));
var fs2 = __toESM(require("fs"));
var Hasher = class {
  /**
   * Computes the SHA-256 hash of a file using streams to handle large files efficiently.
   * @param absolutePath The absolute path to the file.
   * @returns A promise that resolves to the hex representation of the SHA-256 hash.
   */
  static hashFile(absolutePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs2.createReadStream(absolutePath);
      stream.on("data", (chunk) => {
        hash.update(chunk);
      });
      stream.on("end", () => {
        resolve(hash.digest("hex"));
      });
      stream.on("error", (err) => {
        reject(err);
      });
    });
  }
  /**
   * Computes the SHA-256 hash of a buffer.
   * @param content The buffer to hash.
   * @returns The hex representation of the SHA-256 hash.
   */
  static hashBuffer(content) {
    const hash = crypto.createHash("sha256");
    hash.update(content);
    return hash.digest("hex");
  }
};

// src/storage/ObjectStore.ts
var ObjectStore = class {
  constructor(storageBaseDir) {
    this.storageBaseDir = storageBaseDir;
  }
  getObjectDir(hash) {
    return path2.join(this.storageBaseDir, "objects", hash.substring(0, 2));
  }
  getObjectPath(hash) {
    return path2.join(this.getObjectDir(hash), hash);
  }
  /**
   * Initializes the object store directory structure.
   */
  async initialize() {
    const objectsDir = path2.join(this.storageBaseDir, "objects");
    await fs3.mkdir(objectsDir, { recursive: true });
  }
  /**
   * Writes content to the object store if it doesn't already exist.
   * @param content The content to write.
   * @returns The SHA-256 hash of the content.
   */
  async write(content) {
    const hash = Hasher.hashBuffer(content);
    const objPath = this.getObjectPath(hash);
    const objDir = this.getObjectDir(hash);
    try {
      await fs3.stat(objPath);
      return hash;
    } catch {
    }
    await fs3.mkdir(objDir, { recursive: true });
    const tmpPath = `${objPath}.tmp.${Date.now()}`;
    await fs3.writeFile(tmpPath, content);
    await fs3.rename(tmpPath, objPath);
    return hash;
  }
  /**
   * Reads content from the object store.
   * @param hash The SHA-256 hash of the object.
   * @returns The content buffer.
   */
  async read(hash) {
    const objPath = this.getObjectPath(hash);
    return await fs3.readFile(objPath);
  }
  /**
   * Checks if an object exists in the store.
   * @param hash The SHA-256 hash of the object.
   */
  async exists(hash) {
    const objPath = this.getObjectPath(hash);
    try {
      await fs3.stat(objPath);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Deletes an object from the store.
   * @param hash The SHA-256 hash of the object.
   */
  async delete(hash) {
    const objPath = this.getObjectPath(hash);
    try {
      await fs3.unlink(objPath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
};

// src/application/CheckpointService.ts
var path3 = __toESM(require("path"));
var fs4 = __toESM(require("fs/promises"));
var CheckpointService = class {
  constructor(metadataStore, objectStore, scanner, workspaceRoot) {
    this.metadataStore = metadataStore;
    this.objectStore = objectStore;
    this.scanner = scanner;
    this.workspaceRoot = workspaceRoot;
  }
  /**
   * Generates a simple unique ID (ulid alternative)
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  /**
   * Helper to detect binary files (simple check for MVP)
   */
  isBinary(content) {
    const len = Math.min(content.length, 8192);
    for (let i = 0; i < len; i++) {
      if (content[i] === 0)
        return true;
    }
    return false;
  }
  /**
   * L1: Creates a CheckpointSession spanning all workspace folders.
   * Each folder gets its own Checkpoint, sharing the same ObjectStore.
   * 
   * @param workspaceId The unique ID of the workspace.
   * @param workspaceFolders Array of workspace folder paths. If empty/undefined, falls back to this.workspaceRoot.
   * @param onProgress Optional progress callback: (processedFiles, totalFiles) => void
   * @returns The created CheckpointSession.
   */
  async createSession(workspaceId, workspaceFolders, onProgress) {
    const sessionId = this.generateId();
    const folderCheckpoints = {};
    const folders = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders : [this.workspaceRoot];
    for (const folderRoot of folders) {
      const cp = await this.createCheckpointForFolder(workspaceId, folderRoot, onProgress);
      folderCheckpoints[folderRoot] = cp;
    }
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      folderCheckpoints,
      status: "active"
    };
    const lockFile = path3.join(this.metadataStore.storageBaseDir, "jguard.lock");
    await fs4.writeFile(lockFile, sessionId, "utf-8");
    this.cleanOldCheckpoints().catch(console.error);
    return session;
  }
  /**
   * L1: Creates a single checkpoint for one workspace folder.
   * L4: Uses batched parallel processing for I/O throughput.
   *
   * @param workspaceId The workspace ID.
   * @param folderRoot Absolute path to the workspace folder.
   * @param onProgress Optional progress callback.
   */
  async createCheckpointForFolder(workspaceId, folderRoot, onProgress) {
    const id = this.generateId();
    const files = {};
    const paths = await this.scanner.scan();
    const entries = [...paths.entries()];
    const totalFiles = entries.length;
    const BATCH_SIZE = 50;
    let processed = 0;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ([relPath, meta]) => {
          const absPath = path3.join(folderRoot, relPath);
          const content = await fs4.readFile(absPath);
          const hash = await this.objectStore.write(content);
          return { relPath, hash, meta, isBinary: this.isBinary(content) };
        })
      );
      for (const r of results) {
        files[r.relPath] = {
          hash: r.hash,
          size: r.meta.size,
          mtime: r.meta.mtime,
          isBinary: r.isBinary
        };
      }
      processed += batch.length;
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }
    const checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: "active",
      files,
      workspaceRoot: folderRoot
    };
    await this.metadataStore.write(id, checkpoint);
    return checkpoint;
  }
  /**
   * Creates a new checkpoint of the current workspace state (legacy single-root API).
   * Now delegates to createSession internally but returns a single Checkpoint for compatibility.
   *
   * @param workspaceId The unique ID of the workspace.
   * @param onProgress Optional progress callback.
   * @returns The created checkpoint.
   */
  async createCheckpoint(workspaceId, onProgress) {
    const id = this.generateId();
    const files = {};
    const paths = await this.scanner.scan();
    const entries = [...paths.entries()];
    const totalFiles = entries.length;
    const BATCH_SIZE = 50;
    let processed = 0;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ([relPath, meta]) => {
          const absPath = path3.join(this.workspaceRoot, relPath);
          const content = await fs4.readFile(absPath);
          const hash = await this.objectStore.write(content);
          return { relPath, hash, meta, isBinary: this.isBinary(content) };
        })
      );
      for (const r of results) {
        files[r.relPath] = {
          hash: r.hash,
          size: r.meta.size,
          mtime: r.meta.mtime,
          isBinary: r.isBinary
        };
      }
      processed += batch.length;
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }
    const checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: "active",
      files,
      workspaceRoot: this.workspaceRoot
    };
    await this.metadataStore.write(id, checkpoint);
    const lockFile = path3.join(this.metadataStore.storageBaseDir, "jguard.lock");
    await fs4.writeFile(lockFile, id, "utf-8");
    this.cleanOldCheckpoints().catch(console.error);
    return checkpoint;
  }
  /**
   * L7: Updates an existing checkpoint in the metadata store.
   */
  async updateCheckpoint(checkpoint) {
    await this.metadataStore.write(checkpoint.id, checkpoint);
  }
  /**
   * L7: Updates an existing session in the metadata store.
   */
  async updateSession(session) {
    await this.metadataStore.writeSession(session.id, session);
  }
  /**
   * Reads a checkpoint by ID from the metadata store.
   */
  async readCheckpoint(id) {
    return this.metadataStore.read(id);
  }
  /**
   * Cleans up old checkpoints, keeping only the most recent ones.
   * L7: Respects grace period — doesn't GC recently finalized checkpoints.
   */
  async cleanOldCheckpoints(keepCount = 3) {
    const GRACE_PERIOD = 5 * 60 * 1e3;
    const now = Date.now();
    const checkpointsDir = this.metadataStore.getCheckpointsDir();
    try {
      const dirFiles = await fs4.readdir(checkpointsDir);
      const cpFiles = dirFiles.filter((f) => f.endsWith(".json"));
      const checkpoints = [];
      for (const f of cpFiles) {
        const id = f.replace(".json", "");
        const cp = await this.metadataStore.read(id);
        checkpoints.push({ id, createdAt: cp.createdAt, finalizedAt: cp.finalizedAt });
      }
      checkpoints.sort((a, b) => b.createdAt - a.createdAt);
      const deletable = checkpoints.filter((cp) => {
        if (cp.finalizedAt && now - cp.finalizedAt < GRACE_PERIOD) {
          return false;
        }
        return true;
      });
      for (let i = keepCount; i < deletable.length; i++) {
        await this.metadataStore.delete(deletable[i].id);
      }
    } catch (e) {
    }
  }
};

// src/application/RestoreService.ts
var fs5 = __toESM(require("fs/promises"));
var RestoreService = class {
  constructor(objectStore) {
    this.objectStore = objectStore;
  }
  /**
   * Executes a restore plan safely.
   * @param plan The restore plan to execute.
   * @throws If a safety check fails during execution.
   */
  async execute(plan) {
    for (const op of plan.operations) {
      if (op.type === "write") {
        if (!op.objectHash)
          throw new Error("Write operation missing objectHash");
        const content = await this.objectStore.read(op.objectHash);
        const verifiedHash = Hasher.hashBuffer(content);
        if (verifiedHash !== op.objectHash) {
          throw new Error(`Hash mismatch during restore of ${op.relativePath}`);
        }
        try {
          const vscode6 = require("vscode");
          await vscode6.workspace.fs.writeFile(vscode6.Uri.file(op.absolutePath), content);
        } catch (e) {
          await fs5.writeFile(op.absolutePath, content);
        }
      } else if (op.type === "delete") {
        try {
          try {
            const vscode6 = require("vscode");
            await vscode6.workspace.fs.delete(vscode6.Uri.file(op.absolutePath), { useTrash: false });
          } catch (e) {
            await fs5.unlink(op.absolutePath);
          }
        } catch (err) {
          if (err.code !== "ENOENT" && err.name !== "EntryNotFound (FileSystemError)") {
            throw err;
          }
        }
      }
    }
  }
};

// src/vscode/WorkspaceScanner.ts
var vscode = __toESM(require("vscode"));
var fs6 = __toESM(require("fs/promises"));
var WorkspaceScanner = class {
  constructor(excludePatterns = ["**/node_modules/**", "**/.git/**", "**/dist/**"]) {
    this.excludePatterns = excludePatterns;
  }
  /**
   * Scans workspace files. 
   * L1: When folderUri is provided, scans only that folder and returns folder-relative paths.
   *     When omitted, scans all workspace folders — if multiple roots exist, prefixes paths
   *     with the folder name to avoid collisions.
   * L4: No hard file cap. Shows a non-blocking warning if > 100K files are found.
   *
   * @param folderUri Optional URI to scope scanning to a single workspace folder.
   */
  async scan(folderUri) {
    const map = /* @__PURE__ */ new Map();
    const excludeGlob = `{${this.excludePatterns.join(",")}}`;
    if (folderUri) {
      const pattern = new vscode.RelativePattern(folderUri, "**/*");
      const uris = await vscode.workspace.findFiles(pattern, excludeGlob);
      this.warnIfLarge(uris.length);
      for (const uri of uris) {
        if (uri.scheme === "file") {
          const stat3 = await fs6.stat(uri.fsPath);
          const relativePath = vscode.workspace.asRelativePath(uri, false);
          map.set(relativePath, {
            relativePath,
            size: stat3.size,
            mtime: stat3.mtimeMs
          });
        }
      }
    } else {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        return map;
      }
      const isMultiRoot = folders.length > 1;
      for (const folder of folders) {
        const pattern = new vscode.RelativePattern(folder.uri, "**/*");
        const uris = await vscode.workspace.findFiles(pattern, excludeGlob);
        for (const uri of uris) {
          if (uri.scheme === "file") {
            const stat3 = await fs6.stat(uri.fsPath);
            const folderRelPath = vscode.workspace.asRelativePath(uri, isMultiRoot);
            map.set(folderRelPath, {
              relativePath: folderRelPath,
              size: stat3.size,
              mtime: stat3.mtimeMs
            });
          }
        }
      }
      this.warnIfLarge(map.size);
    }
    return map;
  }
  /**
   * L4: Non-blocking warning when file count is very high.
   */
  warnIfLarge(count) {
    if (count > 1e5) {
      vscode.window.showInformationMessage(
        `JGuard: Scanning ${count.toLocaleString()} files. This may take a while. Consider adding exclusions to .gitignore or workspace settings.`
      );
    }
  }
};

// src/vscode/StatusBar.ts
var vscode2 = __toESM(require("vscode"));
var StatusBar = class {
  item;
  constructor() {
    this.item = vscode2.window.createStatusBarItem(vscode2.StatusBarAlignment.Left, 100);
    this.item.command = "jguard.toggleProtection";
    this.setState("off");
    this.item.show();
  }
  setState(state, changeCount = 0) {
    switch (state) {
      case "off":
        this.item.text = "$(shield) AI Guard: OFF";
        this.item.tooltip = "Click to enable AI Guard checkpoint";
        this.item.backgroundColor = void 0;
        this.item.command = "jguard.toggleProtection";
        break;
      case "protecting":
        this.item.text = "$(shield-check) AI Guard: PROTECTING";
        this.item.tooltip = "Workspace protected. Click to disable.";
        this.item.backgroundColor = void 0;
        this.item.command = "jguard.toggleProtection";
        break;
      case "changes":
        this.item.text = `$(repo-sync) AI Guard: ${changeCount} CHANGES`;
        this.item.tooltip = "AI changes detected. Click to review.";
        this.item.backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
        this.item.command = "jguardSidebar.focus";
        break;
      case "conflict":
        this.item.text = "$(alert) AI Guard: CONFLICT";
        this.item.tooltip = "Manual edits detected after AI changes. Review required.";
        this.item.backgroundColor = new vscode2.ThemeColor("statusBarItem.errorBackground");
        this.item.command = "jguardSidebar.focus";
        break;
      case "restoring":
        this.item.text = "$(sync~spin) AI Guard: RESTORING...";
        this.item.tooltip = "Restoring checkpoint...";
        this.item.backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
        this.item.command = void 0;
        break;
    }
  }
  dispose() {
    this.item.dispose();
  }
};

// src/vscode/Sidebar.ts
var vscode3 = __toESM(require("vscode"));
var path4 = __toESM(require("path"));
var GuardTreeItem = class extends vscode3.TreeItem {
  constructor(label, collapsibleState, change, decision, fileViewState, isBinary) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.change = change;
    this.decision = decision;
    this.fileViewState = fileViewState;
    this.isBinary = isBinary;
    if (change) {
      this.tooltip = this.buildTooltip(change);
      if (decision === "accepted") {
        this.description = `${change.type} \u2713 accepted`;
      } else if (decision === "rejected") {
        this.description = `${change.type} \u2717 rejected`;
      } else {
        if (fileViewState === "original") {
          this.description = `${change.type} (showing original)`;
        } else {
          this.description = change.type;
        }
      }
      if (decision === "accepted") {
        this.iconPath = new vscode3.ThemeIcon("check", new vscode3.ThemeColor("charts.green"));
      } else if (decision === "rejected") {
        this.iconPath = new vscode3.ThemeIcon("close", new vscode3.ThemeColor("charts.red"));
      } else if (isBinary) {
        this.iconPath = new vscode3.ThemeIcon("file-binary");
      } else if (change.type === "modified") {
        this.iconPath = new vscode3.ThemeIcon("edit");
      } else if (change.type === "created") {
        this.iconPath = new vscode3.ThemeIcon("add");
      } else if (change.type === "deleted") {
        this.iconPath = new vscode3.ThemeIcon("trash");
      }
      if (decision === "accepted") {
        this.contextValue = "jguard.changeItem.accepted";
      } else if (decision === "rejected") {
        this.contextValue = "jguard.changeItem.rejected";
      } else {
        this.contextValue = "jguard.changeItem";
      }
      this.command = {
        command: "jguard.openDiff",
        title: "Open Diff",
        arguments: [change]
      };
    }
  }
  buildTooltip(change) {
    const md = new vscode3.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${change.relativePath}**

`);
    md.appendMarkdown(`Type: \`${change.type}\`

`);
    md.appendMarkdown(`Click to view diff \u2022 Use inline buttons to Accept \u2713, Reject \u2717, or Toggle \u{1F441}`);
    return md;
  }
};
var SidebarProvider = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  // L1: Multi-root changesets
  changeSets = null;
  isProtecting = false;
  isHidden = false;
  // L3: Per-file view states
  fileViewStates = /* @__PURE__ */ new Map();
  /**
   * L1: Accepts either a Map of changesets (multi-root) or null.
   */
  refresh(changeSets, isProtecting, isHidden = false, fileViewStates) {
    this.changeSets = changeSets;
    this.isProtecting = isProtecting;
    this.isHidden = isHidden;
    this.fileViewStates = fileViewStates || /* @__PURE__ */ new Map();
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!this.isProtecting) {
      const item = new GuardTreeItem("Protection is OFF (Click to Enable)", vscode3.TreeItemCollapsibleState.None);
      item.command = {
        command: "jguard.toggleProtection",
        title: "Enable Protection"
      };
      item.iconPath = new vscode3.ThemeIcon("shield");
      item.tooltip = "Click to create a checkpoint and enable AI Guard protection";
      return Promise.resolve([item]);
    }
    if (!element) {
      const children = [
        new GuardTreeItem("Status: PROTECTING", vscode3.TreeItemCollapsibleState.None)
      ];
      if (!this.changeSets || this.changeSets.size === 0) {
        children.push(
          new GuardTreeItem("No changes detected yet", vscode3.TreeItemCollapsibleState.None)
        );
        return Promise.resolve(children);
      }
      const isMultiRoot = this.changeSets.size > 1;
      if (isMultiRoot) {
        for (const [wsRoot2, cs] of this.changeSets.entries()) {
          const folderName = path4.basename(wsRoot2);
          const count = cs.changes.length;
          if (count > 0) {
            const title = this.isHidden ? `\u{1F4C1} ${folderName} \u2014 Hidden (${count})` : `\u{1F4C1} ${folderName} \u2014 Changes (${count})`;
            const item = new GuardTreeItem(title, vscode3.TreeItemCollapsibleState.Expanded);
            item._wsRoot = wsRoot2;
            children.push(item);
          }
        }
      } else {
        const [, cs] = [...this.changeSets.entries()][0];
        if (cs.changes.length > 0) {
          const title = this.isHidden ? `Changes Hidden (Showing Original)` : `Changes (${cs.changes.length})`;
          const item = new GuardTreeItem(title, vscode3.TreeItemCollapsibleState.Expanded);
          item._wsRoot = [...this.changeSets.keys()][0];
          children.push(item);
        } else {
          children.push(
            new GuardTreeItem("No changes detected yet", vscode3.TreeItemCollapsibleState.None)
          );
        }
      }
      return Promise.resolve(children);
    }
    const wsRoot = element._wsRoot;
    if (wsRoot && this.changeSets?.has(wsRoot)) {
      const cs = this.changeSets.get(wsRoot);
      return Promise.resolve(
        cs.changes.map((c) => {
          const decision = cs.decisions[c.relativePath] || "pending";
          const viewState = this.fileViewStates.get(c.relativePath) || "ai";
          const isBinary = false;
          return new GuardTreeItem(
            c.relativePath,
            vscode3.TreeItemCollapsibleState.None,
            c,
            decision,
            viewState,
            isBinary
          );
        })
      );
    }
    return Promise.resolve([]);
  }
};

// src/vscode/DiffProvider.ts
var DiffProvider = class {
  constructor(objectStore) {
    this.objectStore = objectStore;
  }
  static scheme = "jguard";
  async provideTextDocumentContent(uri) {
    const hash = uri.authority;
    if (!hash) {
      return "";
    }
    try {
      const content = await this.objectStore.read(hash);
      return new TextDecoder().decode(content);
    } catch (err) {
      console.error(`Failed to read object ${hash} from store`, err);
      return "Error: Could not load file content from JGuard checkpoint.";
    }
  }
};

// src/vscode/Commands.ts
var vscode4 = __toESM(require("vscode"));
var path9 = __toESM(require("path"));
var fs7 = __toESM(require("fs/promises"));

// src/core/ChangeDetector.ts
var path5 = __toESM(require("path"));
var ChangeDetector = class {
  /**
   * Compares the current workspace state against a checkpoint.
   * @param checkpoint The active checkpoint.
   * @param scanner The scanner used to get the current file states.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static async detectChanges(checkpoint, scanner, workspaceRoot) {
    const currentPaths = await scanner.scan();
    const changes = [];
    const aiStateHashes = {};
    for (const [relPath, snapshot] of Object.entries(checkpoint.files)) {
      if (!currentPaths.has(relPath)) {
        changes.push({
          type: "deleted",
          relativePath: relPath,
          checkpointHash: snapshot.hash
        });
      } else {
        const current = currentPaths.get(relPath);
        if (current.mtime === snapshot.mtime && current.size === snapshot.size) {
          continue;
        }
        const absPath = path5.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        if (currentHash !== snapshot.hash) {
          changes.push({
            type: "modified",
            relativePath: relPath,
            checkpointHash: snapshot.hash,
            currentHash
          });
          aiStateHashes[relPath] = currentHash;
        }
      }
    }
    for (const [relPath, current] of currentPaths.entries()) {
      if (!checkpoint.files[relPath]) {
        const absPath = path5.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        changes.push({
          type: "created",
          relativePath: relPath,
          currentHash
        });
        aiStateHashes[relPath] = currentHash;
      }
    }
    const decisions = {};
    for (const change of changes) {
      decisions[change.relativePath] = "pending";
    }
    return {
      checkpointId: checkpoint.id,
      computedAt: Date.now(),
      changes,
      aiStateHashes,
      decisions
    };
  }
};

// src/core/ConflictDetector.ts
var path6 = __toESM(require("path"));
var ConflictDetector = class {
  /**
   * Detects if any files modified by the AI were subsequently modified by the user
   * before the reject operation was triggered.
   * 
   * @param changeSet The computed changeset representing AI modifications.
   * @param scanner The file scanner to get current workspace state.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static async detect(changeSet, scanner, workspaceRoot) {
    const conflicts = [];
    const currentPaths = await scanner.scan();
    for (const change of changeSet.changes) {
      if (change.type === "modified" || change.type === "created") {
        const currentMeta = currentPaths.get(change.relativePath);
        if (!currentMeta) {
          continue;
        }
        const absPath = path6.join(workspaceRoot, change.relativePath);
        const currentHash = await Hasher.hashFile(absPath);
        const aiHash = changeSet.aiStateHashes[change.relativePath];
        if (currentHash !== aiHash && (change.type === "modified" ? currentHash !== change.checkpointHash : true)) {
          conflicts.push({
            relativePath: change.relativePath,
            reason: "user_modified_post_ai",
            currentHash,
            checkpointHash: change.type === "modified" ? change.checkpointHash : ""
          });
        }
      }
    }
    return conflicts;
  }
};

// src/core/RestorePlanner.ts
var path7 = __toESM(require("path"));
var RestorePlanner = class {
  /**
   * Generates a deterministic plan of restore operations to rollback the workspace.
   * 
   * @param checkpoint The checkpoint to restore to.
   * @param changeSet The computed changeset.
   * @param conflicts A list of unresolvable conflicts (files to SKIP).
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static buildPlan(checkpoint, changeSet, conflicts, workspaceRoot) {
    const plan = { operations: [] };
    const conflictPaths = new Set(conflicts.map((c) => c.relativePath));
    for (const change of changeSet.changes) {
      if (conflictPaths.has(change.relativePath)) {
        continue;
      }
      const absPath = path7.join(workspaceRoot, change.relativePath);
      if (change.type === "modified") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      } else if (change.type === "created") {
        plan.operations.push({
          type: "delete",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: null
        });
      } else if (change.type === "deleted") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      }
    }
    plan.operations.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "delete" ? -1 : 1;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });
    return plan;
  }
};

// src/core/SelectiveRestorePlanner.ts
var path8 = __toESM(require("path"));
var SelectiveRestorePlanner = class {
  /**
   * Generates a restore plan that only restores rejected files.
   * Accepted and pending files are left untouched.
   */
  static buildPlan(checkpoint, changeSet, conflicts, workspaceRoot) {
    const plan = { operations: [] };
    const conflictPaths = new Set(conflicts.map((c) => c.relativePath));
    const rejectedChanges = changeSet.changes.filter(
      (c) => changeSet.decisions[c.relativePath] === "rejected"
    );
    for (const change of rejectedChanges) {
      if (conflictPaths.has(change.relativePath)) {
        continue;
      }
      const absPath = path8.join(workspaceRoot, change.relativePath);
      if (change.type === "modified") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      } else if (change.type === "created") {
        plan.operations.push({
          type: "delete",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: null
        });
      } else if (change.type === "deleted") {
        plan.operations.push({
          type: "write",
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash
        });
      }
    }
    plan.operations.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "delete" ? -1 : 1;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });
    return plan;
  }
  /**
   * L2/L3: Builds a single-file restore plan.
   * Used for per-file reject and per-file toggle.
   */
  static buildSingleFilePlan(change, objectHash, workspaceRoot) {
    const absPath = path8.join(workspaceRoot, change.relativePath);
    const plan = { operations: [] };
    if (change.type === "modified" || change.type === "deleted") {
      plan.operations.push({
        type: "write",
        relativePath: change.relativePath,
        absolutePath: absPath,
        objectHash
      });
    } else if (change.type === "created") {
      plan.operations.push({
        type: "delete",
        relativePath: change.relativePath,
        absolutePath: absPath,
        objectHash: null
      });
    }
    return plan;
  }
};

// src/vscode/Commands.ts
var Commands = class {
  constructor(context, checkpointService, restoreService, scanner, sidebar, statusBar2, objectStore) {
    this.context = context;
    this.checkpointService = checkpointService;
    this.restoreService = restoreService;
    this.scanner = scanner;
    this.sidebar = sidebar;
    this.statusBar = statusBar2;
    this.objectStore = objectStore;
  }
  // L1: Session-based state (multi-root)
  activeSession = null;
  forwardSession = null;
  // Per-folder changesets (L1: one per workspace folder)
  changeSets = /* @__PURE__ */ new Map();
  // wsRoot → ChangeSet
  // L2: AI snapshot hashes for rejected files (so they can be toggled back)
  aiSnapshotHashes = /* @__PURE__ */ new Map();
  // relPath → hash in ObjectStore
  // L3: Per-file view state
  fileViewStates = /* @__PURE__ */ new Map();
  // relPath → 'ai' | 'original'
  // L7: Last finalized session ID for undo
  lastFinalizedSessionId = null;
  lastFinalizedAt = 0;
  // Bulk view state for backward-compat bulk toggle
  viewState = "ai";
  register() {
    this.context.subscriptions.push(
      vscode4.commands.registerCommand("jguard.toggleProtection", this.toggleProtection.bind(this)),
      vscode4.commands.registerCommand("jguard.toggleChanges", this.toggleChanges.bind(this)),
      vscode4.commands.registerCommand("jguard.openDiff", this.openDiff.bind(this)),
      vscode4.commands.registerCommand("jguard.acceptAll", this.acceptAll.bind(this)),
      vscode4.commands.registerCommand("jguard.rejectAll", this.rejectAll.bind(this)),
      vscode4.commands.registerCommand("jguard.refresh", this.refresh.bind(this)),
      // L2: Per-file accept/reject
      vscode4.commands.registerCommand("jguard.acceptFile", this.acceptFile.bind(this)),
      vscode4.commands.registerCommand("jguard.rejectFile", this.rejectFile.bind(this)),
      vscode4.commands.registerCommand("jguard.finalize", this.finalize.bind(this)),
      // L3: Per-file toggle
      vscode4.commands.registerCommand("jguard.toggleFile", this.toggleFile.bind(this))
    );
    const watcher = vscode4.workspace.createFileSystemWatcher("**/*");
    const onDidChange = async () => {
      if (this.activeSession) {
        await this.refresh();
      }
    };
    this.context.subscriptions.push(
      watcher.onDidChange(onDidChange),
      watcher.onDidCreate(onDidChange),
      watcher.onDidDelete(onDidChange),
      watcher
    );
  }
  /**
   * Provides a way to restore session state (used for crash recovery).
   */
  restoreSessionState(session) {
    this.activeSession = session;
  }
  async toggleProtection() {
    if (this.activeSession) {
      const action = await vscode4.window.showInformationMessage(
        "AI Guard is currently active. Do you want to Accept all changes or Reject all changes?",
        "Accept All",
        "Reject All",
        "Cancel"
      );
      if (action === "Accept All") {
        await this.acceptAll();
      } else if (action === "Reject All") {
        await this.rejectAll();
      }
      return;
    }
    const workspaceFolders = vscode4.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode4.window.showErrorMessage("JGuard requires an open workspace.");
      return;
    }
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    vscode4.window.withProgress({
      location: vscode4.ProgressLocation.Notification,
      title: "AI Guard: Creating Checkpoint...",
      cancellable: false
    }, async (progress) => {
      try {
        const folderPaths = workspaceFolders.map((f) => f.uri.fsPath);
        this.activeSession = await this.checkpointService.createSession(
          "ws-id",
          folderPaths,
          (processed, total) => {
            const pct = Math.round(processed / total * 100);
            progress.report({
              message: `(${processed.toLocaleString()} / ${total.toLocaleString()} files)`,
              increment: pct
            });
          }
        );
        this.statusBar.setState("protecting");
        this.sidebar.refresh(null, true);
        const folderCount = Object.keys(this.activeSession.folderCheckpoints).length;
        const msg = folderCount > 1 ? `AI Guard: Checkpoint created across ${folderCount} workspace folders. You are now protected.` : "AI Guard: Workspace checkpoint created. You are now protected.";
        vscode4.window.showInformationMessage(msg);
      } catch (err) {
        vscode4.window.showErrorMessage(`Failed to create checkpoint: ${err.message}`);
      }
    });
  }
  async refresh() {
    if (!this.activeSession)
      return;
    this.changeSets.clear();
    let totalCount = 0;
    for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
      const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
      const existingCs = this.changeSets.get(wsRoot);
      if (existingCs) {
        for (const change of changeSet.changes) {
          if (existingCs.decisions[change.relativePath]) {
            changeSet.decisions[change.relativePath] = existingCs.decisions[change.relativePath];
          }
        }
      }
      this.changeSets.set(wsRoot, changeSet);
      totalCount += changeSet.changes.length;
    }
    if (totalCount > 0) {
      this.statusBar.setState("changes", totalCount);
    } else {
      this.statusBar.setState("protecting");
    }
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
  }
  async openDiff(change) {
    if (!this.activeSession)
      return;
    const wsFolder = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsFolder)
      return;
    const currentUri = vscode4.Uri.file(path9.join(wsFolder, change.relativePath));
    let originalUri;
    if (change.type === "created") {
      originalUri = vscode4.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`);
    } else {
      const hash = change.type === "modified" ? change.checkpointHash : change.checkpointHash;
      originalUri = vscode4.Uri.parse(`${DiffProvider.scheme}://${hash}/${change.relativePath}`);
    }
    const checkpoint = this.activeSession.folderCheckpoints[wsFolder];
    const snapshot = checkpoint?.files[change.relativePath];
    if (snapshot?.isBinary) {
      if (this.isImageFile(change.relativePath)) {
        await this.openBinaryComparison(change, wsFolder);
      } else {
        vscode4.window.showInformationMessage(
          `Binary file changed: ${change.relativePath}
Original: ${snapshot.size} bytes (${snapshot.hash.slice(0, 8)}\u2026)
Current state differs`
        );
      }
      return;
    }
    const title = `${change.relativePath} (Checkpoint \u2194 Current)`;
    if (change.type === "deleted") {
      await vscode4.commands.executeCommand("vscode.diff", originalUri, vscode4.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`), title);
    } else {
      await vscode4.commands.executeCommand("vscode.diff", originalUri, currentUri, title);
    }
  }
  async toggleChanges() {
    if (!this.activeSession) {
      vscode4.window.showInformationMessage("AI Guard is not active.");
      return;
    }
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    vscode4.window.withProgress({
      location: vscode4.ProgressLocation.Notification,
      title: this.viewState === "ai" ? "AI Guard: Hiding Changes..." : "AI Guard: Applying Changes...",
      cancellable: false
    }, async () => {
      try {
        if (this.viewState === "ai") {
          this.forwardSession = await this.createForwardSession();
          const lockFile = path9.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
          await fs7.writeFile(lockFile, this.activeSession.id, "utf-8");
          for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
            const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
            const plan = RestorePlanner.buildPlan(checkpoint, changeSet, [], wsRoot);
            await this.restoreService.execute(plan);
          }
          this.viewState = "original";
          this.fileViewStates.clear();
          for (const cs of this.changeSets.values()) {
            for (const change of cs.changes) {
              this.fileViewStates.set(change.relativePath, "original");
            }
          }
          this.statusBar.setState("changes", this.getTotalChangeCount());
          this.sidebar.refresh(this.changeSets, true, true, this.fileViewStates);
          vscode4.window.showInformationMessage("AI Guard: Changes hidden (showing Original).");
        } else {
          if (!this.forwardSession)
            return;
          for (const [wsRoot, checkpoint] of Object.entries(this.forwardSession.folderCheckpoints)) {
            const forwardChangeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
            const plan = RestorePlanner.buildPlan(checkpoint, forwardChangeSet, [], wsRoot);
            await this.restoreService.execute(plan);
          }
          this.viewState = "ai";
          this.fileViewStates.clear();
          await this.refresh();
          vscode4.window.showInformationMessage("AI Guard: Changes applied (showing AI).");
        }
      } catch (err) {
        vscode4.window.showErrorMessage(`Toggle failed: ${err.message}`);
      }
    });
  }
  // ─── L2: Per-File Accept ─────────────────────────────────────────────
  async acceptFile(change) {
    if (!this.activeSession)
      return;
    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot)
      return;
    const cs = this.changeSets.get(wsRoot);
    if (!cs)
      return;
    cs.decisions[change.relativePath] = "accepted";
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    vscode4.window.showInformationMessage(`\u2713 Accepted: ${change.relativePath}`);
  }
  // ─── L2: Per-File Reject (Immediate + Auto-Snapshot) ─────────────────
  async rejectFile(change) {
    if (!this.activeSession)
      return;
    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot)
      return;
    const cs = this.changeSets.get(wsRoot);
    const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
    if (!cs || !checkpoint)
      return;
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    try {
      const absPath = path9.join(wsRoot, change.relativePath);
      if (change.type !== "deleted") {
        const aiContent = await fs7.readFile(absPath);
        const aiHash = await this.objectStore.write(aiContent);
        this.aiSnapshotHashes.set(change.relativePath, aiHash);
      }
      if (change.type === "modified" || change.type === "deleted") {
        const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, change.checkpointHash, wsRoot);
        await this.restoreService.execute(plan);
      } else if (change.type === "created") {
        const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
        await this.restoreService.execute(plan);
      }
      cs.decisions[change.relativePath] = "rejected";
      this.fileViewStates.set(change.relativePath, "original");
      this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
      vscode4.window.showInformationMessage(`\u2717 Rejected: ${change.relativePath} (AI version saved \u2014 toggle back anytime)`);
    } catch (err) {
      vscode4.window.showErrorMessage(`Failed to reject ${change.relativePath}: ${err.message}`);
    }
  }
  // ─── L3: Per-File Toggle ─────────────────────────────────────────────
  async toggleFile(change) {
    if (!this.activeSession)
      return;
    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot)
      return;
    const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
    if (!checkpoint)
      return;
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    const currentState = this.fileViewStates.get(change.relativePath) || "ai";
    try {
      if (currentState === "ai") {
        const absPath = path9.join(wsRoot, change.relativePath);
        if (change.type !== "deleted") {
          const aiContent = await fs7.readFile(absPath);
          const aiHash = await this.objectStore.write(aiContent);
          this.aiSnapshotHashes.set(change.relativePath, aiHash);
        }
        if (change.type === "modified" || change.type === "deleted") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, change.checkpointHash, wsRoot);
          await this.restoreService.execute(plan);
        } else if (change.type === "created") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
          await this.restoreService.execute(plan);
        }
        this.fileViewStates.set(change.relativePath, "original");
      } else {
        const aiHash = this.aiSnapshotHashes.get(change.relativePath);
        if (!aiHash && change.type !== "deleted") {
          vscode4.window.showWarningMessage(`No AI snapshot found for ${change.relativePath}.`);
          return;
        }
        if (change.type === "created" || change.type === "modified") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, aiHash, wsRoot);
          await this.restoreService.execute(plan);
        } else if (change.type === "deleted") {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
          await this.restoreService.execute(plan);
        }
        this.fileViewStates.set(change.relativePath, "ai");
      }
      this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    } catch (err) {
      vscode4.window.showErrorMessage(`Toggle failed for ${change.relativePath}: ${err.message}`);
    }
  }
  // ─── L2: Finalize Session ────────────────────────────────────────────
  async finalize() {
    if (!this.activeSession)
      return;
    const pendingCount = this.countPendingDecisions();
    if (pendingCount > 0) {
      const action = await vscode4.window.showInformationMessage(
        `${pendingCount} file(s) have no decision yet. What should happen to them?`,
        "Accept Remaining",
        "Reject Remaining",
        "Cancel"
      );
      if (action === "Accept Remaining") {
        this.markAllPending("accepted");
      } else if (action === "Reject Remaining") {
        this.markAllPending("rejected");
        await this.executeSelectiveRestore();
      } else {
        return;
      }
    }
    await this.cleanupSession();
    vscode4.window.showInformationMessage("AI Guard: Session finalized.");
  }
  // ─── Accept / Reject All ─────────────────────────────────────────────
  async acceptAll() {
    if (!this.activeSession)
      return;
    if (this.viewState === "original") {
      const choice = await vscode4.window.showWarningMessage(
        "You are currently viewing the Original state. Finalizing now will permanently discard the hidden AI changes. Continue?",
        "Discard AI Changes",
        "Cancel"
      );
      if (choice !== "Discard AI Changes")
        return;
    }
    this.markAllPending("accepted");
    const session = this.activeSession;
    this.lastFinalizedSessionId = session.id;
    this.lastFinalizedAt = Date.now();
    session.status = "accepted";
    for (const cp of Object.values(session.folderCheckpoints)) {
      cp.status = "accepted";
      cp.finalizedAt = this.lastFinalizedAt;
      await this.checkpointService.updateCheckpoint(cp);
    }
    await this.checkpointService.updateSession(session);
    await this.cleanupSession();
    const gracePeriodMin = vscode4.workspace.getConfiguration("jguard").get("undoGracePeriodMinutes", 5);
    vscode4.window.showInformationMessage(
      `AI Guard: Changes accepted. You can undo within ${gracePeriodMin} minutes.`,
      "Undo Accept"
    ).then(async (choice) => {
      if (choice === "Undo Accept" && this.lastFinalizedSessionId) {
        const elapsed = Date.now() - this.lastFinalizedAt;
        if (elapsed < gracePeriodMin * 60 * 1e3) {
          await this.undoAccept();
        } else {
          vscode4.window.showWarningMessage("Grace period expired. Cannot undo.");
        }
      }
    });
  }
  async rejectAll() {
    if (!this.activeSession)
      return;
    if (this.viewState === "original") {
      await this.cleanupSession();
      vscode4.window.showInformationMessage("AI Guard: Protection discarded. Original state kept.");
      return;
    }
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
      const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
      const conflicts = await ConflictDetector.detect(changeSet, this.scanner, wsRoot);
      if (conflicts.length > 0) {
        this.statusBar.setState("conflict");
        const msg = `AI Guard: ${conflicts.length} conflict(s) detected in ${path9.basename(wsRoot)}. Conflicted files will be skipped.`;
        const choice = await vscode4.window.showWarningMessage(msg, "Proceed Anyway", "Cancel");
        if (choice !== "Proceed Anyway")
          return;
        await this.executeRestore(checkpoint, changeSet, conflicts, wsRoot);
      } else {
        await this.executeRestore(checkpoint, changeSet, [], wsRoot);
      }
    }
    await this.cleanupSession();
    vscode4.window.showInformationMessage("AI Guard: Checkpoint discarded and safely reverted.");
  }
  // ─── L7: Undo Accept ────────────────────────────────────────────────
  async undoAccept() {
    if (!this.lastFinalizedSessionId)
      return;
    try {
      const session = await this.checkpointService.metadataStore.readSession(this.lastFinalizedSessionId);
      session.status = "active";
      for (const cp of Object.values(session.folderCheckpoints)) {
        cp.status = "active";
        cp.finalizedAt = void 0;
      }
      this.activeSession = session;
      this.lastFinalizedSessionId = null;
      this.lastFinalizedAt = 0;
      const lockFile = path9.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
      await fs7.writeFile(lockFile, session.id, "utf-8");
      this.statusBar.setState("protecting");
      await this.refresh();
      vscode4.window.showInformationMessage("AI Guard: Accept undone. Protection resumed.");
    } catch (err) {
      vscode4.window.showErrorMessage(`Failed to undo accept: ${err.message}`);
    }
  }
  // ─── Internal Helpers ────────────────────────────────────────────────
  async executeRestore(cp, cs, conflicts, wsFolder) {
    this.statusBar.setState("restoring");
    const plan = RestorePlanner.buildPlan(cp, cs, conflicts, wsFolder);
    await this.restoreService.execute(plan);
  }
  async executeSelectiveRestore() {
    if (!this.activeSession)
      return;
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
      if (!checkpoint)
        continue;
      const plan = SelectiveRestorePlanner.buildPlan(checkpoint, cs, [], wsRoot);
      if (plan.operations.length > 0) {
        this.statusBar.setState("restoring");
        await this.restoreService.execute(plan);
      }
    }
  }
  async cleanupSession() {
    this.activeSession = null;
    this.forwardSession = null;
    this.changeSets.clear();
    this.fileViewStates.clear();
    this.aiSnapshotHashes.clear();
    this.viewState = "ai";
    this.statusBar.setState("off");
    this.sidebar.refresh(null, false);
    await this.clearLockFile();
  }
  async clearLockFile() {
    const lockFile = path9.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
    await fs7.unlink(lockFile).catch(() => {
    });
  }
  async createForwardSession() {
    const folders = vscode4.workspace.workspaceFolders;
    if (!folders)
      throw new Error("No workspace folders");
    const folderCheckpoints = {};
    for (const folder of folders) {
      const wsRoot = folder.uri.fsPath;
      const cp = await this.checkpointService.createCheckpoint(wsRoot);
      folderCheckpoints[wsRoot] = cp;
    }
    return {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      createdAt: Date.now(),
      folderCheckpoints,
      status: "active"
    };
  }
  /**
   * L1: Finds which workspace root owns a given relative path.
   */
  findWorkspaceRootForFile(relativePath) {
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      if (cs.changes.some((c) => c.relativePath === relativePath)) {
        return wsRoot;
      }
    }
    const folders = vscode4.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }
  getTotalChangeCount() {
    let total = 0;
    for (const cs of this.changeSets.values()) {
      total += cs.changes.length;
    }
    return total;
  }
  countPendingDecisions() {
    let count = 0;
    for (const cs of this.changeSets.values()) {
      for (const decision of Object.values(cs.decisions)) {
        if (decision === "pending")
          count++;
      }
    }
    return count;
  }
  markAllPending(decision) {
    for (const cs of this.changeSets.values()) {
      for (const relPath of Object.keys(cs.decisions)) {
        if (cs.decisions[relPath] === "pending") {
          cs.decisions[relPath] = decision;
        }
      }
    }
  }
  // L6: Image file detection
  isImageFile(filePath) {
    const ext = path9.extname(filePath).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"].includes(ext);
  }
  // L6: Open binary image comparison
  async openBinaryComparison(change, wsRoot) {
    try {
      const checkpoint = this.activeSession?.folderCheckpoints[wsRoot];
      if (!checkpoint)
        return;
      const snapshot = checkpoint.files[change.relativePath];
      if (!snapshot)
        return;
      const content = await this.objectStore.read(snapshot.hash);
      const tmpDir = path9.join(this.checkpointService.metadataStore.storageBaseDir, "tmp");
      await fs7.mkdir(tmpDir, { recursive: true });
      const tmpFile = path9.join(tmpDir, `checkpoint-${path9.basename(change.relativePath)}`);
      await fs7.writeFile(tmpFile, content);
      const originalUri = vscode4.Uri.file(tmpFile);
      const currentUri = vscode4.Uri.file(path9.join(wsRoot, change.relativePath));
      await vscode4.commands.executeCommand("vscode.open", originalUri, { viewColumn: vscode4.ViewColumn.One });
      await vscode4.commands.executeCommand("vscode.open", currentUri, { viewColumn: vscode4.ViewColumn.Two });
    } catch (err) {
      vscode4.window.showErrorMessage(`Failed to compare binary file: ${err.message}`);
    }
  }
};

// src/extension.ts
var path10 = __toESM(require("path"));
var fs8 = __toESM(require("fs/promises"));
var statusBar;
var commands2;
async function activate(context) {
  console.log("JGuard is now active.");
  const storageBaseDir = context.globalStorageUri.fsPath;
  const metadataStore = new MetadataStore(storageBaseDir);
  const objectStore = new ObjectStore(storageBaseDir);
  await metadataStore.initialize();
  await objectStore.initialize();
  let wsRoot = "";
  if (vscode5.workspace.workspaceFolders && vscode5.workspace.workspaceFolders.length > 0) {
    wsRoot = vscode5.workspace.workspaceFolders[0].uri.fsPath;
  }
  const scanner = new WorkspaceScanner();
  const checkpointService = new CheckpointService(metadataStore, objectStore, scanner, wsRoot);
  const restoreService = new RestoreService(objectStore);
  statusBar = new StatusBar();
  const sidebar = new SidebarProvider();
  const diffProvider = new DiffProvider(objectStore);
  vscode5.window.registerTreeDataProvider("jguardSidebar", sidebar);
  vscode5.workspace.registerTextDocumentContentProvider(DiffProvider.scheme, diffProvider);
  commands2 = new Commands(context, checkpointService, restoreService, scanner, sidebar, statusBar, objectStore);
  commands2.register();
  const lockFile = path10.join(storageBaseDir, "jguard.lock");
  try {
    const activeId = await fs8.readFile(lockFile, "utf-8");
    if (activeId) {
      vscode5.window.showWarningMessage(
        "AI Guard: Found an active checkpoint from a previous session. Do you want to resume protecting?",
        "Resume",
        "Discard"
      ).then(async (choice) => {
        if (choice === "Resume") {
          try {
            let session;
            try {
              session = await metadataStore.readSession(activeId.trim());
            } catch {
              const cp = await metadataStore.read(activeId.trim());
              const wsRoot2 = cp.workspaceRoot || (vscode5.workspace.workspaceFolders?.[0]?.uri.fsPath || "");
              session = {
                id: activeId.trim(),
                createdAt: cp.createdAt,
                folderCheckpoints: { [wsRoot2]: cp },
                status: "active"
              };
            }
            commands2.restoreSessionState(session);
            statusBar.setState("protecting");
            await commands2.refresh();
          } catch (e) {
            vscode5.window.showErrorMessage("Failed to resume checkpoint. It may be corrupted.");
            await fs8.unlink(lockFile).catch(() => {
            });
          }
        } else if (choice === "Discard") {
          await fs8.unlink(lockFile).catch(() => {
          });
        }
      });
    }
  } catch (e) {
  }
}
function deactivate() {
  if (statusBar)
    statusBar.dispose();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
