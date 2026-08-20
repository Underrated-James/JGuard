import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Hasher } from '../../src/core/Hasher';
import { ObjectStore } from '../../src/storage/ObjectStore';
import { MetadataStore } from '../../src/storage/MetadataStore';
import { Checkpoint } from '../../src/core/types';

describe('Storage Engine', () => {
  const tmpDir = path.join(__dirname, 'tmp-storage');
  
  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Hasher', () => {
    it('should hash a string correctly', () => {
      const content = Buffer.from('hello world');
      const hash = Hasher.hashBuffer(content);
      // SHA256 of 'hello world'
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should hash a file correctly', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'hello world');
      const hash = await Hasher.hashFile(filePath);
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });
  });

  describe('ObjectStore', () => {
    it('should write and read an object', async () => {
      const store = new ObjectStore(tmpDir);
      await store.initialize();
      const content = Buffer.from('test content');
      
      const hash = await store.write(content);
      expect(hash).toBeDefined();

      const exists = await store.exists(hash);
      expect(exists).toBe(true);

      const readContent = await store.read(hash);
      expect(readContent.toString()).toBe('test content');
    });

    it('should handle deleting an object', async () => {
      const store = new ObjectStore(tmpDir);
      await store.initialize();
      const content = Buffer.from('delete me');
      
      const hash = await store.write(content);
      await store.delete(hash);

      const exists = await store.exists(hash);
      expect(exists).toBe(false);
    });
  });

  describe('MetadataStore', () => {
    it('should write and read a checkpoint', async () => {
      const store = new MetadataStore(tmpDir);
      await store.initialize();

      const cp: Checkpoint = {
        id: 'test-id',
        workspaceId: 'ws-1',
        createdAt: 123456789,
        status: 'active',
        files: {
          'file.txt': {
            hash: 'abc',
            size: 10,
            mtime: 123,
            isBinary: false
          }
        },
        workspaceRoot: tmpDir,  // L1: required field
      };

      await store.write(cp.id, cp);
      const readCp = await store.read(cp.id);

      expect(readCp).toEqual(cp);
    });
  });

  describe('BlobGarbageCollector', () => {
    it('should retain reachable blobs from sessions and delete orphaned ones', async () => {
      const { BlobGarbageCollector } = await import('../../src/application/BlobGarbageCollector');
      const objStore = new ObjectStore(tmpDir);
      await objStore.initialize();
      const metaStore = new MetadataStore(tmpDir);
      await metaStore.initialize();

      const hash1 = await objStore.write(Buffer.from('live content 1'));
      const hash2 = await objStore.write(Buffer.from('orphaned content 2'));

      // Create a session referencing hash1
      await metaStore.writeSession('session-1', {
        id: 'session-1',
        createdAt: Date.now(),
        status: 'active',
        folderCheckpoints: {
          [tmpDir]: {
            id: 'cp-1',
            workspaceId: 'ws-1',
            createdAt: Date.now(),
            status: 'active',
            workspaceRoot: tmpDir,
            files: {
              'file1.txt': { hash: hash1, size: 14, mtime: Date.now(), isBinary: false }
            }
          }
        }
      });

      const gc = new BlobGarbageCollector(metaStore, objStore, tmpDir);
      const { deletedCount } = await gc.run();

      expect(deletedCount).toBe(1);
      expect(await objStore.exists(hash1)).toBe(true);
      expect(await objStore.exists(hash2)).toBe(false);
    });
  });
});
