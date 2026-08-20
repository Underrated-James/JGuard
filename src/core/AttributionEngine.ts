import * as vscode from 'vscode';
import * as path from 'path';

export class AttributionEngine {
  private attributions = new Map<string, 'human' | 'ai' | 'git'>();
  private lastEditorChange = new Map<string, number>();
  private streamingStats = new Map<string, { charsAdded: number, startTime: number }>();

  public getAttribution(absPath: string): 'human' | 'ai' | 'git' | undefined {
    return this.attributions.get(absPath);
  }

  public clear() {
    this.attributions.clear();
    this.lastEditorChange.clear();
    this.streamingStats.clear();
  }

  public async trackEditorChange(event: vscode.TextDocumentChangeEvent) {
    if (event.document.uri.scheme !== 'file') return;
    
    const absPath = event.document.uri.fsPath;
    this.lastEditorChange.set(absPath, Date.now());

    let totalAdded = 0;
    let isMassiveReplace = false;
    for (const change of event.contentChanges) {
      totalAdded += change.text.length;
      if (change.rangeLength > 100 && Math.abs(change.rangeLength - change.text.length) < 50) {
        // This is likely a formatter: replacing a large block with a similarly sized block
        isMassiveReplace = true;
      }
    }

    if (totalAdded === 0 && event.contentChanges.some(c => c.rangeLength > 0)) {
      // Pure deletion
      this.attributions.set(absPath, 'human');
      return;
    }

    // Check for massive burst
    if (totalAdded > 50) {
      if (isMassiveReplace) {
        // Likely a human triggering "Format Document"
        this.attributions.set(absPath, 'human');
        return;
      }

      // Read clipboard
      try {
        const clipboardText = await vscode.env.clipboard.readText();
        // If any of the content changes perfectly matches the clipboard
        if (event.contentChanges.some(c => c.text === clipboardText || clipboardText.includes(c.text))) {
          this.attributions.set(absPath, 'human');
          return;
        }
      } catch (e) {
        // ignore clipboard error
      }

      // If it's a massive burst, not a formatter, not a paste -> AI
      this.attributions.set(absPath, 'ai');
      return;
    }

    // Check for fast streaming (AI)
    const now = Date.now();
    let stats = this.streamingStats.get(absPath);
    if (!stats || now - stats.startTime > 2000) {
      stats = { charsAdded: 0, startTime: now };
    }
    stats.charsAdded += totalAdded;
    this.streamingStats.set(absPath, stats);

    if (stats.charsAdded > 100 && (now - stats.startTime) < 1000) {
      // > 100 chars in < 1 second = AI
      this.attributions.set(absPath, 'ai');
    } else {
      // Normal typing
      const current = this.attributions.get(absPath);
      // Don't overwrite an 'ai' attribution with 'human' just because the AI did a small final chunk
      if (current !== 'ai') {
        this.attributions.set(absPath, 'human');
      }
    }
  }

  public trackExternalChange(absPath: string) {
    const lastChange = this.lastEditorChange.get(absPath);
    const now = Date.now();
    // If the editor hasn't changed this file in the last 2 seconds, it's external (Git)
    if (!lastChange || now - lastChange > 2000) {
      this.attributions.set(absPath, 'git');
    }
  }
}
