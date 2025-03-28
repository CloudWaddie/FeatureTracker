// components/DiffViewer.jsx
import React from 'react';

const DiffViewer = ({ fileName, diffContent }) => {
  const lines = diffContent.split('\n');

  return (
    // Use slightly lighter background, subtle border
    <div className="bg-gray-950 flex-1 overflow-auto font-mono text-sm border-l border-gray-800">
      {/* Refined header: padding, border, text */}
      <div className="sticky top-0 bg-gray-900 px-4 sm:px-6 py-3 border-b border-gray-800 text-gray-300 z-10">
        {fileName}
      </div>
      {/* Use whitespace-pre for better code formatting (allows horizontal scroll) */}
      <pre className="px-1 py-4 text-xs leading-relaxed"> {/* Smaller text, adjust padding */}
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
            // Apply background color to the whole line container
            <div key={index} className={`flex items-start ${currentStyle.bgColor} hover:bg-gray-700/50`}> {/* Add subtle hover */}
              {/* Line number column - more padding, consistent width */}
              <span className="w-10 sm:w-12 px-2 text-right text-gray-600 select-none flex-shrink-0">
                {/* Show line numbers logically (could be improved for complex diffs) */}
                {lineType !== 'added' ? index + 1 : ''}
              </span>
              {/* Diff symbol column */}
              <span className={`px-2 ${currentStyle.prefixColor} select-none flex-shrink-0`}>
                  {currentStyle.prefix}
              </span>
              {/* Code content - allow wrapping within the line */}
              <span className={`flex-1 ${currentStyle.textColor} whitespace-pre-wrap break-words pr-4`}>
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