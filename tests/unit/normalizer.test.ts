import { describe, it, expect } from 'vitest';
import { ContentNormalizer } from '../../src/core/ContentNormalizer';

describe('ContentNormalizer', () => {
  it('identifies text files correctly', () => {
    expect(ContentNormalizer.isTextFile('file.ts')).toBe(true);
    expect(ContentNormalizer.isTextFile('file.json')).toBe(true);
    expect(ContentNormalizer.isTextFile('file.png')).toBe(false);
  });

  it('normalizes CRLF to LF for text files', () => {
    const input = Buffer.from('line1\r\nline2\r\nline3', 'utf-8');
    const expected = Buffer.from('line1\nline2\nline3', 'utf-8');
    
    const output = ContentNormalizer.normalize(input, 'test.ts');
    expect(output.equals(expected)).toBe(true);
  });

  it('leaves LF untouched', () => {
    const input = Buffer.from('line1\nline2\nline3', 'utf-8');
    const expected = Buffer.from('line1\nline2\nline3', 'utf-8');
    
    const output = ContentNormalizer.normalize(input, 'test.ts');
    expect(output.equals(expected)).toBe(true);
  });

  it('does not touch binary files', () => {
    const input = Buffer.from('binary\r\ndata', 'utf-8');
    const output = ContentNormalizer.normalize(input, 'image.png');
    expect(output.equals(input)).toBe(true);
  });
  
  it('detects binary content via null bytes even if extension is text', () => {
    const input = Buffer.from('text\r\n\0null\r\nbytes', 'utf-8');
    const output = ContentNormalizer.normalize(input, 'test.ts');
    // Because of null byte, heuristic should skip normalization
    expect(output.equals(input)).toBe(true);
  });
});
