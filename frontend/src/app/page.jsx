// src/app/page.jsx
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSupabase } from './supabase-provider'; // Corrected path
import FileExplorer from '@/components/FileExplorer';
import TabsBar from '@/components/TabsBar';
import DiffViewer from '@/components/DiffViewer';
// Import comparison and fetch functions
import { compareSupabaseFiles, fetchSupabaseFileContent } from '@/lib/data';

// --- Copied Helper Functions from FileExplorer ---
const VERSION_REGEX = /^(.+)-v(\d+)\.(.+)$/;

function extractOriginalFilename(supabaseFullName) {
  let processedName = supabaseFullName;
  if (processedName.endsWith('.txt')) {
    processedName = processedName.slice(0, -4);
  }
  const versionMatch = processedName.match(VERSION_REGEX);
  if (versionMatch) {
    const [, basePath, , extension] = versionMatch;
    const pathParts = basePath.split('_');
    return pathParts[pathParts.length - 1] + '.' + extension;
  } else {
    const pathParts = processedName.split('_');
    return pathParts.length > 1 ? pathParts[pathParts.length - 1] : processedName;
  }
}

function getLanguageFromFileName(displayFileName) {
    if (!displayFileName) return 'plaintext';
    if (displayFileName.toLowerCase() === 'dockerfile') return 'dockerfile';
    const parts = displayFileName.split('.');
    if (parts.length > 1) {
        const extension = parts.pop()?.toLowerCase();
        switch (extension) {
            case 'js': case 'mjs': case 'cjs': return 'javascript';
            case 'jsx': return 'jsx';
            case 'ts': return 'typescript';
            case 'tsx': return 'tsx';
            case 'py': return 'python';
            case 'css': return 'css';
            case 'html': return 'html';
            case 'json': return 'json';
            case 'md': return 'markdown';
            case 'java': return 'java';
            case 'c': case 'h': return 'c';
            case 'cpp': case 'hpp': return 'cpp';
            case 'cs': return 'csharp';
            case 'go': return 'go';
            case 'php': return 'php';
            case 'rb': return 'ruby';
            case 'swift': return 'swift';
            case 'kt': return 'kotlin';
            case 'rs': return 'rust';
            case 'sql': return 'sql';
            case 'sh': case 'bash': return 'bash';
            case 'yaml': case 'yml': return 'yaml';
            case 'xml': return 'xml';
            default: break;
        }
    }
    console.warn(`Assuming 'javascript' for file "${displayFileName}" due to missing or unknown extension.`);
    return 'javascript'; // Default assumption
}

const formatVersionDate = (versionNumber) => {
    if (!versionNumber) return 'Unknown';
    const versionStr = versionNumber.toString();
    if (versionStr.length >= 8) {
        const year = versionStr.substring(0, 4);
        const month = versionStr.substring(4, 6);
        const day = versionStr.substring(6, 8);
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return versionStr;
};
// --- End Helper Functions ---


export default function Home() {
  const supabase = useSupabase();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null); // Store ID instead of full object

  // State for file system
  const [fileSystem, setFileSystem] = useState([]);
  const [supabaseFilesData, setSupabaseFilesData] = useState([]); // Raw list from Supabase

  // State for comparison view
  const [comparisonData, setComparisonData] = useState({
    lineDiffPatch: null,
    originalA: '',
    originalB: '',
  });
  const [availableVersions, setAvailableVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [secondSelectedVersionId, setSecondSelectedVersionId] = useState(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('plaintext');

  // --- File Fetching and Tree Building Logic ---
  const buildFileTree = useCallback((files = supabaseFilesData) => {
    const root = { id: 'root', name: 'Root', type: 'folder', children: [] };
    const lookup = {};
    const fileGroups = {};

    if (!files || files.length === 0) return root.children;

    const filteredFiles = files.filter(file => !file.name.endsWith('.emptyFolderPlaceholder'));

    filteredFiles.forEach(file => {
      const pathParts = file.name.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const dirPath = pathParts.slice(0, -1).join('/');
      const versionMatch = fileName.match(VERSION_REGEX);

      let baseFileName, fullPath, displayName;
      let versionNumber = 0;

      if (versionMatch) {
        const [, baseNamePart, versionNumStr, extension] = versionMatch;
        baseFileName = `${baseNamePart}.${extension}`;
        versionNumber = parseInt(versionNumStr);
        displayName = extractOriginalFilename(baseFileName); // Get clean name from base
      } else {
        baseFileName = fileName;
        displayName = extractOriginalFilename(fileName); // Get clean name
      }
      fullPath = dirPath ? `${dirPath}/${baseFileName}` : baseFileName; // Group by base path

      if (!fileGroups[fullPath]) fileGroups[fullPath] = [];
      fileGroups[fullPath].push({ ...file, versionNumber, baseFileName, displayName });
    });

    const filesToShow = Object.values(fileGroups).map(group => {
      return [...group].sort((a, b) => b.versionNumber - a.versionNumber)[0]; // Newest
    });

    filesToShow.forEach(file => {
      const pathParts = file.name.split('/'); // Use original path for tree structure
      let currentParent = root;
      let currentPath = '';

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        currentPath += (currentPath ? '/' : '') + part;
        if (!lookup[currentPath]) {
          const newItem = { id: currentPath, name: part, type: 'folder', children: [], path: currentPath, fileData: null };
          lookup[currentPath] = newItem;
          currentParent.children.push(newItem);
        }
        currentParent = lookup[currentPath];
      }

      const filePart = pathParts[pathParts.length - 1];
      currentPath += (currentPath ? '/' : '') + filePart;
      if (!lookup[currentPath]) {
        const newItem = {
          id: currentPath, // Use full path as unique ID
          name: file.displayName, // Display clean name
          type: 'file',
          children: null,
          path: currentPath,
          fileData: file, // Store original Supabase file data
          originalName: filePart, // Store original name with version suffix
          displayName: file.displayName
        };
        lookup[currentPath] = newItem;
        currentParent.children.push(newItem);
      }
    });
    return root.children;
  }, [supabaseFilesData]); // Depends on the raw file list

  const fetchFiles = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage.from('gemini-files').list();
      if (error) throw error;
      const filteredData = data.filter(file => file.name !== '.emptyFolderPlaceholder');
      setSupabaseFilesData(filteredData);
      // Build tree immediately after fetching
      const tree = buildFileTree(filteredData);
      // Don't build tree here, just set the raw data
      // const tree = buildFileTree(filteredData);
      // setFileSystem(tree);
    } catch (error) {
      console.error('Error fetching files:', error);
      setSupabaseFilesData([]); // Reset raw data on error
    }
  }, [supabase]); // Remove buildFileTree dependency

  // useEffect for building the tree whenever raw data changes
  useEffect(() => {
    console.log("Building file tree from supabaseFilesData change...");
    const tree = buildFileTree(supabaseFilesData);
    setFileSystem(tree);
  }, [supabaseFilesData, buildFileTree]); // Depends on raw data and the build function

  // useEffect for fetching files periodically
  useEffect(() => {
    // Fetch files immediately on mount
    fetchFiles();

    // Set up interval to fetch files every minute
    console.log("Setting up file fetch interval (1 min)");
    const intervalId = setInterval(fetchFiles, 60 * 1000); // 60000 ms = 1 minute

    // Cleanup function to clear the interval when the component unmounts
    return () => {
      console.log("Clearing file fetch interval");
      clearInterval(intervalId);
    };
  }, [fetchFiles]); // Dependency array *only* includes fetchFiles
  // --- End File Fetching ---

  // Find the active tab object based on activeTabId
  const activeTab = useMemo(() => {
      return tabs.find(tab => tab.id === activeTabId);
  }, [tabs, activeTabId]);

  // --- Comparison Logic ---
  const runComparison = useCallback(async (fileAPath, fileBPath, lang) => {
    setIsLoadingComparison(true);
    setComparisonError(null);
    setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '' }); // Clear previous
    try {
      const result = await compareSupabaseFiles('gemini-files', fileAPath, fileBPath, lang);
      if (result) {
        setComparisonData({
          lineDiffPatch: result.lineDiffPatch,
          originalA: result.originalA,
          originalB: result.originalB,
        });
      } else {
        setComparisonError('Comparison failed. Could not retrieve file data.');
      }
    } catch (err) {
      console.error("Error running comparison:", err);
      setComparisonError(`Comparison failed: ${err.message}`);
    } finally {
      setIsLoadingComparison(false);
    }
  }, []); // compareSupabaseFiles is stable

  // --- Tab Management and File Opening ---
  const handleOpenFile = useCallback(async (selectedFileItem) => {
    if (!selectedFileItem || selectedFileItem.type !== 'file') return;

    const tabId = selectedFileItem.id; // Use unique path as ID
    const displayName = selectedFileItem.displayName;
    const language = getLanguageFromFileName(displayName);
    setCurrentLanguage(language); // Set language for DiffViewer

    // Check if tab exists
    const existingTabIndex = tabs.findIndex(tab => tab.id === tabId);

    if (existingTabIndex === -1) {
      // Add new tab (initially without comparison data)
      const newTab = {
        id: tabId,
        name: displayName,
        path: selectedFileItem.path, // Store path for potential future use
        fileData: selectedFileItem.fileData, // Store original file data
        originalName: selectedFileItem.originalName, // Store name with version
      };
      setTabs(prevTabs => [...prevTabs, newTab]);
    }

    // Activate the tab
    setActiveTabId(tabId);

    // --- Trigger Comparison Logic ---
    setAvailableVersions([]); // Reset versions
    setSelectedVersionId(null);
    setSecondSelectedVersionId(null);
    setIsLoadingComparison(true); // Set loading
    setComparisonError(null);
    setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '' }); // Clear previous diff

    const currentFilePath = selectedFileItem.fileData?.name || selectedFileItem.path;
    const currentFileName = selectedFileItem.originalName || selectedFileItem.name;
    const versionMatch = currentFileName.match(VERSION_REGEX);

    let fileToCompareA = null;
    let fileToCompareB = currentFilePath; // Current file is usually B (newer)

    if (versionMatch) { // It's a versioned file
        const [, baseNamePart, , extension] = versionMatch;
        const baseFileName = `${baseNamePart}.${extension}`;

        // Find all related files (base + versions)
        const allRelatedFiles = supabaseFilesData
            .filter(f => {
                const fName = f.name.split('/').pop();
                const fMatch = fName.match(VERSION_REGEX);
                if (fMatch) { // Is versioned
                    return fMatch[1] === baseNamePart && fMatch[3] === extension;
                } else { // Is base
                    return fName === baseFileName;
                }
            })
            .map(f => ({
                ...f,
                versionNumber: (f.name.match(VERSION_REGEX)?.[2] ? parseInt(f.name.match(VERSION_REGEX)[2]) : 0),
                path: f.name // Ensure path is included
            }))
            .sort((a, b) => b.versionNumber - a.versionNumber); // Newest first

        if (allRelatedFiles.length > 1) {
            const versionOptions = allRelatedFiles.map((v, index) => ({
                id: v.path,
                version: v.versionNumber,
                label: `${index === 0 ? 'Latest ' : ''}(${formatVersionDate(v.versionNumber)})`,
                path: v.path
            }));
            setAvailableVersions(versionOptions);

            const currentIndex = allRelatedFiles.findIndex(v => v.path === currentFilePath);

            if (currentIndex === 0) { // Newest selected, compare with previous
                fileToCompareA = allRelatedFiles[1].path;
            } else if (currentIndex > 0) { // Older selected, compare with next newer
                fileToCompareA = currentFilePath; // Older is A
                fileToCompareB = allRelatedFiles[currentIndex - 1].path; // Newer is B
            } else { // Should not happen if file is in list, fallback
                fileToCompareA = allRelatedFiles[1].path;
                fileToCompareB = allRelatedFiles[0].path;
            }
            setSelectedVersionId(fileToCompareA);
            setSecondSelectedVersionId(fileToCompareB);
            await runComparison(fileToCompareA, fileToCompareB, language);
        } else {
            setComparisonError('Only one version found. Cannot compare.');
            setIsLoadingComparison(false);
            // Fetch and display single file content
             try {
                const content = await fetchSupabaseFileContent('gemini-files', currentFilePath);
                setComparisonData({ lineDiffPatch: null, originalA: content || '', originalB: content || '' });
            } catch (e) { setComparisonError('Failed to load file content.'); }
        }

    } else { // It's a base file (no version suffix)
        const parts = currentFileName.split('.');
        const fileExtension = parts.pop();
        const baseFileNamePart = parts.join('.');
        const versionRegexForBase = new RegExp(`^(${baseFileNamePart})-v(\\d+)\\.(${fileExtension})`);

        const versionedFiles = supabaseFilesData
            .filter(f => versionRegexForBase.test(f.name.split('/').pop()))
            .map(f => ({
                ...f,
                versionNumber: parseInt(f.name.match(versionRegexForBase)[2]),
                path: f.name
            }))
            .sort((a, b) => b.versionNumber - a.versionNumber); // Newest first

        if (versionedFiles.length > 0) {
             const versionOptions = versionedFiles.map((v, index) => ({
                id: v.path,
                version: v.versionNumber,
                label: `${index === 0 ? 'Latest ' : ''}(${formatVersionDate(v.versionNumber)})`,
                path: v.path
            }));
             // Add the base file itself to the dropdown options
             versionOptions.push({ id: currentFilePath, version: 0, label: 'Base File', path: currentFilePath });
             versionOptions.sort((a, b) => b.version - a.version); // Re-sort with base file
             setAvailableVersions(versionOptions);

            fileToCompareA = currentFilePath; // Base is A
            fileToCompareB = versionedFiles[0].path; // Newest version is B
            setSelectedVersionId(fileToCompareA);
            setSecondSelectedVersionId(fileToCompareB);
            await runComparison(fileToCompareA, fileToCompareB, language);
        } else {
            setComparisonError('No other versions found to compare with the base file.');
            setIsLoadingComparison(false);
             // Fetch and display single file content
             try {
                const content = await fetchSupabaseFileContent('gemini-files', currentFilePath);
                setComparisonData({ lineDiffPatch: null, originalA: content || '', originalB: content || '' });
            } catch (e) { setComparisonError('Failed to load file content.'); }
        }
    }

  }, [tabs, supabaseFilesData, runComparison]); // Added dependencies

  // Removed duplicate handleCloseTab definition

  const handleCloseTab = useCallback((tabId) => {
    setTabs((prevTabs) => {
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs; // Should not happen

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);

      // Adjust active tab if the closed tab was active
      if (activeTabId === tabId) {
        if (newTabs.length === 0) {
          setActiveTabId(null); // No tabs left
          // Clear comparison data as well
          setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '' });
          setAvailableVersions([]);
          setSelectedVersionId(null);
          setSecondSelectedVersionId(null);
          setComparisonError(null);
        } else {
          // Activate the previous tab, or the first tab if the closed one was first
          const newActiveIndex = Math.max(0, tabIndex - 1);
          // Trigger handleOpenFile for the new active tab to load its comparison
          handleOpenFile(newTabs[newActiveIndex]); // Pass the file item metadata
        }
      }
      return newTabs;
    });
  }, [activeTabId, handleOpenFile]); // Added handleOpenFile dependency

  const handleTabClick = useCallback((tab) => {
    // setActiveTabId(tab.id); // This would just switch view, but we need to re-trigger comparison
    handleOpenFile(tab); // Re-use handleOpenFile to load comparison for the clicked tab
  }, [handleOpenFile]); // Depends on handleOpenFile

  // Handler for version changes from DiffViewer dropdowns
  const handleVersionChange = useCallback(async (dropdown, versionPathId) => {
      let firstId = selectedVersionId;
      let secondId = secondSelectedVersionId;

      if (dropdown === 'first') {
          firstId = versionPathId;
          setSelectedVersionId(firstId);
      } else {
          secondId = versionPathId;
          setSecondSelectedVersionId(secondId);
      }

      if (firstId && secondId) {
          await runComparison(firstId, secondId, currentLanguage);
      }
  }, [selectedVersionId, secondSelectedVersionId, currentLanguage, runComparison]);


  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* File Explorer Pane */}
      <div className="w-64 border-r border-gray-700 overflow-y-auto">
        {/* Pass the actual fileSystem tree, not mock data */}
        <FileExplorer fileSystem={fileSystem} onFileSelect={handleOpenFile} />
      </div>

      {/* Editor Pane */}
      <div className="flex-1 flex flex-col">
        {/* Tabs Bar */}
        <TabsBar
          tabs={tabs}
          activeTab={activeTab} // Pass the derived activeTab object
          onTabClick={handleTabClick}
          onTabClose={handleCloseTab}
        />

        {/* Content Area - Now uses DiffViewer */}
        <div className="flex-1 flex flex-col min-h-0 bg-gray-850"> {/* Ensure flex column and min-height */}
          {activeTabId && (isLoadingComparison || comparisonError || comparisonData.lineDiffPatch !== null || (comparisonData.originalA && !comparisonData.lineDiffPatch)) ? ( // Check if there's something to display
             isLoadingComparison ? (
                 <div className="p-4 text-gray-500">Loading comparison...</div>
             ) : comparisonError ? (
                 <div className="p-4 text-red-400">{comparisonError}</div>
             ) : (
                // Render DiffViewer only when data is ready or if it's a single file view
                <DiffViewer
                  key={activeTabId + '-' + selectedVersionId + '-' + secondSelectedVersionId} // Key to force re-render on tab/version change
                  lineDiffPatch={comparisonData.lineDiffPatch} // Pass the patch string
                  originalContentA={comparisonData.originalA}
                  originalContentB={comparisonData.originalB}
                  fileName={activeTab?.name || ''}
                  versions={availableVersions}
                  selectedVersion={selectedVersionId}
                  secondSelectedVersion={secondSelectedVersionId}
                  onVersionChange={handleVersionChange}
                  language={currentLanguage}
                />
             )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a file to open
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
