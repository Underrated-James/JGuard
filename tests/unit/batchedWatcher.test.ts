import { describe, it, expect, vi } from 'vitest';
import { BatchedWatcherQueue } from '../../src/vscode/BatchedWatcherQueue';

vi.mock('vscode', () => ({
  Uri: {
    parse: (s: string) => ({ toString: () => s, fsPath: s }),
    file: (s: string) => ({ toString: () => s, fsPath: s })
  }
}));

import * as vscode from 'vscode';

describe('BatchedWatcherQueue', () => {
  it('deduplicates and batches URIs', async () => {
    vi.useFakeTimers();
    
    const flushHandler = vi.fn();
    const queue = new BatchedWatcherQueue(200, 50, flushHandler);
    
    const uri1 = vscode.Uri.file('/test/file1.ts');
    const uri2 = vscode.Uri.file('/test/file2.ts');
    
    queue.enqueue(uri1);
    queue.enqueue(uri1); // Duplicate
    queue.enqueue(uri2);
    
    expect(flushHandler).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(250);
    
    expect(flushHandler).toHaveBeenCalledTimes(1);
    const uris = flushHandler.mock.calls[0][0];
    expect(uris.length).toBe(2);
    expect(uris[0].fsPath).toBe(uri1.fsPath);
    expect(uris[1].fsPath).toBe(uri2.fsPath);
    
    vi.useRealTimers();
  });
  
  it('flushes immediately if maxBatchSize is reached', () => {
    const flushHandler = vi.fn();
    const queue = new BatchedWatcherQueue(200, 2, flushHandler);
    
    const uri1 = vscode.Uri.file('/test/file1.ts');
    const uri2 = vscode.Uri.file('/test/file2.ts');
    
    queue.enqueue(uri1);
    expect(flushHandler).not.toHaveBeenCalled();
    
    queue.enqueue(uri2);
    // Batch size of 2 reached, should flush immediately
    expect(flushHandler).toHaveBeenCalledTimes(1);
  });
});
