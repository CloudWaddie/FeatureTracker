// components/DiffViewer.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react'; // Removed useCallback
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Revert back to FixedSizeList
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
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

// Helper function to render line content, now handling char diffs
const renderLineContent = (line, language) => {
  if (!line) return null;

  // If charDiff data exists, render character differences based on line type
  if (line.charDiff) {
    return (
      <span className="whitespace-pre-wrap break-all">
        {line.charDiff.map((part, index) => {
          let className = '';

          if (line.type === 'removed') {
            // Show removed and common parts on a removed line
            if (part.removed) {
              // Highlight removed characters with a darker red
              className = 'bg-red-600 bg-opacity-50'; // Darker red highlight
            } else if (!part.added) {
              // Style common characters slightly dimmed on removed lines
              className = 'opacity-70';
            } else {
              // Don't render added parts on a removed line
              return null;
            }
          } else if (line.type === 'added') {
            // Show added and common parts on an added line
            if (part.added) {
              // Highlight added characters with a darker green
              className = 'bg-green-600 bg-opacity-50'; // Darker green highlight
            } else if (!part.removed) {
              // Style common characters normally on added lines
              className = ''; // No extra style for common parts here
            } else {
              // Don't render removed parts on an added line
              return null;
            }
          }

          return (
            <span key={index} className={className}>
              {part.value}
            </span>
          );
        })}
      </span>
    );
  }

  // Otherwise, render the whole line with SyntaxHighlighter
  return (
    <SyntaxHighlighter
      language={language}
      style={customStyle}
      useInlineStyles={true}
      wrapLines={true}
      lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all', display: 'block' } }}
    >
      {line.content || ''}
    </SyntaxHighlighter>
  );
};

// Define the Row component logic
const RowComponent = ({ index, style, data }) => {
  const { lines, language } = data;
  const line = lines[index];

  if (!line) return null;

  const lineStyles = {
    added: 'bg-green-900 bg-opacity-20 text-green-100',
    removed: 'bg-red-900 bg-opacity-20 text-red-100',
    context: 'text-gray-400',
  };
  const currentLineStyle = lineStyles[line.type];
  const linePrefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  return (
    // Apply fixed height via style from react-window
    // Ensure internal content can wrap
    <div
      style={style}
      className={`flex whitespace-pre-wrap break-all ${currentLineStyle}`}
    >
       <span className="w-10 text-right pr-2 text-gray-500 select-none flex-shrink-0">{line.lineNumber || ''}</span>
       <span className="w-4 pl-1 select-none flex-shrink-0">{linePrefix}</span>
       {/* Ensure the content span allows wrapping and takes necessary space */}
       <span className="pl-2 overflow-hidden flex-grow">
          {renderLineContent(line, language)}
        </span>
      </div>
  );
};

// Use the component directly
const Row = RowComponent;

const DiffViewer = ({
  fileName,
  lineDiffPatch,
  originalContentA,
  originalContentB,
  versions = [],
  onVersionChange,
  selectedVersion,
  secondSelectedVersion,
  language = 'plaintext'
}) => {
  const [processedLines, setProcessedLines] = useState([]);
   const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const workerRef = useRef(null);
  const [summaryText, setSummaryText] = useState(''); // State for the summary
  const [summaryStatus, setSummaryStatus] = useState(''); // State for the status message (retrieved/generated)
  
  const handleSparkle = async () => {
    if (!lineDiffPatch) {
      setError("No diff available to summarize.");
      setSummaryText(''); // Clear previous summary
      setSummaryStatus('');
      return;
    }
    setIsLoading(true);
    setError(null); // Clear previous errors
    setSummaryText(''); // Clear previous summary while loading
    setSummaryStatus('');
    try {
      // Format the processed lines into a readable diff string
      const formattedDiff = processedLines.map(line => {
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        return `${prefix} ${line.content}`;
      }).join('\n');

      if (!formattedDiff) {
        setError("Could not generate diff content to send.");
        setIsLoading(false);
        return;
      }

      const query = "Can you please summarise any important changes seen in these files";
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diff: formattedDiff, // Send the formatted diff string
          query: query,
          fileName: fileName, // Pass fileName
          version1Id: selectedVersion, // Pass selectedVersion
          version2Id: secondSelectedVersion // Pass secondSelectedVersion
        })
      });

      const result = await response.json();

      if (!response.ok) {
        // Throw an error with the message from the backend if available
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      console.log("Gemini summary:", result.summary);

      // Set state with the summary and status message
      setSummaryText(result.summary);
      const statusMessage = result.message || (result.warning || 'Summary generated and saved.');
      setSummaryStatus(statusMessage);

    } catch (e) {
      console.error("Error calling Gemini API:", e);
      setError(`Failed to get summary: ${e.message}`);
      setSummaryText(''); // Clear summary on error
      setSummaryStatus('');
    } finally {
      setIsLoading(false);
    }
  };
   // Removed listRef and rowHeights refs

  // Effect for initializing and terminating the worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/diffWorker.js', import.meta.url));

    workerRef.current.onmessage = (event) => {
      const { status, processedLines: workerLines, error: workerError } = event.data;
      if (status === 'success') {
        setProcessedLines(workerLines);
        setError(null);
      } else {
        setError(workerError || 'Unknown worker error');
        setProcessedLines([]);
      }
      setIsLoading(false);
    };

    workerRef.current.onerror = (err) => {
      console.error("Worker error:", err);
      setError(`Worker error: ${err.message}`);
      setProcessedLines([]);
      setIsLoading(false);
    };

    return () => {
      console.log("Terminating worker");
      workerRef.current.terminate();
    };
  }, []);

  // Effect for sending data to the worker when inputs change
  useEffect(() => {
    // Removed cache clearing logic
    const postToWorker = (data) => {
      workerRef.current.postMessage(data);
    };

    if (lineDiffPatch && originalContentA && originalContentB && workerRef.current) {
      console.log("Posting data to worker...");
      setIsLoading(true);
      setError(null);
      setProcessedLines([]);
      postToWorker({ lineDiffPatch, originalContentA, originalContentB });
    } else if (!lineDiffPatch && originalContentB && workerRef.current) {
       console.log("Posting only original B to worker...");
       setIsLoading(true);
       setError(null);
       setProcessedLines([]);
       postToWorker({ lineDiffPatch: null, originalContentA: '', originalContentB });
    } else {
       // Reset if inputs are cleared
       setProcessedLines([]);
       setIsLoading(false);
       setError(null);
    }
  }, [lineDiffPatch, originalContentA, originalContentB]);

  // Removed height estimation useEffect

  // Memoize itemData
  const itemData = useMemo(() => ({ lines: processedLines, language: language }), [processedLines, language]);

  // Removed getItemSize callback

  // Update checks
  const hasMeaningfulContent = useMemo(() => originalContentA || originalContentB, [originalContentA, originalContentB]);
  const hasChanges = useMemo(() => processedLines.some(p => p.type === 'added' || p.type === 'removed'), [processedLines]);
  const noChangesFound = useMemo(() => {
      return hasMeaningfulContent && lineDiffPatch && !isLoading && !error && !hasChanges;
  }, [hasMeaningfulContent, lineDiffPatch, isLoading, error, hasChanges]);

  return (
    <div className="w-full h-full min-h-full flex flex-col bg-gray-950 font-mono text-sm" style={{ minWidth: '100%' }}>
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 px-4 sm:px-6 py-3 border-b border-gray-800 text-gray-300 z-10 flex-shrink-0 w-full flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div>{fileName || 'File Comparison'}</div>
          <button onClick={handleSparkle} className="p-1 text-xl text-yellow-400 hover:bg-gray-800 rounded">
            <span role="img" aria-label="sparkle">✨</span>
          </button>
        </div>
        {versions.length > 1 && (
<div className="flex items-center space-x-4">
            <div className="flex items-center">
              <label htmlFor="compare-select" className="mr-2 text-xs text-gray-400">Compare:</label>
              <select id="compare-select" className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500 font-sans appearance-none cursor-pointer hover:bg-gray-750" value={selectedVersion || ''} onChange={(e) => onVersionChange('first', e.target.value)} style={{ WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156, 163, 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.5rem center", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}>
                {versions.map((version) => (<option key={version.id} value={version.id} className="text-gray-300 bg-gray-800 font-sans">{version.label}</option>))}
              </select>
            </div>
            <div className="flex items-center">
              <label htmlFor="with-select" className="mr-2 text-xs text-gray-400">With:</label>
              <select id="with-select" className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded py-1 px-2 focus:ring-blue-500 focus:border-blue-500 font-sans appearance-none cursor-pointer hover:bg-gray-750" value={secondSelectedVersion || ''} onChange={(e) => onVersionChange('second', e.target.value)} style={{ WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(156, 163, 175)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.5rem center", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}>
                {versions.map((version) => (<option key={version.id} value={version.id} className="text-gray-300 bg-gray-800 font-sans">{version.label}</option>))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Summary Display Area */}
      {summaryText && (
        <div className="bg-gray-800 p-4 border-b border-gray-700 text-gray-300 text-sm font-sans">
          <h3 className="font-semibold mb-2 text-yellow-400">✨ AI Summary:</h3>
          <p className="whitespace-pre-wrap">{summaryText}</p>
          {summaryStatus && <p className="text-xs text-gray-500 mt-2">({summaryStatus})</p>}
        </div>
      )}

      {/* Conditional Rendering Area for Diff Content */}
      <div className="flex-1 min-h-0 w-full">
        {isLoading ? (
          <div className="p-4 text-yellow-400">Processing comparison in background...</div>
        ) : error ? (
          <div className="p-4 bg-red-900/50 text-red-200 border-l-4 border-red-600 m-4">Error processing diff: {error}</div>
        ) : noChangesFound ? (
           <div className="bg-green-800/20 p-4 border-l-4 border-green-600 text-green-200 m-4 flex-shrink-0 w-auto self-start">No differences found between the selected versions.</div>
         ) : processedLines.length > 0 ? (
           <AutoSizer>
             {({ height, width }) => (
              <List // Use FixedSizeList
                 // Removed ref
                 key={lineDiffPatch || 'no-patch'}
                 height={height}
                 itemCount={processedLines.length}
                 itemSize={60} // Increased fixed item size
                 width={width}
                 itemData={itemData}
                  itemKey={(index, data) => data.lines[index]?.key || index}
                  children={Row} // Pass Row as children prop
               />
              )}
            </AutoSizer>
         ) : (
          <div className="p-4 text-gray-600">Select versions to compare or no content available.</div>
        )}
      </div>
  </div>
  );
};

export default DiffViewer;
