export interface Checkpoint {
  id: string;
  workspaceId: string;
  createdAt: number;
  status: 'active' | 'accepted' | 'rejected';
  files: Record<string, FileSnapshot>;
  label?: string;
  workspaceRoot: string;    // L1: absolute path to the workspace folder this checkpoint belongs to
  finalizedAt?: number;     // L7: when accept/reject was executed (ms since epoch)
}

export interface FileSnapshot {
  hash: string;
  size: number;
  mtime: number;
  isBinary: boolean;
}

/**
 * L1: Wraps multiple per-folder checkpoints into one logical session.
 * A session represents one "protection enable" action across all workspace folders.
 */
export interface CheckpointSession {
  id: string;
  createdAt: number;
  folderCheckpoints: Record<string, Checkpoint>; // wsRoot → Checkpoint
  status: 'active' | 'accepted' | 'rejected';
}

export type FileChange = 
  | { type: 'created'; relativePath: string; currentHash: string }
  | { type: 'modified'; relativePath: string; checkpointHash: string; currentHash: string }
  | { type: 'deleted'; relativePath: string; checkpointHash: string };

/**
 * L2: Per-file decision state for granular accept/reject.
 */
export type FileDecision = 'pending' | 'accepted' | 'rejected';

/**
 * L3: Per-file toggle view state.
 */
export type FileViewState = 'ai' | 'original';

export interface ChangeSet {
  checkpointId: string;
  computedAt: number;
  changes: FileChange[];
  aiStateHashes: Record<string, string>;
  decisions: Record<string, FileDecision>;  // L2: relPath → decision
}

export interface Conflict {
  relativePath: string;
  reason: 'user_modified_post_ai';
  currentHash: string;
  checkpointHash: string;
}

export interface RestoreOperation {
  type: 'write' | 'delete';
  relativePath: string;
  absolutePath: string;
  objectHash: string | null;
}

export interface RestorePlan {
  operations: RestoreOperation[];
}

export interface FileMeta {
  relativePath: string;
  size: number;
  mtime: number;
}

export interface IFileScanner {
  scan(folderUri?: any): Promise<Map<string, FileMeta>>;  // L1: optional folder scope
}
