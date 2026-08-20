import * as diff from 'diff';

export interface Hunk {
  header: string;
  lines: string[];
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  id: string; // Unique ID for CodeLens
}

export class HunkDiffer {
  /**
   * Computes differences between old and new text and returns them as hunks.
   */
  static getHunks(oldText: string, newText: string, filePath: string): Hunk[] {
    const patchStr = diff.createTwoFilesPatch(
      filePath, filePath,
      oldText, newText,
      'Original', 'AI',
      { context: 3 }
    );

    const parsed = diff.parsePatch(patchStr);
    if (!parsed || parsed.length === 0) return [];

    const patch = parsed[0];
    const hunks: Hunk[] = [];

    if (!patch.hunks) return [];

    for (let i = 0; i < patch.hunks.length; i++) {
      const h = patch.hunks[i];
      hunks.push({
        header: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
        lines: h.lines,
        oldStart: h.oldStart,
        oldLines: h.oldLines,
        newStart: h.newStart,
        newLines: h.newLines,
        id: `${filePath}-hunk-${i}`
      });
    }

    return hunks;
  }
}
