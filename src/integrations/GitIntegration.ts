import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class GitIntegration {
  constructor(private workspaceRoot: string) {}

  /**
   * Checks if the workspace is a git repository.
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await exec('git rev-parse --is-inside-work-tree', { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a specific file is ignored by git.
   * Useful as a fallback if vscode.workspace.findFiles doesn't catch it.
   */
  async isIgnored(relativePath: string): Promise<boolean> {
    try {
      await exec(`git check-ignore -q "${relativePath}"`, { cwd: this.workspaceRoot });
      // If exit code is 0, it is ignored
      return true;
    } catch (err: any) {
      // Exit code 1 means NOT ignored
      return false;
    }
  }

  /**
   * Gets the current branch name, useful for labeling checkpoints.
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const { stdout } = await exec('git branch --show-current', { cwd: this.workspaceRoot });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
}
