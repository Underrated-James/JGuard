import ignore, { Ignore } from 'ignore';
import * as path from 'path';
import * as fs from 'fs/promises';

export class IgnoreManager {
  private ig: Ignore;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.ig = ignore();
    
    // Add default hardcoded fallbacks
    this.ig.add([
      // JS / Node
      'node_modules',
      'dist',
      'build',
      'out',
      '.angular',
      '.next',
      '.nuxt',
      'coverage',
      '.turbo',
      
      // Java
      'target',
      '.gradle',
      
      // Python
      '__pycache__',
      'venv',
      '.venv',
      'env',
      '.pytest_cache',
      '.tox',
      
      // .NET
      'bin',
      'obj',
      '.vs',
      
      // System / General
      '.git',
      '.idea',
      '.DS_Store'
    ]);
  }

  /**
   * Initializes the manager by reading the .gitignore file if it exists.
   */
  async initialize(): Promise<void> {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf8');
      this.ig.add(content);
      console.log('JGuard: Loaded .gitignore rules from', gitignorePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('JGuard: Failed to read .gitignore', err);
      }
    }
  }

  /**
   * Checks if an absolute file path should be ignored.
   * @param absolutePath The absolute path of the file/folder to check.
   */
  isIgnored(absolutePath: string): boolean {
    if (!absolutePath.startsWith(this.workspaceRoot)) {
      return false; // Out of bounds
    }

    const relativePath = path.relative(this.workspaceRoot, absolutePath).replace(/\\/g, '/');
    if (relativePath === '') {
      return false; // Root itself is not ignored
    }
    
    return this.ig.ignores(relativePath);
  }
}
