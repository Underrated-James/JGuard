import * as vscode from 'vscode';

/**
 * BatchedWatcherQueue implements a sliding window accumulator for file system events.
 * It deduplicates URIs and flushes them in batches to prevent event storms.
 * L4: Solves UI hanging during rapid streaming edits (e.g. AI generating code).
 */
export class BatchedWatcherQueue {
  private pendingUris: Set<string> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private readonly delayMs: number;
  private readonly maxBatchSize: number;
  private readonly onFlush: (uris: vscode.Uri[]) => void;

  /**
   * @param delayMs Time to wait for more events before flushing (sliding window)
   * @param maxBatchSize Maximum number of events before forcing a flush
   * @param onFlush Callback when the batch is ready
   */
  constructor(delayMs: number, maxBatchSize: number, onFlush: (uris: vscode.Uri[]) => void) {
    this.delayMs = delayMs;
    this.maxBatchSize = maxBatchSize;
    this.onFlush = onFlush;
  }

  /**
   * Enqueue a file URI for processing.
   */
  public enqueue(uri: vscode.Uri): void {
    const key = uri.toString();
    if (!this.pendingUris.has(key)) {
      this.pendingUris.add(key);
    }

    // Force flush if we hit the batch limit
    if (this.pendingUris.size >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Reset the sliding window timer
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  /**
   * Immediately flush any pending URIs.
   */
  public flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingUris.size === 0) {
      return;
    }

    const uris = Array.from(this.pendingUris).map(s => vscode.Uri.parse(s));
    this.pendingUris.clear();
    
    // Call the handler
    this.onFlush(uris);
  }

  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingUris.clear();
  }
}
