import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ChangeDetector } from '../../src/core/ChangeDetector';
import { CheckpointService } from '../../src/application/CheckpointService';
import { ConflictDetector } from '../../src/core/ConflictDetector';
import { RestorePlanner } from '../../src/core/RestorePlanner';
import { RestoreService } from '../../src/application/RestoreService';
import { ObjectStore } from '../../src/storage/ObjectStore';
import { MetadataStore } from '../../src/storage/MetadataStore';
import { IFileScanner, FileMeta } from '../../src/core/types';
import { Hasher } from '../../src/core/Hasher';

class MockScanner implements IFileScanner {
  constructor(private files: Record<string, string>, private root: string) {}

  async scan(): Promise<Map<string, FileMeta>> {
    const map = new Map<string, FileMeta>();
    // Make sure we scan actual files on disk
    const dirs = [this.root];
    while (dirs.length > 0) {
      const dir = dirs.pop()!;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const absPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            dirs.push(absPath);
          } else {
            const stat = await fs.stat(absPath);
            const relPath = path.relative(this.root, absPath);
            map.set(relPath, {
              relativePath: relPath,
              size: stat.size,
              mtime: stat.mtimeMs,
            });
          }
        }
      } catch (e) {
        // Ignore missing dirs
      }
    }
    return map;
  }

  // Setup initial files
  async setupFiles() {
    for (const [relPath, content] of Object.entries(this.files)) {
      const absPath = path.join(this.root, relPath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, content);
    }
  }

  async updateFile(relPath: string, content: string) {
    const absPath = path.join(this.root, relPath);
    await fs.writeFile(absPath, content);
  }
  
  async deleteFile(relPath: string) {
    const absPath = path.join(this.root, relPath);
    await fs.unlink(absPath);
  }
}

describe('Restore Engine', () => {
  const tmpRoot = path.join(__dirname, 'tmp-restore');
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

  it('should detect conflicts and safely restore (Scenarios 4 & 5)', async () => {
    const initialFiles = {
      'api.ts': 'function old() {}',
      'database.ts': 'db connect',
      'App.tsx': 'app',
    };

    const scanner = new MockScanner(initialFiles, wsRoot);
    await scanner.setupFiles();
    const service = new CheckpointService(metadataStore, objectStore, scanner, wsRoot);
    service.setGCEnabled(false);
    
    // 1. Create checkpoint
    const cp = await service.createCheckpoint('ws-1');

    // 2. Simulate AI modifications
    await scanner.updateFile('api.ts', 'function aiEdit() {}');
    await scanner.updateFile('auth.ts', 'auth logic');
    await scanner.deleteFile('database.ts');

    // 3. Detect changes (this represents the Review step)
    const changeSet = await ChangeDetector.detectChanges(cp, scanner, wsRoot);
    expect(changeSet.changes).toHaveLength(3);

    // 4. Simulate user manual modification AFTER AI
    await scanner.updateFile('api.ts', 'function userEditAfterAi() {}');

    // 5. Detect conflicts (Reject triggered)
    const conflicts = await ConflictDetector.detect(changeSet, scanner, wsRoot);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].relativePath).toBe('api.ts');
    expect(conflicts[0].reason).toBe('user_modified_post_ai');

    // 6. Build Restore Plan
    const plan = RestorePlanner.buildPlan(cp, changeSet, conflicts, wsRoot);
    
    // It should skip the conflicted api.ts, delete auth.ts, write database.ts
    expect(plan.operations).toHaveLength(2);
    expect(plan.operations.find(o => o.type === 'delete' && o.relativePath === 'auth.ts')).toBeDefined();
    expect(plan.operations.find(o => o.type === 'write' && o.relativePath === 'database.ts')).toBeDefined();

    // 7. Execute Restore
    const restoreService = new RestoreService(objectStore);
    await restoreService.execute(plan);

    // 8. Verify final disk state
    const finalContentApi = await fs.readFile(path.join(wsRoot, 'api.ts'), 'utf-8');
    expect(finalContentApi).toBe('function userEditAfterAi() {}'); // Was not overwritten

    const finalContentDb = await fs.readFile(path.join(wsRoot, 'database.ts'), 'utf-8');
    expect(finalContentDb).toBe('db connect'); // Restored

    await expect(fs.readFile(path.join(wsRoot, 'auth.ts'))).rejects.toThrow(); // Deleted
  });
});
