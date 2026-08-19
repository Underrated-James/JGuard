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
  getCheckpointPath(id) {
    return path.join(this.getCheckpointsDir(), `${id}.json`);
  }
  /**
   * Initializes the checkpoints directory structure.
   */
  async initialize() {
    await fs.mkdir(this.getCheckpointsDir(), { recursive: true });
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
   * Creates a new checkpoint of the current workspace state.
   * @param workspaceId The unique ID of the workspace.
   * @returns The created checkpoint.
   */
  async createCheckpoint(workspaceId) {
    const id = this.generateId();
    const files = {};
    const paths = await this.scanner.scan();
    for (const [relPath, meta] of paths.entries()) {
      const absPath = path3.join(this.workspaceRoot, relPath);
      const fs5 = require("fs/promises");
      const content = await fs5.readFile(absPath);
      const hash = await this.objectStore.write(content);
      files[relPath] = {
        hash,
        size: meta.size,
        mtime: meta.mtime,
        isBinary: this.isBinary(content)
      };
    }
    const checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: "active",
      files
    };
    await this.metadataStore.write(id, checkpoint);
    const lockFile = path3.join(this.metadataStore.storageBaseDir, "jguard.lock");
    const fs22 = require("fs/promises");
    await fs22.writeFile(lockFile, id, "utf-8");
    this.cleanOldCheckpoints().catch(console.error);
    return checkpoint;
  }
  /**
   * Cleans up old checkpoints, keeping only the most recent ones.
   */
  async cleanOldCheckpoints(keepCount = 3) {
    const fs5 = require("fs/promises");
    const checkpointsDir = this.metadataStore.getCheckpointsDir();
    try {
      const files = await fs5.readdir(checkpointsDir);
      const cpFiles = files.filter((f) => f.endsWith(".json"));
      const checkpoints = [];
      for (const f of cpFiles) {
        const id = f.replace(".json", "");
        const cp = await this.metadataStore.read(id);
        checkpoints.push({ id, createdAt: cp.createdAt });
      }
      checkpoints.sort((a, b) => b.createdAt - a.createdAt);
      for (let i = keepCount; i < checkpoints.length; i++) {
        await this.metadataStore.delete(checkpoints[i].id);
      }
    } catch (e) {
    }
  }
};

// src/application/RestoreService.ts
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
        await require("vscode").workspace.fs.writeFile(require("vscode").Uri.file(op.absolutePath), content);
      } else if (op.type === "delete") {
        try {
          await require("vscode").workspace.fs.delete(require("vscode").Uri.file(op.absolutePath), { useTrash: false });
        } catch (err) {
          if (err.code !== "ENOENT") {
            throw err;
          }
        }
      }
    }
  }
};

// src/vscode/WorkspaceScanner.ts
var vscode = __toESM(require("vscode"));
var fs4 = __toESM(require("fs/promises"));
var WorkspaceScanner = class {
  constructor(excludePatterns = ["**/node_modules/**", "**/.git/**", "**/dist/**"]) {
    this.excludePatterns = excludePatterns;
  }
  async scan() {
    const map = /* @__PURE__ */ new Map();
    const excludeGlob = `{${this.excludePatterns.join(",")}}`;
    const uris = await vscode.workspace.findFiles("**/*", excludeGlob);
    if (uris.length > 5e4) {
      throw new Error(`Workspace is too large for JGuard MVP (${uris.length} files). Please add more specific exclusions to .vscodeignore or .gitignore.`);
    }
    for (const uri of uris) {
      if (uri.scheme === "file") {
        const stat3 = await fs4.stat(uri.fsPath);
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        map.set(relativePath, {
          relativePath,
          size: stat3.size,
          mtime: stat3.mtimeMs
        });
      }
    }
    return map;
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
        break;
      case "protecting":
        this.item.text = "$(shield-check) AI Guard: PROTECTING";
        this.item.tooltip = "Workspace protected. Click to disable.";
        this.item.backgroundColor = void 0;
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
var GuardTreeItem = class extends vscode3.TreeItem {
  constructor(label, collapsibleState, change) {
    super(label, collapsibleState);
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.change = change;
    if (change) {
      this.tooltip = change.relativePath;
      this.description = change.type;
      if (change.type === "modified") {
        this.iconPath = new vscode3.ThemeIcon("edit");
      } else if (change.type === "created") {
        this.iconPath = new vscode3.ThemeIcon("add");
      } else if (change.type === "deleted") {
        this.iconPath = new vscode3.ThemeIcon("trash");
      }
      this.command = {
        command: "jguard.openDiff",
        title: "Open Diff",
        arguments: [change]
      };
    }
  }
};
var SidebarProvider = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  currentChangeSet = null;
  isProtecting = false;
  isHidden = false;
  refresh(changeSet, isProtecting, isHidden = false) {
    this.currentChangeSet = changeSet;
    this.isProtecting = isProtecting;
    this.isHidden = isHidden;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!this.isProtecting) {
      return Promise.resolve([
        new GuardTreeItem("Protection is OFF", vscode3.TreeItemCollapsibleState.None)
      ]);
    }
    if (!element) {
      const children = [
        new GuardTreeItem("Status: PROTECTING", vscode3.TreeItemCollapsibleState.None)
      ];
      if (this.currentChangeSet && this.currentChangeSet.changes.length > 0) {
        const title = this.isHidden ? `Changes Hidden (Showing Original)` : `Changes (${this.currentChangeSet.changes.length})`;
        children.push(
          new GuardTreeItem(
            title,
            vscode3.TreeItemCollapsibleState.Expanded
          )
        );
      } else {
        children.push(
          new GuardTreeItem("No changes detected yet", vscode3.TreeItemCollapsibleState.None)
        );
      }
      return Promise.resolve(children);
    } else if (element.label.startsWith("Changes")) {
      if (this.currentChangeSet) {
        return Promise.resolve(
          this.currentChangeSet.changes.map(
            (c) => new GuardTreeItem(c.relativePath, vscode3.TreeItemCollapsibleState.None, c)
          )
        );
      }
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
var path7 = __toESM(require("path"));

// src/core/ChangeDetector.ts
var path4 = __toESM(require("path"));
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
        const absPath = path4.join(workspaceRoot, relPath);
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
        const absPath = path4.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        changes.push({
          type: "created",
          relativePath: relPath,
          currentHash
        });
        aiStateHashes[relPath] = currentHash;
      }
    }
    return {
      checkpointId: checkpoint.id,
      computedAt: Date.now(),
      changes,
      aiStateHashes
    };
  }
};

// src/core/ConflictDetector.ts
var path5 = __toESM(require("path"));
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
        const absPath = path5.join(workspaceRoot, change.relativePath);
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
var path6 = __toESM(require("path"));
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
      const absPath = path6.join(workspaceRoot, change.relativePath);
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

// src/vscode/Commands.ts
var Commands = class {
  constructor(context, checkpointService, restoreService, scanner, sidebar, statusBar2) {
    this.context = context;
    this.checkpointService = checkpointService;
    this.restoreService = restoreService;
    this.scanner = scanner;
    this.sidebar = sidebar;
    this.statusBar = statusBar2;
  }
  activeCheckpoint = null;
  currentChangeSet = null;
  forwardCheckpoint = null;
  viewState = "ai";
  register() {
    this.context.subscriptions.push(
      vscode4.commands.registerCommand("jguard.toggleProtection", this.toggleProtection.bind(this)),
      vscode4.commands.registerCommand("jguard.toggleChanges", this.toggleChanges.bind(this)),
      vscode4.commands.registerCommand("jguard.openDiff", this.openDiff.bind(this)),
      vscode4.commands.registerCommand("jguard.acceptAll", this.acceptAll.bind(this)),
      vscode4.commands.registerCommand("jguard.rejectAll", this.rejectAll.bind(this)),
      vscode4.commands.registerCommand("jguard.refresh", this.refresh.bind(this))
    );
    const watcher = vscode4.workspace.createFileSystemWatcher("**/*");
    const onDidChange = async () => {
      if (this.activeCheckpoint) {
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
  async toggleProtection() {
    if (this.activeCheckpoint) {
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
    }, async () => {
      try {
        const workspaceId = "ws-id";
        this.activeCheckpoint = await this.checkpointService.createCheckpoint(workspaceId);
        this.statusBar.setState("protecting");
        this.sidebar.refresh(null, true);
        vscode4.window.showInformationMessage("AI Guard: Workspace checkpoint created. You are now protected.");
      } catch (err) {
        vscode4.window.showErrorMessage(`Failed to create checkpoint: ${err.message}`);
      }
    });
  }
  async refresh() {
    if (!this.activeCheckpoint)
      return;
    const root = vscode4.workspace.workspaceFolders[0].uri.fsPath;
    this.currentChangeSet = await ChangeDetector.detectChanges(this.activeCheckpoint, this.scanner, root);
    const count = this.currentChangeSet.changes.length;
    if (count > 0) {
      this.statusBar.setState("changes", count);
    } else {
      this.statusBar.setState("protecting");
    }
    this.sidebar.refresh(this.currentChangeSet, true);
  }
  async openDiff(change) {
    if (!this.activeCheckpoint)
      return;
    const wsFolder = vscode4.workspace.workspaceFolders[0].uri.fsPath;
    const currentUri = vscode4.Uri.file(path7.join(wsFolder, change.relativePath));
    let originalUri;
    if (change.type === "created") {
      originalUri = vscode4.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`);
    } else {
      const hash = change.type === "modified" ? change.checkpointHash : change.checkpointHash;
      originalUri = vscode4.Uri.parse(`${DiffProvider.scheme}://${hash}/${change.relativePath}`);
    }
    const title = `${change.relativePath} (Checkpoint \u2194 Current)`;
    if (change.type === "deleted") {
      await vscode4.commands.executeCommand("vscode.diff", originalUri, vscode4.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`), title);
    } else {
      await vscode4.commands.executeCommand("vscode.diff", originalUri, currentUri, title);
    }
  }
  async toggleChanges() {
    if (!this.activeCheckpoint) {
      vscode4.window.showInformationMessage("AI Guard is not active.");
      return;
    }
    const wsFolder = vscode4.workspace.workspaceFolders[0].uri.fsPath;
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    vscode4.window.withProgress({
      location: vscode4.ProgressLocation.Notification,
      title: this.viewState === "ai" ? "AI Guard: Hiding Changes..." : "AI Guard: Applying Changes...",
      cancellable: false
    }, async () => {
      try {
        if (this.viewState === "ai") {
          this.forwardCheckpoint = await this.checkpointService.createCheckpoint("ws-id");
          const fs5 = require("fs/promises");
          const lockFile = path7.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
          await fs5.writeFile(lockFile, this.activeCheckpoint.id, "utf-8");
          this.currentChangeSet = await ChangeDetector.detectChanges(this.activeCheckpoint, this.scanner, wsFolder);
          const plan = RestorePlanner.buildPlan(this.activeCheckpoint, this.currentChangeSet, [], wsFolder);
          this.statusBar.setState("restoring");
          await this.restoreService.execute(plan);
          this.viewState = "original";
          this.statusBar.setState("changes", this.currentChangeSet.changes.length);
          this.sidebar.refresh(this.currentChangeSet, true, true);
          vscode4.window.showInformationMessage("AI Guard: Changes hidden (showing Original).");
        } else {
          if (!this.forwardCheckpoint)
            return;
          const forwardChangeSet = await ChangeDetector.detectChanges(this.forwardCheckpoint, this.scanner, wsFolder);
          const plan = RestorePlanner.buildPlan(this.forwardCheckpoint, forwardChangeSet, [], wsFolder);
          this.statusBar.setState("restoring");
          await this.restoreService.execute(plan);
          this.viewState = "ai";
          await this.refresh();
          vscode4.window.showInformationMessage("AI Guard: Changes applied (showing AI).");
        }
      } catch (err) {
        vscode4.window.showErrorMessage(`Toggle failed: ${err.message}`);
      }
    });
  }
  async acceptAll() {
    if (!this.activeCheckpoint)
      return;
    if (this.viewState === "original") {
      const choice = await vscode4.window.showWarningMessage("You are currently viewing the Original state. Finalizing now will permanently discard the hidden AI changes. Continue?", "Discard AI Changes", "Cancel");
      if (choice !== "Discard AI Changes")
        return;
    }
    this.activeCheckpoint = null;
    this.currentChangeSet = null;
    this.forwardCheckpoint = null;
    this.viewState = "ai";
    this.statusBar.setState("off");
    this.sidebar.refresh(null, false);
    await this.clearLockFile();
    vscode4.window.showInformationMessage("AI Guard: Protection finalized. Changes kept.");
  }
  async rejectAll() {
    if (!this.activeCheckpoint)
      return;
    const wsFolder = vscode4.workspace.workspaceFolders[0].uri.fsPath;
    if (this.viewState === "original") {
      this.activeCheckpoint = null;
      this.currentChangeSet = null;
      this.forwardCheckpoint = null;
      this.viewState = "ai";
      this.statusBar.setState("off");
      this.sidebar.refresh(null, false);
      await this.clearLockFile();
      vscode4.window.showInformationMessage("AI Guard: Protection discarded. Original state kept.");
      return;
    }
    await vscode4.commands.executeCommand("workbench.action.files.saveAll");
    this.currentChangeSet = await ChangeDetector.detectChanges(this.activeCheckpoint, this.scanner, wsFolder);
    const conflicts = await ConflictDetector.detect(this.currentChangeSet, this.scanner, wsFolder);
    if (conflicts.length > 0) {
      this.statusBar.setState("conflict");
      const msg = `AI Guard: ${conflicts.length} conflict(s) detected. Some files were modified by you AFTER the AI edited them. They will NOT be restored to prevent data loss.`;
      vscode4.window.showWarningMessage(msg, "Proceed Anyway", "Cancel").then(async (choice) => {
        if (choice === "Proceed Anyway") {
          await this.executeRestore(this.activeCheckpoint, this.currentChangeSet, conflicts, wsFolder);
        }
      });
      return;
    }
    await this.executeRestore(this.activeCheckpoint, this.currentChangeSet, [], wsFolder);
  }
  async executeRestore(cp, cs, conflicts, wsFolder) {
    this.statusBar.setState("restoring");
    try {
      const plan = RestorePlanner.buildPlan(cp, cs, conflicts, wsFolder);
      await this.restoreService.execute(plan);
      this.activeCheckpoint = null;
      this.currentChangeSet = null;
      this.forwardCheckpoint = null;
      this.viewState = "ai";
      this.statusBar.setState("off");
      this.sidebar.refresh(null, false);
      await this.clearLockFile();
      vscode4.window.showInformationMessage("AI Guard: Checkpoint discarded and safely reverted.");
    } catch (err) {
      vscode4.window.showErrorMessage(`Restore failed: ${err.message}`);
      this.statusBar.setState("changes", cs.changes.length);
    }
  }
  async clearLockFile() {
    const fs5 = require("fs/promises");
    const lockFile = path7.join(this.checkpointService.metadataStore.storageBaseDir, "jguard.lock");
    await fs5.unlink(lockFile).catch(() => {
    });
  }
};

// src/extension.ts
var path8 = __toESM(require("path"));
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
  commands2 = new Commands(context, checkpointService, restoreService, scanner, sidebar, statusBar);
  commands2.register();
  const fs5 = require("fs/promises");
  const lockFile = path8.join(storageBaseDir, "jguard.lock");
  try {
    const activeId = await fs5.readFile(lockFile, "utf-8");
    if (activeId) {
      vscode5.window.showWarningMessage(
        "AI Guard: Found an active checkpoint from a previous session. Do you want to resume protecting?",
        "Resume",
        "Discard"
      ).then(async (choice) => {
        if (choice === "Resume") {
          try {
            const cp = await metadataStore.read(activeId.trim());
            commands2.activeCheckpoint = cp;
            statusBar.setState("protecting");
            await commands2.refresh();
          } catch (e) {
            vscode5.window.showErrorMessage("Failed to resume checkpoint. It may be corrupted.");
            await fs5.unlink(lockFile).catch(() => {
            });
          }
        } else if (choice === "Discard") {
          await fs5.unlink(lockFile).catch(() => {
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
