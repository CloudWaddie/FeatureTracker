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
  const contextLines = 2; // Number of context lines to show around changes

  const processedLines = useMemo(() => {
    if (!diffContent || typeof diffContent !== 'string') {
      return [];
    }

    const allLines = diffContent.split('\n');
    const linesToShow = [];
    let lastAddedIndex = -1;

    allLines.forEach((line, index) => {
      if (line.startsWith('+') || line.startsWith('-')) {
        // Check for gap and add separator
        if (index > lastAddedIndex + 1 && lastAddedIndex !== -1) {
           // Avoid separator right at the beginning
           linesToShow.push({ type: 'separator', key: `sep-${index}` });
        }

        // Add preceding context lines
        const startContext = Math.max(0, index - contextLines);
        for (let i = startContext; i < index; i++) {
          if (i > lastAddedIndex) {
            linesToShow.push({
              type: 'context',
              content: allLines[i].startsWith(' ') ? allLines[i].substring(1) : allLines[i], // Handle potential leading space from basic diff
              originalLineNumber: i + 1,
              key: `ctx-${i}`
            });
            lastAddedIndex = i;
          }
        }

        // Add the changed line
        const lineType = line.startsWith('+') ? 'added' : 'removed';
        linesToShow.push({
          type: lineType,
          content: line.substring(1),
          originalLineNumber: index + 1, // Or adjust based on diff format logic if needed
          key: `${lineType}-${index}`
        });
        lastAddedIndex = index;

        // Add succeeding context lines (look ahead slightly)
        // Note: This simple lookahead adds context *after* each change.
        // A more complex approach might group consecutive changes first.
        const endContext = Math.min(allLines.length, index + 1 + contextLines);
         for (let i = index + 1; i < endContext; i++) {
           // Only add if it's not another change immediately following
           if (i > lastAddedIndex && !allLines[i].startsWith('+') && !allLines[i].startsWith('-')) {
             linesToShow.push({
               type: 'context',
               content: allLines[i].startsWith(' ') ? allLines[i].substring(1) : allLines[i], // Handle potential leading space
               originalLineNumber: i + 1,
               key: `ctx-${i}`
             });
             lastAddedIndex = i;
           }
         }
      }
    });

     // Handle case where there are no changes at all
     if (linesToShow.length === 0 && allLines.length > 0 && allLines.some(l => !l.startsWith('+') && !l.startsWith('-'))) {
        // If no changes were found but there was content, show a message or potentially all lines as context
        // For now, let's keep it empty and rely on the "No differences found" message logic below.
     }


    return linesToShow;
  }, [diffContent, contextLines]);


  // Add debugging to see what's happening
  useEffect(() => {
    console.log('DiffViewer received content:', {
      type: typeof diffContent,
      length: diffContent?.length || 0,
      content: diffContent?.substring(0, 100) || 'empty'
    });
  }, [diffContent]);

  const hasChanges = processedLines.some(l => l.type === 'added' || l.type === 'removed');
  const hasOriginalContent = diffContent && typeof diffContent === 'string' && diffContent.length > 0;


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
      {hasOriginalContent && !hasChanges && (
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