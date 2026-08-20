import * as fs from 'fs/promises';
import * as path from 'path';
import { StashedChange } from '../core/types';

export class StashStore {
  constructor(private storageBaseDir: string) {}

  private getStashesPath(): string {
    return path.join(this.storageBaseDir, 'stashes.json');
  }

  async initialize(): Promise<void> {
    const p = this.getStashesPath();
    try {
      await fs.access(p);
    } catch {
      await fs.writeFile(p, '[]', 'utf-8');
    }
  }

  async getStashes(): Promise<StashedChange[]> {
    try {
      const content = await fs.readFile(this.getStashesPath(), 'utf-8');
      return JSON.parse(content) as StashedChange[];
    } catch {
      return [];
    }
  }

  async saveStash(stash: StashedChange): Promise<void> {
    const stashes = await this.getStashes();
    stashes.push(stash);
    await fs.writeFile(this.getStashesPath(), JSON.stringify(stashes, null, 2), 'utf-8');
  }

  async removeStash(id: string): Promise<void> {
    const stashes = await this.getStashes();
    const updated = stashes.filter(s => s.id !== id);
    await fs.writeFile(this.getStashesPath(), JSON.stringify(updated, null, 2), 'utf-8');
  }

  async getStash(id: string): Promise<StashedChange | undefined> {
    const stashes = await this.getStashes();
    return stashes.find(s => s.id === id);
  }
}
