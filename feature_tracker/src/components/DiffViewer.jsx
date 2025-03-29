// components/DiffViewer.jsx
import React, { useEffect } from 'react';

const DiffViewer = ({ fileName, diffContent, versions = [], onVersionChange, selectedVersion, secondSelectedVersion }) => {
  // Check if we actually have content to avoid errors
  const lines = diffContent && typeof diffContent === 'string'
    ? diffContent.split('\n') 
    : ['No diff content available'];

  // Add debugging to see what's happening
  useEffect(() => {
    console.log('DiffViewer received content:', {
      type: typeof diffContent,
      length: diffContent?.length || 0,
      content: diffContent?.substring(0, 100) || 'empty'
    });
  }, [diffContent]);
  
  // If no diff markers are found, add a note
  const hasDiffMarkers = diffContent && (diffContent.includes('+') || diffContent.includes('-'));
  
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
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedVersion || ''}
                onChange={(e) => onVersionChange('first', e.target.value)}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
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
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                value={secondSelectedVersion || ''}
                onChange={(e) => onVersionChange('second', e.target.value)}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      
      {/* Add a warning if no diff markers were found */}
      {diffContent && !hasDiffMarkers && (
        <div className="bg-yellow-800/20 p-2 border-l-4 border-yellow-600 text-yellow-200 mb-2 flex-shrink-0 w-full">
          No differences found or invalid diff format.
        </div>
      )}
      
      {/* Make pre element take the full width and height, even with minimal content */}
      <pre className="p-4 whitespace-pre-wrap break-all flex-1 min-h-[calc(100%-60px)] overflow-y-auto w-full" style={{ minWidth: '100%' }}>
        {lines.map((line, index) => {
          let lineType = 'unchanged';
          let displayLine = line;
          if (line.startsWith('+')) {
            lineType = 'added';
            displayLine = line.substring(1); // Remove '+'
          } else if (line.startsWith('-')) {
            lineType = 'removed';
            displayLine = line.substring(1); // Remove '-'
          } else {
            // Keep the space for alignment if line starts with ' ' (from basic diff)
            displayLine = line.startsWith(' ') ? line.substring(1) : line;
          }

          // Define styles based on line type
          const styles = {
            added: {
              bgColor: 'bg-green-600 bg-opacity-10', // Softer green background
              textColor: 'text-green-400',
              prefix: '+',
              prefixColor: 'text-green-500',
            },
            removed: {
              bgColor: 'bg-red-600 bg-opacity-10', // Softer red background
              textColor: 'text-red-400',
              prefix: '-',
              prefixColor: 'text-red-500',
            },
            unchanged: {
              bgColor: '',
              textColor: 'text-gray-400', // Slightly dimmer unchanged text
              prefix: ' ',
              prefixColor: 'text-gray-600', // Dim prefix for unchanged
            },
          };

          const currentStyle = styles[lineType];

          return (
            // Apply background color to the whole line container and make it full width
            <div key={index} className={`flex items-start ${currentStyle.bgColor} hover:bg-gray-700/50 w-full`}>
              {/* Line number column - more padding, consistent width */}
              <span className="w-10 sm:w-12 px-2 text-right text-gray-600 select-none flex-shrink-0">
                {/* Show line numbers logically (could be improved for complex diffs) */}
                {lineType !== 'added' ? index + 1 : ''}
              </span>
              {/* Diff symbol column */}
              <span className={`px-2 ${currentStyle.prefixColor} select-none flex-shrink-0`}>
                {currentStyle.prefix}
              </span>
              {/* Code content - force it to take all remaining space */}
              <span className={`flex-1 ${currentStyle.textColor} whitespace-pre-wrap break-words pr-4`} style={{ minWidth: "calc(100% - 80px)" }}>
                {displayLine || ' '} {/* Render a space for empty lines to maintain height */}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default DiffViewer;