import * as crypto from 'crypto';
import * as fs from 'fs';
import { ContentNormalizer } from './ContentNormalizer';

export class Hasher {
  /**
   * Computes the SHA-256 hash of a file using streams to handle large files efficiently.
   * L7: Now buffers and normalizes text files to LF to avoid cross-OS hash mismatches.
   * @param absolutePath The absolute path to the file.
   * @returns A promise that resolves to the hex representation of the SHA-256 hash.
   */
  static hashFile(absolutePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // If it's a text file, read the whole thing to normalize.
      // (For truly massive text files this might be an issue, but for source code it's optimal)
      if (ContentNormalizer.isTextFile(absolutePath)) {
        fs.readFile(absolutePath, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          const normalized = ContentNormalizer.normalize(data, absolutePath);
          const hash = crypto.createHash('sha256');
          hash.update(normalized);
          resolve(hash.digest('hex'));
        });
        return;
      }

      // For binary files, use a streaming approach
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(absolutePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Computes the SHA-256 hash of a buffer.
   * @param content The buffer to hash.
   * @param filePath Optional filepath to determine if normalization is needed.
   * @returns The hex representation of the SHA-256 hash.
   */
  static hashBuffer(content: Uint8Array, filePath?: string): string {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const finalBuffer = filePath ? ContentNormalizer.normalize(buffer, filePath) : buffer;
    
    const hash = crypto.createHash('sha256');
    hash.update(finalBuffer);
    return hash.digest('hex');
  }
}
