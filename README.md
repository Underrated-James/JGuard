<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visual-studio-code&logoColor=white" alt="VS Code Extension">
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Version-0.2.0-orange" alt="Version">
</p>

# 🛡️ JGuard — AI Code Checkpoint & Rollback System

**JGuard** is a VS Code extension that acts as an **undo system for AI-generated code changes**. It lets you checkpoint your workspace *before* an AI agent modifies it, then toggle AI changes on/off like a light switch, diff every file, perform granular per-file accept/reject, and restore workspace state with a single click — safely, atomically, and with multi-root support.

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
  - [Scenario 1 — Granular Per-File Review & Finalize](#scenario-1--granular-per-file-review--finalize)
  - [Scenario 2 — Full Acceptance & Undo Grace Period](#scenario-2--full-acceptance--undo-grace-period)
  - [Scenario 3 — Per-File & Bulk Toggle (A/B Testing)](#scenario-3--per-file--bulk-toggle-ab-testing)
  - [Scenario 4 — Conflict Detection](#scenario-4--conflict-detection)
  - [Scenario 5 — Multi-Root Workspaces](#scenario-5--multi-root-workspaces)
- [Crash Recovery](#crash-recovery)
- [Safety Guarantees](#safety-guarantees)
- [V2 Upgrades — Resolved Limitations](#v2-upgrades--resolved-limitations)
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

**JGuard solves this by creating a lightweight, content-addressable snapshot of your workspace *before* the AI runs, giving you complete control:**

1. **Review & Diff** every file the AI changed (side-by-side diffs for text and smart comparison for binaries/images)
2. **Toggle (Bulk or Per-File)** between the original and AI-modified states — *actually swapping the files on disk* so your dev server, tests, and localhost reflect real state
3. **Per-File Accept / Reject** — keep only the good AI changes and revert the bad ones immediately with auto-snapshot safety
4. **Undo for Accept** — a configurable grace period (default 5 min) allowing you to undo finalization if you spot a hidden bug
5. **Detect conflicts** if you manually edited a file *after* the AI did, preventing silent data loss
6. **Multi-Root Monorepo Support** — seamless protection across multi-folder workspaces without arbitrary file caps

---

## How It Works — The 30-Second Version

```
┌───────────────────────────────────────────────────────────────────┐
│  1. Enable Protection                                             │
│     → Click $(shield) AI Guard in the status bar or sidebar       │
│     → JGuard snapshots every file into a content-addressable store│
│                                                                   │
│  2. Let the AI make changes (Copilot, Cursor, Claude, etc.)       │
│     → Real-time change detection for modified/created/deleted files│
│     → Sidebar groups changes by folder in multi-root workspaces   │
│                                                                   │
│  3. Review, Toggle & Selectively Decide                           │
│     → Click file to diff (text or image side-by-side)             │
│     → Click 👁 to toggle individual files between AI & Original   │
│     → Click ✓ to Accept file or ✗ to Reject (auto-saved backup)   │
│                                                                   │
│  4. Finalize or Undo                                              │
│     → Accept All or Finalize session                              │
│     → Undo Accept anytime within the 5-minute grace period        │
└───────────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---|---|
| **One-Click Checkpoint** | Snapshot your entire workspace state before AI modifications. All files hashed and stored in a content-addressable object store. |
| **Multi-Root Workspace Support** | First-class support for multi-folder workspaces (`CheckpointSession`). Each folder gets its own scoped checkpoint and sidebar grouping. |
| **Granular Per-File Accept / Reject** | Accept or reject individual file changes. Rejecting restores the original file immediately while auto-saving the AI version to memory so you can toggle it back. |
| **Per-File & Bulk Toggle** | Physically swap between original and AI-modified states on disk per file or across the whole workspace. Hot-reload servers reflect the exact state. |
| **Undo for Accept (Soft Delete)** | 5-minute configurable grace period after clicking "Accept All". If you find a subtle bug, one click on "Undo Accept" reactivates the session. |
| **Streaming Parallel Scanner (No File Cap)** | Batched parallel processing (50 concurrent files) with real-time progress indicators. Handles large monorepos effortlessly. |
| **Binary & Image Diff Routing** | Smart diffing: side-by-side image viewer for `.png`, `.jpg`, `.svg`, etc., and metadata inspection for other binary formats. |
| **Real-Time Change Detection** | Automatic detection of modified, created, and deleted files via filesystem watcher. Sidebar updates live. |
| **Inline Diff View** | Click any changed file in the sidebar to view a side-by-side diff (Checkpoint ↔ Current). |
| **Conflict Detection** | If you manually edit a file *after* the AI modified it, JGuard detects the conflict and skips that file during rollback to prevent data loss. |
| **Crash Recovery** | A lockfile tracks the active session. If VS Code crashes mid-session, JGuard offers to resume on next startup. |
| **Automatic GC** | Old checkpoints are cleaned up automatically (keeps 3 most recent), while respecting the undo grace period. |
| **Status Bar & Sidebar Integration** | Interactive status indicator (OFF → PROTECTING → N CHANGES → CONFLICT → RESTORING) and rich tree view with inline action buttons. |

---

## Commands Reference

| Command | Palette Title | Icon | Description |
|---|---|---|---|
| `jguard.toggleProtection` | JGuard: Toggle Protection | `$(shield)` | Enable/disable checkpoint protection. When active, prompts to Accept or Reject. |
| `jguard.toggleChanges` | JGuard: Toggle AI Changes (All) | `$(versions)` | Swap all files between original and AI-modified states on disk. |
| `jguard.acceptAll` | JGuard: Accept All Changes | `$(check-all)` | Accept all AI changes and initiate the undo grace period. |
| `jguard.rejectAll` | JGuard: Reject All Changes | `$(discard)` | Reject all AI changes and restore all workspace folders to checkpoint state. |
| `jguard.acceptFile` | JGuard: Accept File | `$(check)` | Accept a single file change (keeps on disk, marks decision). |
| `jguard.rejectFile` | JGuard: Reject File | `$(close)` | Immediately revert file to checkpoint on disk and auto-saves AI version to store. |
| `jguard.toggleFile` | JGuard: Toggle File | `$(eye)` | Toggle an individual file between AI and Original versions on disk. |
| `jguard.finalize` | JGuard: Finalize Session | `$(pass-filled)` | Finalize the session, prompting for default action on remaining pending files. |
| `jguard.refresh` | JGuard: Refresh | `$(refresh)` | Manually re-scan the workspace for changes. |
| `jguard.openDiff` | *(internal)* | — | Opens side-by-side diff (or image comparison) for a specific file change. |

---

## Architecture

### Project Structure

```
JGuard/
├── src/
│   ├── extension.ts                     # VS Code entry point — wiring & crash recovery
│   ├── core/                            # Pure logic, zero VS Code dependencies
│   │   ├── types.ts                     # All TypeScript interfaces & type definitions
│   │   ├── Hasher.ts                    # SHA-256 hashing (file streams & buffers)
│   │   ├── ChangeDetector.ts            # Compares workspace state against a checkpoint
│   │   ├── ConflictDetector.ts          # Detects user edits made after AI edits
│   │   ├── RestorePlanner.ts            # Generates deterministic bulk restore plans
│   │   └── SelectiveRestorePlanner.ts   # Generates per-file and selective restore plans
│   ├── application/                     # Orchestration / service layer
│   │   ├── CheckpointService.ts         # Creates sessions/checkpoints, batched I/O, GC
│   │   └── RestoreService.ts            # Executes restore plans safely with verification
│   ├── storage/                         # Persistence layer
│   │   ├── ObjectStore.ts               # Content-addressable blob store (Git-style)
│   │   └── MetadataStore.ts             # Checkpoints & Sessions store (JSON, atomic writes)
│   ├── vscode/                          # VS Code integration layer
│   │   ├── Commands.ts                  # Command handlers & multi-session state machine
│   │   ├── Sidebar.ts                   # TreeDataProvider for multi-root & inline actions
│   │   ├── StatusBar.ts                 # Status bar item with state-based styling & actions
│   │   ├── DiffProvider.ts              # TextDocumentContentProvider for diff views
│   │   └── WorkspaceScanner.ts          # Scoped file scanner with streaming & soft warnings
│   └── integrations/
│       └── GitIntegration.ts            # Git helpers (repo detection, branch names, ignore checks)
├── tests/
│   └── unit/
│       ├── core.test.ts                 # Change detection tests
│       ├── restore.test.ts              # Conflict detection & restore pipeline tests
│       └── storage.test.ts              # Hasher, ObjectStore, MetadataStore tests
├── dist/
│   └── extension.js                     # Bundled output (esbuild)
├── package.json                         # Extension manifest (commands, menus, settings)
├── tsconfig.json                        # TypeScript configuration
├── esbuild.js                           # Build script (dev + production)
└── vitest.config.ts                     # Test runner configuration
```

### Layer Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                               VS Code UI                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Commands │  │ Sidebar  │  │StatusBar │  │DiffView  │  │ImageView │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
├───────┼──────────────┼────────────┼──────────────┼────────────┼────────┤
│       │             Application Layer            │            │        │
│  ┌────┴──────────┐  ┌─────────────┴─────┐        │            │        │
│  │CheckpointSvc  │  │   RestoreService  │        │            │        │
│  └────┬──────────┘  └─────────────┬─────┘        │            │        │
├───────┼───────────────────────────┼──────────────┼────────────┼────────┤
│       │                Core Engine               │            │        │
│  ┌────┴──────┐ ┌────────────┐ ┌───┴───────────┐ ┌┴──────────┐ │        │
│  │ChangeDet. │ │ConflictDet.│ │RestorePlanner │ │SelectiveRP│ │        │
│  └───────────┘ └────────────┘ └───────────────┘ └───────────┘ │        │
│  ┌──────────────────────────────────────────────────────────┐ │        │
│  │                     Hasher (SHA-256)                     │ │        │
│  └──────────────────────────────────────────────────────────┘ │        │
├───────────────────────────────────────────────────────────────┼────────┤
│                         Storage Layer                         │        │
│  ┌────────────────────┐  ┌──────────────────────────────────┐ │        │
│  │    ObjectStore     │  │          MetadataStore           │─┘        │
│  │ (content-addressed)│  │ (Checkpoints & Sessions in JSON) │          │
│  └────────────────────┘  └──────────────────────────────────┘          │
│                          ┌──────────────────┐                          │
│                          │    Filesystem    │                          │
│                          └──────────────────┘                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Data Types

Defined in [`src/core/types.ts`](src/core/types.ts):

```typescript
export interface Checkpoint {
  id: string;
  workspaceId: string;
  createdAt: number;
  status: 'active' | 'accepted' | 'rejected';
  files: Record<string, FileSnapshot>;
  workspaceRoot: string;        // Absolute path to folder
  finalizedAt?: number;         // When accept/reject was executed (for undo grace period)
}

export interface CheckpointSession {
  id: string;
  createdAt: number;
  folderCheckpoints: Record<string, Checkpoint>; // wsRoot → Checkpoint
  status: 'active' | 'accepted' | 'rejected';
}

export type FileDecision = 'pending' | 'accepted' | 'rejected';
export type FileViewState = 'ai' | 'original';

export interface ChangeSet {
  checkpointId: string;
  computedAt: number;
  changes: FileChange[];
  aiStateHashes: Record<string, string>;
  decisions: Record<string, FileDecision>;
}
```

---

## Usage Workflow

### Scenario 1 — Granular Per-File Review & Finalize

```
1. Click "$(shield) AI Guard: OFF" in the status bar (or "Protection is OFF" in sidebar)
   → Checkpoint created; status becomes "PROTECTING"
2. AI assistant modifies multiple files
   → Sidebar displays changes with action icons (✓ Accept, ✗ Reject, 👁 Toggle)
3. For file A (Good change): Click ✓
   → Marked as accepted (✓ accepted)
4. For file B (Bad change): Click ✗
   → Immediately restored to original version on disk; AI version safely backed up
5. Click "Finalize Session" in sidebar header
   → Prompts for any remaining pending files and cleanly closes session
```

### Scenario 2 — Full Acceptance & Undo Grace Period

```
1. Enable protection, AI modifies files
2. Click "$(check-all) Accept All" in the sidebar
   → Changes kept on disk, session marked 'accepted'
   → Notification: "AI Guard: Changes accepted. You can undo within 5 minutes. [Undo Accept]"
3. Realize 2 minutes later that the AI introduced a subtle regression
4. Click "Undo Accept"
   → JGuard reactivates the session and restores full review & rollback controls
```

### Scenario 3 — Per-File & Bulk Toggle (A/B Testing)

```
1. While reviewing changes, click 👁 (Toggle) on a specific file
   → Only that file is swapped between AI and Original version on disk
   → Your dev server hot-reloads only that module for A/B testing
2. Or click the Bulk Toggle button in the toolbar
   → Swaps all files across all workspace folders simultaneously
```

### Scenario 4 — Conflict Detection

```
1. Enable protection, AI modifies api.ts and creates auth.ts
2. You ALSO manually edit api.ts after the AI finishes
3. Click Reject (or Reject All)
   → JGuard detects that api.ts was edited by both AI and you
   → Warning: "1 conflict(s) detected in <folder>"
   → api.ts is SKIPPED to preserve your manual work
   → Other files are reverted normally
```

### Scenario 5 — Multi-Root Workspaces

```
1. Open a multi-root workspace (e.g., client/ and server/)
2. Enable AI Guard
   → CheckpointSession scans all workspace roots in parallel with progress bar
   → Sidebar organizes changes under collapsible folder nodes (📁 client, 📁 server)
3. Diff, accept, reject, or toggle files across different folders independently
```

---

## Safety Guarantees

| Guarantee | Implementation |
|---|---|
| **Atomic writes** | ObjectStore and MetadataStore use temp files + rename |
| **Hash verification** | Every restore operation verifies SHA-256 before writing |
| **Conflict protection** | Files edited by both AI and user are never overwritten |
| **No silent data loss** | Conflicted files are skipped with explicit user notification |
| **Non-destructive Reject** | Rejecting a file auto-snapshots the AI state so you can toggle it back |
| **Soft Delete Undo** | 5-minute safety net to undo accidental acceptances |
| **Crash resilience** | Lockfile-based recovery mechanism for multi-root sessions |
| **Deterministic restores** | Sorted operation lists (deletes first, then writes) |

---

## V2 Upgrades — Resolved Limitations

All 7 documented MVP limitations are fully resolved in V2:

| # | Limitation | V2 Resolution |
|---|---|---|
| **L1** | Multi-root workspace support | Implemented `CheckpointSession` spanning all folders with folder-scoped checkpoints and tree grouping. |
| **L2** | Per-file accept/reject | Implemented `SelectiveRestorePlanner` and inline sidebar actions with auto-snapshotting. |
| **L3** | Per-file toggle | Implemented `fileViewStates` map for individual file A/B testing without full workspace swaps. |
| **L4** | 50,000 file cap | Removed cap; introduced 50-file batched parallel hashing with progress notifications. |
| **L5** | Single workspace support | Auto-resolved by L1 multi-root architecture. |
| **L6** | Binary file diff viewing | Implemented smart diff routing (side-by-side image viewer + metadata summaries). |
| **L7** | Undo for Accept | Added soft-delete metadata retention with configurable grace period (default 5 min). |

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
# Run unit tests via Vitest
npm test
```

### Debug

1. Open the project in VS Code
2. Press `F5` to launch the **Extension Development Host**
3. In the new window, open any workspace folder (or multi-root workspace)
4. Click **`$(shield) AI Guard: OFF`** in the status bar to begin

---

## Configuration

Customizable via VS Code Settings (`Preferences > Settings > JGuard`):

| Setting | Type | Default | Description |
|---|---|---|---|
| `jguard.undoGracePeriodMinutes` | `number` | `5` | Minutes after accepting changes during which you can undo the accept. |

---

## Roadmap

- [x] Multi-root workspace support
- [x] Granular per-file accept/reject
- [x] Per-file toggle for A/B testing
- [x] Removal of 50K file cap & streaming progress
- [x] Binary & image diff viewer
- [x] Undo for Accept (Grace Period)
- [ ] Checkpoint labeling and history browser
- [ ] VS Code Marketplace Publishing
- [ ] Git stash integration for hybrid workflows

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
