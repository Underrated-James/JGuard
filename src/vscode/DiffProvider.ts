import * as vscode from 'vscode';
import { ObjectStore } from '../storage/ObjectStore';

export class DiffProvider implements vscode.TextDocumentContentProvider {
  static scheme = 'jguard';

  constructor(private objectStore: ObjectStore) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    // URI format: jguard://<hash>/<filename>
    const hash = uri.authority;
    if (!hash) {
      return '';
    }

    try {
      const content = await this.objectStore.read(hash);
      return new TextDecoder().decode(content);
    } catch (err) {
      console.error(`Failed to read object ${hash} from store`, err);
      return 'Error: Could not load file content from JGuard checkpoint.';
    }
  }
}
