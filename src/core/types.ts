export interface Checkpoint {
  id: string;
  workspaceId: string;
  createdAt: number;
  status: 'active' | 'accepted' | 'rejected';
  files: Record<string, FileSnapshot>;
  label?: string;
}

export interface FileSnapshot {
  hash: string;
  size: number;
  mtime: number;
  isBinary: boolean;
}

export type FileChange = 
  | { type: 'created'; relativePath: string; currentHash: string }
  | { type: 'modified'; relativePath: string; checkpointHash: string; currentHash: string }
  | { type: 'deleted'; relativePath: string; checkpointHash: string };

export interface ChangeSet {
  checkpointId: string;
  computedAt: number;
  changes: FileChange[];
  aiStateHashes: Record<string, string>;
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
  scan(): Promise<Map<string, FileMeta>>;
}

