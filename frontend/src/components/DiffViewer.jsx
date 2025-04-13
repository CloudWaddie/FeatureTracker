// components/DiffViewer.jsx
import React, { useEffect, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Correct the import path for the style
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Note: If this path still fails, try 'react-syntax-highlighter/dist/cjs/styles/prism/vsc-dark-plus' or check your installed version's structure.

// Customize the style slightly for better integration
const customStyle = {
  ...vscDarkPlus,
  // Ensure the background is transparent to show the underlying diff color
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    backgroundColor: 'transparent',
    color: 'inherit', // Inherit color initially, syntax highlighting will override where needed
    textShadow: 'none', // Remove default text shadow if any
  },
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    backgroundColor: 'transparent',
    padding: '0', // Remove default padding from pre tag
    margin: '0', // Remove default margin
    overflow: 'visible', // Prevent scrollbars within the line
  }
};

const DiffViewer = ({
  fileName,
  diffContent,
  versions = [],
  onVersionChange,
  selectedVersion,
  secondSelectedVersion,
  language = 'plaintext' // Receive language prop, default to plaintext
}) => {
  const contextLines = 3; // Increase context slightly for better overview

  // Define allLines here so it's accessible by multiple useMemo hooks
  const allLines = useMemo(() => {
    if (!diffContent || typeof diffContent !== 'string') {
      return [];
    }
    const lines = diffContent.split('\n');
    // Handle potential trailing newline causing an empty string element
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines;
  }, [diffContent]);

  const processedLines = useMemo(() => {
    // Now use the pre-calculated allLines
    if (allLines.length === 0) {
      return [];
    }

    // 1. Identify change indices
    const changeIndices = allLines
      .map((line, index) => (line.startsWith('+') || line.startsWith('-') ? index : -1))
      .filter(index => index !== -1);

    // If no changes, return empty (message handled outside)
    if (changeIndices.length === 0) {
        // Check if there was actual content or just empty lines
        const hasMeaningfulContent = allLines.some(line => line.trim() !== '');
        if (hasMeaningfulContent) {
             // Indicate no changes were found, but let the outer component handle the message
             return [];
        } else {
            // If it was just empty lines or whitespace, treat as empty diff
            return [];
        }
    }


    // 2. Determine all indices to show (changes + context)
    const indicesToShow = new Set();
    changeIndices.forEach(changeIndex => {
      const start = Math.max(0, changeIndex - contextLines);
      const end = Math.min(allLines.length - 1, changeIndex + contextLines);
      for (let i = start; i <= end; i++) {
        indicesToShow.add(i);
      }
    });

    // 3. Build linesToShow array and add separators
    const linesToShow = [];
    let lastShownIndex = -1;

    for (let i = 0; i < allLines.length; i++) {
      if (indicesToShow.has(i)) {
        // This line should be shown
        const line = allLines[i];
        let lineType = 'context';
        let content = line;
        let keyPrefix = 'ctx'; // Default key prefix

        if (line.startsWith('+')) {
          lineType = 'added';
          content = line.substring(1);
          keyPrefix = 'add';
        } else if (line.startsWith('-')) {
          lineType = 'removed';
          content = line.substring(1);
          keyPrefix = 'rem';
        } else if (line.startsWith(' ')) {
          // Some diff formats add a space for context lines
          content = line.substring(1);
        }
        // else: context line without leading space

        linesToShow.push({
          type: lineType,
          content: content,
          originalLineNumber: i + 1, // Use original index + 1 for line number
          key: `${keyPrefix}-${i}` // Unique key based on type prefix and original index
        });
        lastShownIndex = i;
      } else {
        // This line is hidden. Check if we need a separator.
        // Add separator if the *previous* line was shown (lastShownIndex === i - 1)
        // and if this isn't the very first line (i > 0)
        // and if the last item added wasn't already a separator.
        if (lastShownIndex === i - 1 && i > 0) {
           if (!linesToShow.length || linesToShow[linesToShow.length - 1].type !== 'separator') {
               // Check ahead if there are more lines to be shown later
               let hasMoreLinesToShow = false;
               for (let j = i + 1; j < allLines.length; j++) {
                   if (indicesToShow.has(j)) {
                       hasMoreLinesToShow = true;
                       break;
                   }
               }
               // Only add separator if there are more lines to show after this gap
               if (hasMoreLinesToShow) {
                   linesToShow.push({ type: 'separator', key: `sep-${i}` });
               }
           }
        }
        // Update lastShownIndex only when a line is shown.
        // If a line is hidden, lastShownIndex remains the index of the last shown line.
      }
    }

    return linesToShow;
  // Update dependency array to include allLines
  }, [allLines, contextLines]);


  // Add debugging to see what's happening
  useEffect(() => {
    console.log('DiffViewer received content:', {
      type: typeof diffContent,
      length: diffContent?.length || 0,
      content: diffContent?.substring(0, 100) || 'empty'
    });
  }, [diffContent]);

  // Add a message if no differences were found but content exists
  // Use the pre-calculated allLines
  const hasMeaningfulContent = useMemo(() => allLines.some(line => line.trim() !== ''), [allLines]);
  // Update dependency array for noChangesFound
  const noChangesFound = useMemo(() => hasMeaningfulContent && processedLines.length === 0 && !processedLines.some(l => l.type === 'added' || l.type === 'removed'), [hasMeaningfulContent, processedLines]);

  const hasChanges = useMemo(() => processedLines.some(l => l.type === 'added' || l.type === 'removed'), [processedLines]);
  const hasOriginalContent = useMemo(() => diffContent && typeof diffContent === 'string' && diffContent.length > 0, [diffContent]);


  return (
    // Force full width and height with absolute sizing strategy
    <div className="w-full h-full min-h-full flex flex-col bg-gray-950 font-mono text-sm" style={{ minWidth: '100%' }}>
      {/* Header with file name and version dropdowns */}
      <div className="sticky top-0 bg-gray-900 px-4 sm:px-6 py-3 border-b border-gray-800 text-gray-300 z-10 flex-shrink-0 w-full flex justify-between items-center">
        <div>{fileName || 'File Comparison'}</div>
        
        {versions.length > 1 && (
          <div className="flex items-center space-x-4">
            {/* First dropdown - Compare */}
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
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156, 163, 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.5rem center",
                  backgroundSize: "1.5em 1.5em",
                  paddingRight: "2.5rem"
                }}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id} className="text-gray-300 bg-gray-800 font-sans">
                    {version.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Second dropdown - With */}
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
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156, 163, 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.5rem center",
                  backgroundSize: "1.5em 1.5em",
                  paddingRight: "2.5rem"
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
      
      {/* Add a warning if the original diff had no markers */}
      {diffContent && !hasChanges && (
        <div className="bg-yellow-800/20 p-2 border-l-4 border-yellow-600 text-yellow-200 mb-2 flex-shrink-0 w-full">
          Invalid diff format or identical files selected.
        </div>
      )}

      {/* Add a message if no differences were found */}
      {noChangesFound && (
         <div className="bg-green-800/20 p-4 border-l-4 border-green-600 text-green-200 m-4 flex-shrink-0 w-auto self-start">
           No differences found between the selected versions.
         </div>
      )}

      {/* Render the processed lines */}
      {processedLines.length > 0 && (
        <div className="flex-1 min-h-[calc(100%-60px)] overflow-y-auto w-full" style={{ minWidth: '100%' }}> {/* Removed padding here, add per line */}
          {processedLines.map((line) => {
            if (line.type === 'separator') {
              return (
                // Corrected: spans are now inside the div
                <div key={line.key} className="flex items-center bg-gray-800 h-6 px-4 w-full">
                  <span className="w-10 text-right text-gray-600 select-none flex-shrink-0 mr-2">...</span>
                  <span className="text-gray-600 select-none">...</span>
                </div>
              );
            }

            // Define styles based on line type
            const styles = {
              added: {
                bgColor: 'bg-green-600 bg-opacity-10',
                prefix: '+',
                prefixColor: 'text-green-500',
                lineNumColor: 'text-gray-600', // Dim line number for added
              },
              removed: {
                bgColor: 'bg-red-600 bg-opacity-10',
                prefix: '-',
                prefixColor: 'text-red-500',
                lineNumColor: 'text-gray-600', // Dim line number for removed
              },
              context: {
                bgColor: '', // No background for context
                prefix: ' ', // Space for alignment
                prefixColor: 'text-gray-600', // Dim prefix
                lineNumColor: 'text-gray-600', // Dim line number for context
              },
            };

            const currentStyle = styles[line.type];
            const lineContent = line.content || ' ';

            return (
              // Apply background color to the whole line container and make it full width
              <div key={line.key} className={`flex items-start ${currentStyle.bgColor} hover:bg-gray-700/50 w-full px-4`}> {/* Added px-4 */}
                 {/* Line number column */}
                 <span className={`w-10 text-right ${currentStyle.lineNumColor} select-none flex-shrink-0 mr-2 pt-px`}>
                   {line.originalLineNumber}
                 </span>
                {/* Diff symbol column */}
                <span className={`w-4 ${currentStyle.prefixColor} select-none flex-shrink-0 text-center pt-px`}> {/* Adjusted width */}
                  {currentStyle.prefix}
                </span>
                {/* Code content - Use SyntaxHighlighter */}
                <div className="flex-1 whitespace-pre-wrap break-words min-w-0 pl-2"> {/* Added pl-2 */}
                  <SyntaxHighlighter
                    language={language}
                    style={customStyle}
                    wrapLines={true}
                    lineProps={{style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}}
                    PreTag="div"
                    // Apply context text color if needed
                    CodeTag={({ children, ...props }) => <span {...props} className={`text-sm ${line.type === 'context' ? 'text-gray-400' : ''}`}>{children}</span>}
                  >
                    {lineContent}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          })}
        </div>
      )}
       {/* Fallback if diffContent is empty/invalid initially */}
       {!hasOriginalContent && (
         <div className="p-4 text-gray-600">Loading diff or no content available...</div>
       )}
    </div>
  );
};

export default DiffViewer;