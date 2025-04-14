import { parsePatch, diffChars } from 'diff';

// Listen for messages from the main thread
self.onmessage = (event) => {
  const { lineDiffPatch, originalContentA, originalContentB } = event.data;

  // Perform the heavy processing here
  try {
    const originalLinesA = originalContentA?.split('\n') || [];
    const originalLinesB = originalContentB?.split('\n') || [];

    // --- Start of processing logic moved from DiffViewer ---
    if (!lineDiffPatch || !originalContentA || !originalContentB) {
      console.log("Worker: Missing patch or original content.");
      if (originalContentB && !lineDiffPatch) {
        const lines = originalLinesB.map((line, index) => ({
          key: `orig-b-${index}`,
          type: 'context',
          content: line,
          lineNumber: index + 1,
          charDiff: null, // Char diff is handled on demand in main thread
        }));
        self.postMessage({ status: 'success', processedLines: lines });
        return;
      }
      self.postMessage({ status: 'success', processedLines: [] });
      return;
    }

    const diffs = parsePatch(lineDiffPatch);
    if (!diffs || diffs.length === 0) {
      console.log("Worker: Parsed patch is empty.");
      const lines = originalLinesB.map((line, index) => ({
        key: `nochange-b-${index}`,
        type: 'context',
        content: line,
        lineNumber: index + 1,
        charDiff: null,
      }));
      self.postMessage({ status: 'success', processedLines: lines });
      return;
    }

    const allLines = [];
    let lineKeyCounter = 0;

    diffs.forEach((diff, diffIndex) => {
      diff.hunks.forEach((hunk, hunkIndex) => {
        let oldLineNum = hunk.oldStart;
        let newLineNum = hunk.newStart;
        let processedLinesInHunk = []; // Store lines temporarily for char diff pairing
        let lastRemovedLineIndex = -1; // Index in processedLinesInHunk of the last removed line

        for (let i = 0; i < hunk.lines.length; i++) {
          const patchLine = hunk.lines[i];
          const lineType = patchLine.startsWith('+') ? 'added' :
                           patchLine.startsWith('-') ? 'removed' : 'context';
          let originalLineContent = '';
          let displayLineNumber = null;
          let currentLineObj = null;

          if (lineType === 'context') {
            originalLineContent = originalLinesA[oldLineNum - 1] ?? ''; // Content comes from A for context
            displayLineNumber = newLineNum; // Display new line number for context
            currentLineObj = {
              key: `line-${diffIndex}-${hunkIndex}-${lineKeyCounter++}`,
              type: lineType,
              content: originalLineContent,
              lineNumber: displayLineNumber,
              charDiff: null,
            };
            processedLinesInHunk.push(currentLineObj);
            lastRemovedLineIndex = -1; // Reset removed line tracking
            oldLineNum++;
            newLineNum++;
          } else if (lineType === 'removed') {
            originalLineContent = originalLinesA[oldLineNum - 1] ?? '';
            displayLineNumber = oldLineNum; // Display old line number for removed
            currentLineObj = {
              key: `line-${diffIndex}-${hunkIndex}-${lineKeyCounter++}`,
              type: lineType,
              content: originalLineContent,
              lineNumber: displayLineNumber,
              charDiff: null, // Initialize charDiff
            };
            processedLinesInHunk.push(currentLineObj);
            lastRemovedLineIndex = processedLinesInHunk.length - 1; // Track this removed line
            oldLineNum++;
          } else if (lineType === 'added') {
            originalLineContent = originalLinesB[newLineNum - 1] ?? '';
            displayLineNumber = newLineNum; // Display new line number for added
             currentLineObj = {
              key: `line-${diffIndex}-${hunkIndex}-${lineKeyCounter++}`,
              type: lineType,
              content: originalLineContent,
              lineNumber: displayLineNumber,
              charDiff: null, // Initialize charDiff
            };

            // Attempt to pair with the last removed line
            if (lastRemovedLineIndex !== -1) {
              const removedLine = processedLinesInHunk[lastRemovedLineIndex];
              // Ensure the removed line hasn't already been paired
              if (removedLine && removedLine.type === 'removed' && !removedLine.paired) {
                 const charDiffResult = diffChars(removedLine.content, currentLineObj.content);
                 // Store char diff on both lines
                 removedLine.charDiff = charDiffResult;
                 currentLineObj.charDiff = charDiffResult;
                 removedLine.paired = true; // Mark as paired
                 lastRemovedLineIndex = -1; // Reset tracker
              }
            }
            processedLinesInHunk.push(currentLineObj);
            // Don't reset lastRemovedLineIndex here, allow consecutive adds after a remove
            newLineNum++;
          }
        }
        // Add processed lines for this hunk to the main list
        allLines.push(...processedLinesInHunk);
      });
    });
     // --- End of processing logic ---

    // --- Check for duplicate keys before posting ---
    const uniqueKeys = new Set(allLines.map(line => line.key));
    if (uniqueKeys.size !== allLines.length) {
      console.error("Worker: Duplicate keys detected before posting!", allLines.length, uniqueKeys.size);
      // Find duplicates for debugging
      const keyCounts = allLines.reduce((acc, line) => {
        acc[line.key] = (acc[line.key] || 0) + 1;
        return acc;
      }, {});
      const duplicates = Object.entries(keyCounts).filter(([key, count]) => count > 1);
      console.error("Duplicate keys:", duplicates);
    } else {
       console.log(`Worker: All ${allLines.length} keys are unique.`); // Add this log
    }
    // --- End check ---

     console.log("Worker: Processed lines count:", allLines.length); // Keep this one for now
     // Send the result back to the main thread
     self.postMessage({ status: 'success', processedLines: allLines });

   } catch (error) {
    console.error("Worker: Error processing diff:", error);
    // Send error back to the main thread
    self.postMessage({ status: 'error', error: error.message });
  }
};
