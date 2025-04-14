// components/DiffViewer.jsx
import React, { useEffect, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import necessary functions from 'diff'
import { parsePatch, diffChars } from 'diff';

// Customize the style slightly for better integration
const customStyle = {
  ...vscDarkPlus,
  // Ensure the background is transparent to show the underlying diff color
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    backgroundColor: 'transparent', // Make code background transparent
    color: 'inherit', // Inherit color from parent line style
    textShadow: 'none',
    display: 'inline', // Allow inline rendering within the line div
    padding: '0',
    margin: '0',
    whiteSpace: 'pre-wrap', // Ensure wrapping within the highlighter
    wordBreak: 'break-all', // Break long words/tokens
  },
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    backgroundColor: 'transparent', // Make pre background transparent
    padding: '0', // Remove default padding from pre tag
    margin: '0',
    overflow: 'visible', // Prevent scrollbars within the line
    whiteSpace: 'pre-wrap', // Allow wrapping
    wordBreak: 'break-all', // Break long words/tokens
  }
};

// Helper function to render line content with character diffs if available
const renderLineContent = (line, language) => {
  if (line.charDiff) {
    // Render character diffs based on ORIGINAL content
    return line.charDiff.map((part, index) => {
      const charStyles = {
        added: 'bg-green-600 bg-opacity-40 text-green-100', // More prominent char add
        removed: 'bg-red-600 bg-opacity-40 text-red-100 line-through', // More prominent char remove
        context: '', // No special style for context chars within a changed line
      };
      const type = part.added ? 'added' : part.removed ? 'removed' : 'context';
      // Only render non-removed characters for added lines, and non-added for removed lines
      if ((line.type === 'added' && type === 'removed') || (line.type === 'removed' && type === 'added')) {
        return null;
      }
      return (
        <span key={`char-${index}`} className={`${charStyles[type]}`}>
          {part.value}
        </span>
      );
    });
  } else {
    // Render ORIGINAL content with syntax highlighting
    return (
      <SyntaxHighlighter
        language={language}
        style={customStyle}
        wrapLines={true} // Enable wrapping within the highlighter
        PreTag="span" // Use span to avoid block layout issues
        CodeTag="span"
      >
        {/* Ensure we render the original content */}
        {line.content || ''}
      </SyntaxHighlighter>
    );
  }
};

const DiffViewer = ({
  fileName,
  // Receive line diff patch string (generated from placeholders)
  lineDiffPatch,
  // Receive ORIGINAL content A and B
  originalContentA,
  originalContentB,
  versions = [],
  onVersionChange,
  selectedVersion,
  secondSelectedVersion,
  language = 'plaintext'
}) => {

  // Split original content into lines for lookup (memoized)
  const originalLinesA = useMemo(() => originalContentA?.split('\n') || [], [originalContentA]);
  const originalLinesB = useMemo(() => originalContentB?.split('\n') || [], [originalContentB]);

  // Parse the patch string and process lines, mapping to ORIGINAL content
  const processedLines = useMemo(() => {
    // Ensure original content is available for mapping lines
    if (!lineDiffPatch || !originalContentA || !originalContentB) {
      console.log("ProcessedLines: Missing patch or original content.");
      // Display original B if no diff patch but content exists
      if (originalContentB && !lineDiffPatch) {
         return originalLinesB.map((line, index) => ({
            key: `orig-b-${index}`,
            type: 'context',
            content: line, // Original content
            lineNumber: index + 1,
            charDiff: null,
         }));
      }
      return [];
    }

    try {
      const diffs = parsePatch(lineDiffPatch);
      if (!diffs || diffs.length === 0) {
        console.log("ProcessedLines: Parsed patch is empty (potentially no changes).");
        // If patch is empty, it means no changes based on placeholder comparison
        return originalLinesB.map((line, index) => ({
           key: `nochange-b-${index}`,
           type: 'context',
           content: line, // Original content
           lineNumber: index + 1,
           charDiff: null,
        }));
      }

      const allLines = [];
      let lineKeyCounter = 0;

      diffs.forEach((diff, diffIndex) => {
        diff.hunks.forEach((hunk, hunkIndex) => {
          let oldLineNum = hunk.oldStart; // Line number in original A (1-based)
          let newLineNum = hunk.newStart; // Line number in original B (1-based)

          const hunkLines = [];
          // First pass: Collect lines, map to original content, store line numbers
          for (let i = 0; i < hunk.lines.length; i++) {
             const patchLine = hunk.lines[i];
             const lineType = patchLine.startsWith('+') ? 'added' :
                              patchLine.startsWith('-') ? 'removed' : 'context';
             let originalLineContent = '';
             let displayLineNumber = null;

             if (lineType === 'context') {
                // Context line exists in both A and B
                originalLineContent = originalLinesA[oldLineNum - 1] ?? ''; // Use A's content
                displayLineNumber = newLineNum; // Show B's line number
                oldLineNum++;
                newLineNum++;
             } else if (lineType === 'removed') {
                // Removed line exists only in A
                originalLineContent = originalLinesA[oldLineNum - 1] ?? '';
                displayLineNumber = oldLineNum; // Show A's line number
                oldLineNum++;
             } else if (lineType === 'added') {
                // Added line exists only in B
                originalLineContent = originalLinesB[newLineNum - 1] ?? '';
                displayLineNumber = newLineNum; // Show B's line number
                newLineNum++;
             }

             const lineObj = {
                key: `line-${diffIndex}-${hunkIndex}-${lineKeyCounter++}`,
                type: lineType,
                content: originalLineContent, // Store ORIGINAL content
                lineNumber: displayLineNumber,
                charDiff: null, // Placeholder for character diff result
             };
             hunkLines.push(lineObj);
          }

          // Second pass: Perform character diff on ORIGINAL content of adjacent removed/added lines
          for (let i = 0; i < hunkLines.length - 1; i++) {
             const currentLine = hunkLines[i];
             const nextLine = hunkLines[i + 1];

             // Check for adjacent removed and added lines identified by the placeholder patch
             if (currentLine.type === 'removed' && nextLine.type === 'added') {
                // Perform diffChars on the ORIGINAL content stored in the line objects
                const charResult = diffChars(currentLine.content, nextLine.content);
                // Store the char diff result (based on original content) on both lines
                currentLine.charDiff = charResult;
                nextLine.charDiff = charResult;
                // Optional: Skip the next line in the outer loop since we've processed it as a pair
                // i++; // Be careful with loop modification
             }
          }
          allLines.push(...hunkLines);
        });
      });

      console.log("Processed lines count (mapped to original):", allLines.length);
      return allLines;

    } catch (error) {
      console.error("Error parsing diff patch or mapping lines:", error);
      // Display error message as content
      return [{
         key: 'error-parse',
         type: 'context', // Render as normal text
         content: `Error processing diff: ${error.message}`,
         lineNumber: 1,
         charDiff: null,
      }];
    }
  // Depend on patch and ORIGINAL content for processing
  }, [lineDiffPatch, originalContentA, originalContentB, originalLinesA, originalLinesB]);

  // Add debugging
  useEffect(() => {
    console.log('DiffViewer received data:', {
      lineDiffPatchProvided: !!lineDiffPatch,
      originalALength: originalContentA?.length || 0,
      originalBLength: originalContentB?.length || 0,
    });
     // console.log('Processed Lines (first 10):', processedLines.slice(0, 10)); // Debugging
  }, [lineDiffPatch, originalContentA, originalContentB, processedLines]);

  // Update checks to use processedLines and lineDiffPatch
  const hasMeaningfulContent = useMemo(() => originalContentA || originalContentB, [originalContentA, originalContentB]);
  // Check if the processed lines contain any added or removed lines
  const hasChanges = useMemo(() => processedLines.some(p => p.type === 'added' || p.type === 'removed'), [processedLines]);
  // No changes if content exists, patch data exists, but no added/removed lines found after processing
  const noChangesFound = useMemo(() => hasMeaningfulContent && lineDiffPatch && !hasChanges, [hasMeaningfulContent, lineDiffPatch, hasChanges]);

  return (
    // Force full width and height
    <div className="w-full h-full min-h-full flex flex-col bg-gray-950 font-mono text-sm" style={{ minWidth: '100%' }}>
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 px-4 sm:px-6 py-3 border-b border-gray-800 text-gray-300 z-10 flex-shrink-0 w-full flex justify-between items-center">
        <div>{fileName || 'File Comparison'}</div>

        {versions.length > 1 && (
          <div className="flex items-center space-x-4">
            {/* Dropdowns remain the same */}
            <div className="flex items-center">
              <label htmlFor="compare-select" className="mr-2 text-xs text-gray-400">
                Compare:
              </label>
              <select
                id="compare-select"
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500 font-sans appearance-none cursor-pointer hover:bg-gray-750"
                value={selectedVersion || ''}
                onChange={(e) => onVersionChange('first', e.target.value)}
                style={{
                  WebkitAppearance: "none", MozAppearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156, 163, 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                  backgroundRepeat: "no-repeat", backgroundPosition: "right 0.5rem center", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem"
                }}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id} className="text-gray-300 bg-gray-800 font-sans">
                    {version.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <label htmlFor="with-select" className="mr-2 text-xs text-gray-400">
                With:
              </label>
              <select
                id="with-select"
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500 font-sans appearance-none cursor-pointer hover:bg-gray-750"
                value={secondSelectedVersion || ''}
                onChange={(e) => onVersionChange('second', e.target.value)}
                 style={{
                  WebkitAppearance: "none", MozAppearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156, 163, 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                  backgroundRepeat: "no-repeat", backgroundPosition: "right 0.5rem center", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem"
                }}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id} className="text-gray-300 bg-gray-800 font-sans">
                    {version.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Add a message if no differences were found */}
      {noChangesFound && (
         <div className="bg-green-800/20 p-4 border-l-4 border-green-600 text-green-200 m-4 flex-shrink-0 w-auto self-start">
           No differences found between the selected versions (based on structure).
         </div>
      )}

      {/* Render the processed lines */}
      {processedLines.length > 0 ? (
        <div className="flex-1 min-h-[calc(100%-60px)] overflow-y-auto w-full" style={{ minWidth: '100%' }}>
          {/* Use a container for lines */}
          <div className="p-4">
            {processedLines.map((line) => {
              // Define styles based on line type
              const lineStyles = {
                added: 'bg-green-900 bg-opacity-20 text-green-100',
                removed: 'bg-red-900 bg-opacity-20 text-red-100',
                context: 'text-gray-400',
              };
              const currentLineStyle = lineStyles[line.type];
              const linePrefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

              return (
                // Render each line as a block, preserving whitespace within
                <div
                  key={line.key}
                  className={`flex whitespace-pre-wrap break-all ${currentLineStyle}`}
                >
                  {/* Line Number */}
                  <span className="w-10 text-right pr-2 text-gray-500 select-none flex-shrink-0">{line.lineNumber || ''}</span>
                  {/* Line Prefix */}
                  <span className="w-4 pl-1 select-none flex-shrink-0">{linePrefix}</span>
                  {/* Line Content (now rendering ORIGINAL content) */}
                  <span className="flex-1 pl-2">
                    {renderLineContent(line, language)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
         /* Fallback if no data initially OR if there are no differences to show */
         !noChangesFound && ( // Only show loading if we haven't already determined there are no changes
            <div className="p-4 text-gray-600">Loading comparison or no content available...</div>
         )
      )}
    </div>
  );
};

export default DiffViewer;
