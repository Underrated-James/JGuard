import * as diff from 'diff';
import { Hunk } from './HunkDiffer';

export class HunkPatchApplier {
  /**
   * Applies a specific hunk to the original text.
   * NOTE: This is a simplistic implementation that just applies the patch
   * strictly. In a real robust system, it would try to fuzz-match the hunk.
   */
  static applyHunk(originalText: string, hunk: Hunk, filePath: string): string {
    const patchObj: any = {
      oldFileName: filePath,
      newFileName: filePath,
      oldHeader: 'Original',
      newHeader: 'AI',
      hunks: [
        {
          oldStart: hunk.oldStart,
          oldLines: hunk.oldLines,
          newStart: hunk.newStart,
          newLines: hunk.newLines,
          lines: hunk.lines
        }
      ]
    };

    const patched = diff.applyPatch(originalText, patchObj);
    return patched === false ? originalText : patched;
  }
  
  /**
   * Applies multiple hunks to the original text.
   */
  static applyHunks(originalText: string, hunks: Hunk[], filePath: string): string {
    const patchObj: any = {
      oldFileName: filePath,
      newFileName: filePath,
      oldHeader: 'Original',
      newHeader: 'AI',
      hunks: hunks.map(h => ({
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        lines: h.lines
      }))
    };

    const patched = diff.applyPatch(originalText, patchObj);
    return patched === false ? originalText : patched;
  }
}
