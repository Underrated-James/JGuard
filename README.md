<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visual-studio-code&logoColor=white" alt="VS Code Extension">
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Version-0.0.1-orange" alt="Version">
</p>

# 🛡️ JGuard — AI Code Checkpoint & Rollback System

**JGuard** is a VS Code extension that acts as an **undo system for AI-generated code changes**. It lets you checkpoint your workspace *before* an AI agent modifies it, then toggle AI changes on/off like a light switch, diff every file, and accept or reject the entire changeset with a single click — safely and atomically.

> *"Let the AI cook, but keep the receipts."*

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [How It Works — The 30-Second Version](#how-it-works--the-30-second-version)
- [Features](#features)
- [Commands Reference](#commands-reference)
- [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Layer Diagram](#layer-diagram)
  - [Core Data Types](#core-data-types)
  - [Storage Engine](#storage-engine)
  - [Core Engine](#core-engine)
  - [Application Layer](#application-layer)
  - [VS Code Integration Layer](#vs-code-integration-layer)
- [Usage Workflow](#usage-workflow)
  - [Scenario 1 — Happy Path (Accept)](#scenario-1--happy-path-accept)
  - [Scenario 2 — Reject All Changes](#scenario-2--reject-all-changes)
  - [Scenario 3 — Toggle Changes On/Off](#scenario-3--toggle-changes-onoff)
  - [Scenario 4 — Conflict Detection](#scenario-4--conflict-detection)
- [Crash Recovery](#crash-recovery)
- [Safety Guarantees](#safety-guarantees)
- [Limitations (MVP)](#limitations-mvp)
- [Development](#development)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Build](#build)
  - [Test](#test)
  - [Debug](#debug)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Problem Statement

AI coding assistants (Copilot, Cursor, Cline, Claude Code, etc.) can modify dozens of files in a single operation. If something goes wrong — a subtle bug, a bad refactor, a broken build — you're left manually reverting files from git history, stash diffs, or memory. This is tedious, error-prone, and dangerous when the AI has touched files you also edited manually.

**JGuard solves this by creating a lightweight, content-addressable snapshot of your workspace *before* the AI runs, then giving you one-click control to:**

1. **Review** every file the AI changed (inline diff view)
2. **Toggle** between the original and AI-modified states — *actually swapping the files on disk* so your dev server, tests, and localhost reflect the real state
3. **Accept** (keep AI changes permanently) or **Reject** (atomic rollback to the checkpoint)
4. **Detect conflicts** if you manually edited a file *after* the AI did, preventing silent data loss

---

## How It Works — The 30-Second Version

```
┌─────────────────────────────────────────────────────┐
│  1. Click "AI Guard" in the status bar              │
│     → JGuard snapshots every file in your workspace │
│     → Files are hashed (SHA-256) and stored in a    │
│       content-addressable object store              │
│                                                     │
│  2. Let the AI make changes (Copilot, Cursor, etc.) │
│     → JGuard detects modified/created/deleted files │
│     → Sidebar shows a live change list              │
│                                                     │
│  3. Toggle the changes ON/OFF                       │
│     → Files are physically swapped on disk          │
│     → Your dev server hot-reloads both states       │
│                                                     │
│  4. Accept or Reject                                │
│     → Accept: checkpoint is discarded, changes kept │
│     → Reject: atomic rollback to the checkpoint     │
└─────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---|---|
| **One-Click Checkpoint** | Snapshot your entire workspace state before AI modifications. All files hashed and stored in a content-addressable object store. |
| **Real-Time Change Detection** | Automatic detection of modified, created, and deleted files via filesystem watcher. Sidebar updates live. |
| **Inline Diff View** | Click any changed file in the sidebar to see a side-by-side diff (Checkpoint ↔ Current). |
| **Toggle Changes On/Off** | Physically swap between original and AI-modified states on disk. Your dev server, localhost, tests — everything reflects the toggled state. |
| **Accept All** | Finalize and keep AI changes. Discards the checkpoint cleanly. |
| **Reject All** | Atomic rollback to the checkpoint. Modified files are restored, created files are deleted, deleted files are resurrected. |
| **Conflict Detection** | If you manually edit a file *after* the AI modified it, JGuard detects the conflict and skips that file during rollback to prevent data loss. |
| **Crash Recovery** | A lockfile tracks the active checkpoint. If VS Code crashes mid-session, JGuard offers to resume on next startup. |
| **Automatic GC** | Old checkpoints are automatically cleaned up, keeping only the 3 most recent. |
| **Status Bar Integration** | Always-visible status indicator: OFF → PROTECTING → N CHANGES → CONFLICT → RESTORING. |
| **Git-Aware Scanning** | Automatically excludes `node_modules/`, `.git/`, and `dist/` from snapshots. Respects `.gitignore` via VS Code's workspace APIs. |

---

## Commands Reference

| Command | Palette Title | Icon | Description |
|---|---|---|---|
| `jguard.toggleProtection` | JGuard: Toggle Protection | `$(shield)` | Enable/disable checkpoint protection. When active, prompts to Accept or Reject. |
| `jguard.toggleChanges` | JGuard: Toggle AI Changes | `$(versions)` | Swap between original and AI-modified file states on disk. |
| `jguard.acceptAll` | JGuard: Finalize (Keep Changes) | `$(check)` | Accept all AI changes and discard the checkpoint. |
| `jguard.rejectAll` | JGuard: Discard (Revert & Close) | `$(discard)` | Reject all AI changes and restore to the checkpoint state. |
| `jguard.refresh` | JGuard: Refresh | `$(refresh)` | Manually re-scan the workspace for changes. |
| `jguard.openDiff` | *(internal)* | — | Opens a side-by-side diff for a specific file change (triggered from the sidebar). |

**Sidebar Toolbar:** The Toggle, Accept, and Reject commands appear as icons in the "AI Guard" sidebar panel header for quick access.

---

## Architecture

### Project Structure

```
JGuard/
├── src/
│   ├── extension.ts                 # VS Code entry point — wiring & crash recovery
│   ├── core/                        # Pure logic, zero VS Code dependencies
│   │   ├── types.ts                 # All TypeScript interfaces & type definitions
│   │   ├── Hasher.ts                # SHA-256 hashing (file streams & buffers)
│   │   ├── ChangeDetector.ts        # Compares workspace state against a checkpoint
│   │   ├── ConflictDetector.ts      # Detects user edits made after AI edits
│   │   └── RestorePlanner.ts        # Generates deterministic restore operation plans
│   ├── application/                 # Orchestration / service layer
│   │   ├── CheckpointService.ts     # Creates checkpoints, manages lifecycle & GC
│   │   └── RestoreService.ts        # Executes restore plans safely with verification
│   ├── storage/                     # Persistence layer
│   │   ├── ObjectStore.ts           # Content-addressable blob store (Git-style)
│   │   └── MetadataStore.ts         # Checkpoint metadata (JSON files, atomic writes)
│   ├── vscode/                      # VS Code integration layer
│   │   ├── Commands.ts              # All command handlers & toggle state machine
│   │   ├── Sidebar.ts               # TreeDataProvider for the "AI Guard" sidebar panel
│   │   ├── StatusBar.ts             # Status bar item with state-based styling
│   │   ├── DiffProvider.ts          # TextDocumentContentProvider for diff views
│   │   └── WorkspaceScanner.ts      # IFileScanner impl using VS Code's findFiles API
│   └── integrations/
│       └── GitIntegration.ts        # Git helpers (repo detection, branch names, ignore checks)
├── tests/
│   └── unit/
│       ├── core.test.ts             # Change detection tests
│       ├── restore.test.ts          # Conflict detection & restore pipeline tests
│       └── storage.test.ts          # Hasher, ObjectStore, MetadataStore tests
├── dist/
│   └── extension.js                 # Bundled output (esbuild)
├── package.json                     # Extension manifest (commands, menus, views)
├── tsconfig.json                    # TypeScript configuration
├── esbuild.js                       # Build script (dev + production)
├── vitest.config.ts                 # Test runner configuration
└── .vscodeignore                    # Files excluded from VSIX packaging
```

### Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     VS Code UI                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Commands │  │ Sidebar  │  │StatusBar │  │DiffView  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
├───────┼──────────────┼────────────┼──────────────┼───────┤
│       │      Application Layer    │              │       │
│  ┌────┴──────────┐  ┌────────────┴──────┐       │       │
│  │CheckpointSvc  │  │   RestoreService  │       │       │
│  └────┬──────────┘  └────────────┬──────┘       │       │
├───────┼──────────────────────────┼──────────────┼───────┤
│       │         Core Engine      │              │       │
│  ┌────┴──────┐ ┌────────────┐ ┌──┴───────────┐  │       │
│  │ChangeDet. │ │ConflictDet.│ │RestorePlanner│  │       │
│  └───────────┘ └────────────┘ └──────────────┘  │       │
│  ┌───────────────────────────────────────────┐  │       │
│  │             Hasher (SHA-256)               │  │       │
│  └───────────────────────────────────────────┘  │       │
├─────────────────────────────────────────────────┼───────┤
│                  Storage Layer                  │       │
│  ┌────────────────────┐  ┌────────────────────┐ │       │
│  │    ObjectStore     │  │   MetadataStore    │─┘       │
│  │ (content-addressed)│  │  (JSON checkpoints)│         │
│  └────────────────────┘  └────────────────────┘         │
│                  ┌─────────────┐                        │
│                  │  Filesystem │                        │
│                  └─────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

### Core Data Types

All types are defined in [`src/core/types.ts`](src/core/types.ts):

```typescript
// A snapshot of the workspace at a point in time
interface Checkpoint {
  id: string;                              // Unique ID (base36 timestamp + random)
  workspaceId: string;                     // Workspace identifier
  createdAt: number;                       // Unix timestamp (ms)
  status: 'active' | 'accepted' | 'rejected';
  files: Record<string, FileSnapshot>;     // relPath → snapshot
  label?: string;                          // Optional label
}

// Per-file snapshot metadata
interface FileSnapshot {
  hash: string;    // SHA-256 of file contents
  size: number;    // File size in bytes
  mtime: number;   // Last modified time (ms)
  isBinary: boolean;
}

// Discriminated union for detected file changes
type FileChange =
  | { type: 'created'; relativePath: string; currentHash: string }
  | { type: 'modified'; relativePath: string; checkpointHash: string; currentHash: string }
  | { type: 'deleted'; relativePath: string; checkpointHash: string };

// A set of changes detected between checkpoint and current state
interface ChangeSet {
  checkpointId: string;
  computedAt: number;
  changes: FileChange[];
  aiStateHashes: Record<string, string>;   // Tracks the hash of each file as the AI left it
}

// Conflict: user modified a file after the AI did
interface Conflict {
  relativePath: string;
  reason: 'user_modified_post_ai';
  currentHash: string;
  checkpointHash: string;
}

// A single restore operation (write original content or delete created file)
interface RestoreOperation {
  type: 'write' | 'delete';
  relativePath: string;
  absolutePath: string;
  objectHash: string | null;               // null for delete operations
}

// An ordered list of operations to restore the workspace
interface RestorePlan {
  operations: RestoreOperation[];          // Sorted: deletes first, then writes
}
```

### Storage Engine

#### ObjectStore (`src/storage/ObjectStore.ts`)

A **content-addressable blob store** inspired by Git's object model:

- Files are hashed with SHA-256 and stored under `<storageDir>/objects/<first-2-chars>/<full-hash>`
- Writes are **deduplicated** — identical content is stored only once
- Writes are **atomic** — content goes to a `.tmp` file first, then is renamed
- Provides `write(content) → hash`, `read(hash) → content`, `exists(hash)`, `delete(hash)`

#### MetadataStore (`src/storage/MetadataStore.ts`)

Stores checkpoint metadata as JSON files:

- Path: `<storageDir>/checkpoints/<checkpoint-id>.json`
- Writes are **atomic** (temp file + rename)
- Provides `write(id, checkpoint)`, `read(id)`, `delete(id)`

Both stores use VS Code's `globalStorageUri` as their base directory, ensuring data persists across sessions and is isolated per-extension.

### Core Engine

All core modules are **pure logic** with zero VS Code dependencies, making them fully unit-testable.

#### Hasher (`src/core/Hasher.ts`)

- `hashFile(path)` — SHA-256 via streaming (handles large files efficiently)
- `hashBuffer(content)` — SHA-256 of an in-memory buffer

#### ChangeDetector (`src/core/ChangeDetector.ts`)

Compares the current workspace against a checkpoint:

1. **Fast path**: If a file's `mtime` and `size` match the checkpoint, it's assumed unchanged (no hash computation)
2. **Modified**: File exists in both checkpoint and workspace, but hashes differ
3. **Created**: File exists in workspace but not in checkpoint
4. **Deleted**: File exists in checkpoint but not in workspace

Returns a `ChangeSet` with the list of changes and a map of `aiStateHashes` — the hash of each file *as the AI left it*, used later for conflict detection.

#### ConflictDetector (`src/core/ConflictDetector.ts`)

Determines if a file was modified by the **user** *after* the AI edited it:

- For each `modified` or `created` change, it compares the current on-disk hash against the `aiStateHashes` from the `ChangeSet`
- If they differ, and the current hash isn't the same as the checkpoint hash (which would mean the user manually reverted it), it's flagged as a conflict
- Conflicted files are **skipped** during restore to prevent silent data loss

#### RestorePlanner (`src/core/RestorePlanner.ts`)

Generates a deterministic `RestorePlan` from a checkpoint and changeset:

| Change Type | Restore Operation |
|---|---|
| `modified` | `write` — restore the checkpoint version |
| `created` | `delete` — remove the file the AI created |
| `deleted` | `write` — resurrect the file from the checkpoint |
| *(conflicted)* | **skipped entirely** |

Operations are sorted deterministically: **deletes first, then writes**, alphabetically within each group.

### Application Layer

#### CheckpointService (`src/application/CheckpointService.ts`)

Orchestrates checkpoint creation:

1. Scans the workspace via `IFileScanner`
2. Reads each file, computes SHA-256, stores content in the ObjectStore
3. Records per-file metadata (`hash`, `size`, `mtime`, `isBinary`) in a `Checkpoint` object
4. Writes the checkpoint to `MetadataStore`
5. Creates a lockfile (`jguard.lock`) for crash recovery
6. Fires background garbage collection (keeps last 3 checkpoints)

#### RestoreService (`src/application/RestoreService.ts`)

Executes a `RestorePlan` safely:

- **Write operations**: Reads content from ObjectStore, verifies SHA-256 hash, writes via `vscode.workspace.fs.writeFile()` for seamless editor and dev server integration
- **Delete operations**: Removes files via `vscode.workspace.fs.delete()`
- Uses VS Code's Workspace FS API instead of raw Node.js `fs` to ensure file watchers, editor buffers, and dev servers (Vite, Next.js, etc.) properly detect the changes

### VS Code Integration Layer

#### Commands (`src/vscode/Commands.ts`)

The **state machine** at the heart of JGuard, managing the following internal state:

```
┌─────────────────┐
│ activeCheckpoint │  The original checkpoint (null when off)
│ forwardCheckpoint│  Snapshot of AI state (used for toggle-back)
│ currentChangeSet │  Latest detected changes
│ viewState        │  'ai' | 'original' — which state is on disk
└─────────────────┘
```

**Toggle Changes flow:**

```
viewState === 'ai'                    viewState === 'original'
┌─────────────────────┐               ┌──────────────────────┐
│ AI changes on disk   │──── toggle ──→│ Original on disk      │
│                      │               │ AI state saved in     │
│                      │←── toggle ────│ forwardCheckpoint     │
└─────────────────────┘               └──────────────────────┘
```

1. **Toggle AI → Original**: Snapshots current (AI) state into `forwardCheckpoint`, then restores the original checkpoint to disk
2. **Toggle Original → AI**: Restores the `forwardCheckpoint` to disk, bringing AI changes back

#### Sidebar (`src/vscode/Sidebar.ts`)

A `TreeDataProvider` that displays:

- Protection status (`PROTECTING` / `OFF`)
- Change count with expandable list
- Per-file icons: ✏️ modified, ➕ created, 🗑️ deleted
- Clicking a file opens the inline diff view

#### StatusBar (`src/vscode/StatusBar.ts`)

An always-visible status bar item with 5 states:

| State | Text | Background | Click Action |
|---|---|---|---|
| `off` | `$(shield) AI Guard: OFF` | Default | Toggle protection |
| `protecting` | `$(shield-check) AI Guard: PROTECTING` | Default | Toggle protection |
| `changes` | `$(repo-sync) AI Guard: N CHANGES` | Warning (yellow) | Focus sidebar |
| `conflict` | `$(alert) AI Guard: CONFLICT` | Error (red) | — |
| `restoring` | `$(sync~spin) AI Guard: RESTORING...` | Warning (yellow) | Disabled |

#### DiffProvider (`src/vscode/DiffProvider.ts`)

Implements `TextDocumentContentProvider` for the `jguard://` URI scheme, enabling VS Code's native diff editor to compare checkpoint content against the current file.

#### WorkspaceScanner (`src/vscode/WorkspaceScanner.ts`)

Implements `IFileScanner` using `vscode.workspace.findFiles()`:

- Excludes `node_modules/`, `.git/`, `dist/` by default
- Respects `.gitignore` via VS Code's file finding API
- Caps at 50,000 files with a clear error message for oversized workspaces

---

## Usage Workflow

### Scenario 1 — Happy Path (Accept)

```
1. Open your project in VS Code
2. Click "AI Guard: OFF" in the status bar
   → Status changes to "PROTECTING"
   → Checkpoint created silently in ~1-2s
3. Let your AI agent (Copilot, Cursor, etc.) make changes
   → Status bar turns yellow: "AI Guard: 5 CHANGES"
   → Sidebar shows the list of changed files
4. Click any file in the sidebar to see the diff
5. Click ✓ (Accept) in the sidebar header
   → Checkpoint discarded, changes permanently kept
   → Status bar returns to "OFF"
```

### Scenario 2 — Reject All Changes

```
1. Enable protection and let the AI make changes
2. Click ✗ (Reject) in the sidebar header
   → JGuard restores all files to the checkpoint state
   → Modified files are reverted
   → Files created by the AI are deleted
   → Files deleted by the AI are restored
   → Status returns to "OFF"
```

### Scenario 3 — Toggle Changes On/Off

```
1. Enable protection and let the AI make changes
2. Click the Toggle icon (⑃) in the sidebar header
   → "AI Guard: Changes hidden (showing Original)"
   → Your dev server hot-reloads to the ORIGINAL state
   → Test your app without AI changes on localhost
3. Click Toggle again
   → "AI Guard: Changes applied (showing AI)"
   → Your dev server hot-reloads to the AI state
   → Test the AI's version on localhost
4. Repeat as needed, then Accept or Reject
```

### Scenario 4 — Conflict Detection

```
1. Enable protection, AI modifies api.ts and creates auth.ts
2. You ALSO manually edit api.ts after the AI
3. Click Reject
   → JGuard detects that api.ts was modified by both AI and you
   → Warning: "1 conflict(s) detected"
   → api.ts is SKIPPED (your manual edits preserved)
   → auth.ts is deleted, other files restored normally
```

---

## Crash Recovery

JGuard writes a `jguard.lock` file containing the active checkpoint ID whenever protection is enabled. If VS Code crashes or is force-quit:

1. On next startup, JGuard detects the stale lockfile
2. Prompts: *"Found an active checkpoint from a previous session. Resume or Discard?"*
3. **Resume**: Reloads the checkpoint and continues where you left off
4. **Discard**: Deletes the lockfile and starts fresh

---

## Safety Guarantees

| Guarantee | Implementation |
|---|---|
| **Atomic writes** | ObjectStore and MetadataStore use temp files + rename |
| **Hash verification** | Every restore operation verifies SHA-256 before writing |
| **Conflict protection** | Files edited by both AI and user are never overwritten |
| **No silent data loss** | Conflicted files are skipped with explicit user notification |
| **Crash resilience** | Lockfile-based recovery mechanism |
| **Deterministic restores** | RestorePlanner produces sorted, reproducible operation lists |

---

## Limitations (MVP)

- **Single workspace support** — only the first workspace folder is monitored
- **No per-file accept/reject** — it's all-or-nothing (Accept All / Reject All)
- **No partial toggle** — you can't toggle individual files, only the entire changeset
- **50,000 file cap** — workspaces with more files will show an error
- **No multi-root workspace support** — only `workspaceFolders[0]` is used
- **Binary files** — stored and restored, but diffs are not shown for binary content
- **No undo for Accept** — once accepted, the checkpoint is gone

---

## Development

### Prerequisites

- **Node.js** ≥ 18.x
- **VS Code** ≥ 1.80.0
- **npm** ≥ 9.x

### Setup

```bash
git clone https://github.com/Underrated-James/JGuard.git
cd JGuard
npm install
```

### Build

```bash
# Type-check + bundle (development)
npm run compile

# Type-check + bundle (production, minified)
npm run package

# Watch mode (auto-rebuild on save)
npm run watch
```

### Test

```bash
# Run all unit tests
npm test

# Tests cover:
# - Hasher (SHA-256 correctness)
# - ObjectStore (write, read, delete, deduplication)
# - MetadataStore (checkpoint persistence)
# - ChangeDetector (modified, created, deleted detection)
# - ConflictDetector (user-modified-post-AI detection)
# - RestorePlanner (plan generation, conflict skipping)
# - RestoreService (end-to-end restore execution)
```

### Debug

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new window, open any project folder
4. Click "AI Guard: OFF" in the status bar to start

---

## Configuration

JGuard currently has no user-facing settings. The following defaults are hardcoded:

| Setting | Default | Location |
|---|---|---|
| Excluded directories | `node_modules/`, `.git/`, `dist/` | `WorkspaceScanner.ts` |
| Max workspace files | 50,000 | `WorkspaceScanner.ts` |
| Kept checkpoints (GC) | 3 | `CheckpointService.ts` |
| Storage location | VS Code `globalStorageUri` | `extension.ts` |

---

## Roadmap

- [ ] Per-file accept/reject (granular control)
- [ ] Multi-root workspace support
- [ ] Configurable exclude patterns via settings
- [ ] Checkpoint labeling and history browser
- [ ] Integration with Git stash for hybrid workflows
- [ ] Marketplace publishing
- [ ] Telemetry & usage analytics (opt-in)

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure all tests pass (`npm test`) and the build succeeds (`npm run compile`) before submitting.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Underrated-James">@Underrated-James</a>
</p>
