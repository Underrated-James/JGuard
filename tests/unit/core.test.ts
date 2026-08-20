import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ChangeDetector } from '../../src/core/ChangeDetector';
import { CheckpointService } from '../../src/application/CheckpointService';
import { ObjectStore } from '../../src/storage/ObjectStore';
import { MetadataStore } from '../../src/storage/MetadataStore';
import { IFileScanner, FileMeta } from '../../src/core/types';
import { Hasher } from '../../src/core/Hasher';

class MockScanner implements IFileScanner {
  constructor(private files: Record<string, string>, private root: string) {}

  async scan(): Promise<Map<string, FileMeta>> {
    const map = new Map<string, FileMeta>();
    for (const [relPath, content] of Object.entries(this.files)) {
      const absPath = path.join(this.root, relPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, content);
      const stat = await fs.stat(absPath);
      map.set(relPath, {
        relativePath: relPath,
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    }
    return map;
  }

  // Helper to simulate manual edits
  async updateFile(relPath: string, content: string) {
    this.files[relPath] = content;
  }
  
  async deleteFile(relPath: string) {
    delete this.files[relPath];
    const absPath = path.join(this.root, relPath);
    await fs.unlink(absPath);
  }
}

describe('Core Engine', () => {
  const tmpRoot = path.join(__dirname, 'tmp-core');
  const wsRoot = path.join(tmpRoot, 'workspace');
  const storageRoot = path.join(tmpRoot, 'storage');

  let objectStore: ObjectStore;
  let metadataStore: MetadataStore;

  beforeEach(async () => {
    await fs.mkdir(wsRoot, { recursive: true });
    await fs.mkdir(storageRoot, { recursive: true });
    objectStore = new ObjectStore(storageRoot);
    metadataStore = new MetadataStore(storageRoot);
    await objectStore.initialize();
    await metadataStore.initialize();
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('should detect file changes (Scenario 1 & 2 & 3)', async () => {
    const initialFiles = {
      'api.ts': 'function old() {}',
      'database.ts': 'db connect',
    };

    const scanner = new MockScanner(initialFiles, wsRoot);
    const service = new CheckpointService(metadataStore, objectStore, scanner, wsRoot);
    service.setGCEnabled(false);
    
    // 1. Create checkpoint
    const cp = await service.createCheckpoint('ws-1');
    expect(Object.keys(cp.files)).toHaveLength(2);
    expect(cp.files['api.ts']).toBeDefined();

    // 2. Simulate AI modifications
    await scanner.updateFile('api.ts', 'function new() {}'); // Modified
    await scanner.updateFile('auth.ts', 'auth logic');       // Created
    await scanner.deleteFile('database.ts');                 // Deleted

    // 3. Detect changes
    const changeSet = await ChangeDetector.detectChanges(cp, scanner, wsRoot);

    expect(changeSet.changes).toHaveLength(3);
    
    const modified = changeSet.changes.find(c => c.type === 'modified');
    expect(modified?.relativePath).toBe('api.ts');

    const created = changeSet.changes.find(c => c.type === 'created');
    expect(created?.relativePath).toBe('auth.ts');

    const deleted = changeSet.changes.find(c => c.type === 'deleted');
    expect(deleted?.relativePath).toBe('database.ts');
    
    // Verify aiStateHashes recorded the new states
    expect(changeSet.aiStateHashes['api.ts']).toBe(Hasher.hashBuffer(Buffer.from('function new() {}')));
    expect(changeSet.aiStateHashes['auth.ts']).toBe(Hasher.hashBuffer(Buffer.from('auth logic')));
  });
});
