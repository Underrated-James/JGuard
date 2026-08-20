import * as path from 'path';

/**
 * L7: Normalizes content to ensure cross-OS compatibility.
 * Windows uses CRLF (\r\n), Unix uses LF (\n). 
 * This normalizes all text to LF for hashing and storage to prevent 
 * false-positive changes when sharing workspaces across operating systems.
 */
export class ContentNormalizer {
  // A simple list of common text extensions. 
  // In a full implementation, we might use is-binary-path.
  private static textExtensions = new Set([
    '.ts', '.js', '.json', '.md', '.txt', '.csv', '.html', '.css', '.scss', 
    '.xml', '.yml', '.yaml', '.toml', '.ini', '.sh', '.bat', '.ps1'
  ]);

  /**
   * Checks if a file is likely text based on its extension.
   */
  static isTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.textExtensions.has(ext);
  }

  /**
   * Normalizes CRLF to LF in a buffer if it's a text file.
   * If it's a binary file, returns the buffer unmodified.
   */
  static normalize(buffer: Buffer, filePath: string): Buffer {
    if (!this.isTextFile(filePath)) {
      return buffer;
    }

    // Convert Buffer to string, replace \r\n with \n, convert back to Buffer
    // Note: For very large files this might be inefficient, but for source code it's fine.
    const text = buffer.toString('utf-8');
    
    // Check if it's actually valid UTF-8 (simple heuristic: no null bytes)
    if (text.indexOf('\0') !== -1) {
      return buffer; // Looks like binary
    }

    const normalizedText = text.replace(/\r\n/g, '\n');
    return Buffer.from(normalizedText, 'utf-8');
  }

  /**
   * Creates a Transform stream that normalizes CRLF to LF on the fly.
   * Not fully implemented here for brevity, but this is where a streaming normalizer would go.
   */
}
