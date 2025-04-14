'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer';
import { useSupabase } from '../app/supabase-provider';
import { compareSupabaseFiles } from '@/lib/data';

// Regex to identify versioned files (e.g., name-v20230101.ext or name-v2023010110.ext)
// It captures: 1. Base name, 2. Version digits, 3. Original extension
const VERSION_REGEX = /^(.+)-v(\d+)\.(.+)$/;

// Utility function to extract the original filename from a Supabase storage filename
function extractOriginalFilename(supabaseFullName) {
  // 1. Remove the trailing .txt extension added during upload
  let processedName = supabaseFullName;
  if (processedName.endsWith('.txt')) {
    processedName = processedName.slice(0, -4);
  }

  // 2. Check if it's a versioned file using the standard pattern
  const versionMatch = processedName.match(VERSION_REGEX);

  if (versionMatch) {
    // It's a versioned file (e.g., base-v123.js)
    const [, basePath, , extension] = versionMatch;

    // 3. Handle potential URL-like encoding in the base path (e.g., https_example_com_file)
    // This assumes the actual filename is the last part after splitting by '_'
    // Limitation: This might not work correctly if the original filename contained underscores.
    const pathParts = basePath.split('_');
    return pathParts[pathParts.length - 1] + '.' + extension;
  } else {
    // It's not a versioned file (e.g., http_example_com_file.js or just file.js)
    // Still attempt to handle URL-like encoding.
    const pathParts = processedName.split('_');
    // If splitting by '_' gives parts, assume last part is filename, otherwise use the whole name.
    // This handles simple names like 'file.js' correctly.
    return pathParts.length > 1 ? pathParts[pathParts.length - 1] : processedName;
  }
}

// Function to get language from a display filename (already processed by extractOriginalFilename)
function getLanguageFromFileName(displayFileName) {
  if (!displayFileName) return 'plaintext';

  // Check for known extensionless files first
  if (displayFileName.toLowerCase() === 'dockerfile') {
    return 'dockerfile';
  }
  // Add other known extensionless files here if needed
  // if (displayFileName === 'Makefile') return 'makefile';

  const parts = displayFileName.split('.');
  // Check if there is an extension (more than one part)
  if (parts.length > 1) {
    const extension = parts.pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'jsx':
        return 'jsx';
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'tsx';
      case 'py':
        return 'python';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'java':
        return 'java';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'hpp':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'go':
        return 'go';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
        return 'kotlin';
      case 'rs':
        return 'rust';
      case 'sql':
        return 'sql';
      case 'sh':
      case 'bash':
        return 'bash';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'xml':
        return 'xml';
      // Add more mappings as needed
      default:
        // If extension is unknown, fall through to the logic below
        break;
    }
  }

  // If no extension or unknown extension, assume JavaScript as per user context
  // This is a heuristic based on the user's specific case.
  // Consider adding more checks or configuration if other extensionless types are common.
  console.warn(`Assuming 'javascript' for file "${displayFileName}" due to missing or unknown extension.`);
  return 'javascript';

  // Original fallback if the assumption is too broad:
  // return 'plaintext';
}

const FileExplorer = () => {
  const [fileSystem, setFileSystem] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  // Update comparisonData state to use lineDiffPatch
  const [comparisonData, setComparisonData] = useState({
    lineDiffPatch: null, // Changed from charDiffResult, initialize as null
    originalA: '',
    originalB: '',
    isLoading: false, // Add loading state
    error: null, // Add error state
  });
  const [supabaseFilesData, setSupabaseFilesData] = useState([]); // Store the raw data from Supabase
  const [availableVersions, setAvailableVersions] = useState([]); // Available versions for comparison
  const [selectedVersionId, setSelectedVersionId] = useState(null); // First selected version for comparison
  const [secondSelectedVersionId, setSecondSelectedVersionId] = useState(null); // Second selected version for comparison
  const [selectedFileLanguage, setSelectedFileLanguage] = useState('plaintext');
  const supabase = useSupabase();

  // Format date from version number (YYYYMMDD format)
  const formatVersionDate = (versionNumber) => {
    if (!versionNumber) return 'Unknown';

    const versionStr = versionNumber.toString();
    // Check if we have at least 8 digits for YYYYMMDD
    if (versionStr.length >= 8) {
      const year = versionStr.substring(0, 4);
      const month = versionStr.substring(4, 6);
      const day = versionStr.substring(6, 8);

      // Create date object
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      // Format date
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    return versionStr; // Return as is if can't parse
  };

  const fetchFiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .storage
        .from('gemini-files')
        .list();

      if (error) {
        console.error('Error fetching files from Supabase:', error);
        return;
      }

      // Filter out .emptyFolderPlaceholder files that Supabase creates
      const filteredData = data.filter(file => file.name !== '.emptyFolderPlaceholder');
      console.log('Filtered Supabase Data:', filteredData);

      setSupabaseFilesData(filteredData);
      const transformedFileSystem = buildFileTree(filteredData);
      setFileSystem(transformedFileSystem);
    } catch (error) {
      console.error('An unexpected error occurred while fetching files:', error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const buildFileTree = (files = supabaseFilesData) => {
    const root = { id: 'root', name: 'Root', type: 'folder', children: [] };
    const lookup = {};

    // First, group files by their base name (without version suffix)
    const fileGroups = {};

    // Ensure we have files to process and filter out .emptyFolderPlaceholder
    if (!files || files.length === 0) {
      return root.children;
    }

    // Filter out .emptyFolderPlaceholder files
    const filteredFiles = files.filter(file => !file.name.endsWith('.emptyFolderPlaceholder'));

    filteredFiles.forEach(file => {
      const pathParts = file.name.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const dirPath = pathParts.slice(0, -1).join('/');

      // Check if it's a versioned file (name-v20230101.ext format)
      const versionMatch = fileName.match(VERSION_REGEX);

      if (versionMatch) {
        // It's a versioned file
        const [, baseName, versionNumber, extension] = versionMatch;
        // Use the original base filename for grouping to handle future versions
        const baseFileName = `${baseName}.${extension}`;
        const fullPath = dirPath ? `${dirPath}/${baseFileName}` : baseFileName;

        // Extract the display name (just the actual filename part)
        const displayName = extractOriginalFilename(baseFileName);

        if (!fileGroups[fullPath]) {
          fileGroups[fullPath] = [];
        }

        fileGroups[fullPath].push({
          ...file,
          versionNumber: parseInt(versionNumber),
          baseFileName: baseFileName,
          displayName: displayName // Use cleaned display name
        });
      } else {
        // It's a base file (no version)
        const fullPath = dirPath ? `${dirPath}/${fileName}` : fileName;

        // Extract the display name for non-versioned files too
        const displayName = extractOriginalFilename(fileName);

        if (!fileGroups[fullPath]) {
          fileGroups[fullPath] = [];
        }

        fileGroups[fullPath].push({
          ...file,
          versionNumber: 0,
          baseFileName: fileName,
          displayName: displayName // Use cleaned display name
        });
      }
    });

    // For each group, find the file with the highest version number
    const filesToShow = Object.values(fileGroups).map(group => {
      // Sort all versions with newest first
      const sortedVersions = [...group].sort((a, b) => b.versionNumber - a.versionNumber);
      return sortedVersions[0]; // Return the newest version
    });

    // Now build the tree with only the latest version of each file
    filesToShow.forEach(file => {
      const pathParts = file.name.split('/');
      let currentParent = root;
      let currentPath = '';

      // Process all directory parts normally
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        currentPath += (currentPath ? '/' : '') + part;
        const id = currentPath;

        if (!lookup[id]) {
          // Create new folder node
          const newItem = {
            id: id,
            name: part,
            type: 'folder',
            children: [],
            path: currentPath,
            fileData: null
          };
          lookup[id] = newItem;
          currentParent.children.push(newItem);
        }
        currentParent = lookup[id];
      }

      // Handle the file part specially with display name
      const filePart = pathParts[pathParts.length - 1];
      currentPath += (currentPath ? '/' : '') + filePart;
      const id = currentPath;

      if (!lookup[id]) {
        // Create new file node with display name
        const newItem = {
          id: id,
          name: file.displayName || extractOriginalFilename(filePart), // Use clean display name
          type: 'file',
          children: null,
          path: currentPath,
          // Store both the original name with version and the display name
          fileData: file,
          originalName: filePart,
          displayName: file.displayName || extractOriginalFilename(filePart)
        };
        lookup[id] = newItem;
        currentParent.children.push(newItem);
      }
    });

    return root.children;
  };

  const handleFileSelect = useCallback(async (selectedFileItem) => {
    setSelectedFile(selectedFileItem);
    setAvailableVersions([]); // Reset versions when selecting a new file
    setSelectedVersionId(null);
    setSecondSelectedVersionId(null);
    // Reset comparison data and set loading state
    setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '', isLoading: true, error: null });
    setSelectedFileLanguage('plaintext'); // Reset language

    if (selectedFileItem && selectedFileItem.type === 'file') {
      // Determine language based on display name
      const language = getLanguageFromFileName(selectedFileItem.displayName || selectedFileItem.name);
      setSelectedFileLanguage(language); // Store detected language
      console.log(`Detected language: ${language} for file: ${selectedFileItem.displayName || selectedFileItem.name}`);

      // Get the actual file path from the fileData if it exists, otherwise use the path property
      const currentFilePath = selectedFileItem.fileData?.name || selectedFileItem.path;
      // Use the original name with version for comparison logic, but display name for UI
      const currentFileName = selectedFileItem.originalName || selectedFileItem.fileData?.originalName || selectedFileItem.name;

      console.log('Selected file details:', {
        displayName: selectedFileItem.displayName || selectedFileItem.name,
        originalName: currentFileName,
        path: currentFilePath,
        fileData: selectedFileItem.fileData ? 'exists' : 'missing'
      });

      // More robust version pattern detection with explicit regex for better debugging
      const versionRegex = VERSION_REGEX;
      const versionMatch = currentFileName.match(versionRegex);

      // --- Logic inside version handling ---
      const performComparison = async (fileAPath, fileBPath) => {
        console.log(`Performing comparison between: ${fileAPath} and ${fileBPath} with language ${language}`);
        // Set loading state before async call
        setComparisonData(prev => ({ ...prev, isLoading: true, error: null }));
        try {
          const result = await compareSupabaseFiles(
            'gemini-files',
            fileAPath,
            fileBPath,
            language // Pass the detected language for normalization
            // contextLines parameter is optional, defaults to 3 in compareSupabaseFiles
          );
          if (result) {
            // Update state with the correct structure (lineDiffPatch)
            setComparisonData({
              lineDiffPatch: result.lineDiffPatch,
              originalA: result.originalA,
              originalB: result.originalB,
              isLoading: false,
              error: null
            });
          } else {
            // Handle comparison error
            setComparisonData({
              lineDiffPatch: null,
              originalA: '',
              originalB: '',
              isLoading: false,
              error: 'Error during comparison.'
            });
          }
        } catch (err) {
          console.error("Error in performComparison:", err);
          setComparisonData({
            lineDiffPatch: null,
            originalA: '',
            originalB: '',
            isLoading: false,
            error: `Comparison failed: ${err.message}`
          });
        }
        // Set selected versions after comparison attempt
        setSelectedVersionId(fileAPath); // Assuming A is first dropdown
        setSecondSelectedVersionId(fileBPath); // Assuming B is second dropdown
      };

      if (versionMatch) {
        // It's a versioned file
        const baseName = versionMatch[1];
        const versionNumber = parseInt(versionMatch[2]);
        const extension = versionMatch[3];
        const baseFileName = baseName;
        const fileExtension = extension;

        console.log('Parsed version details:', {
          baseName,
          versionNumber,
          extension,
          pattern: versionRegex.toString()
        });

        // Find ALL files that could be versions of this file
        let allVersions = [];

        // First look for the base file without version
        const baseFile = supabaseFilesData.find(file => {
          const name = file.name.split('/').pop();
          return name === `${baseFileName}.${fileExtension}`;
        });

        if (baseFile) {
          console.log('Found base file:', baseFile.name);
          allVersions.push({
            file: baseFile,
            version: 0,
            path: baseFile.name
          });
        }

        // Then find all versioned files
        supabaseFilesData.forEach(file => {
          const fileName = file.name.split('/').pop();
          const match = fileName.match(versionRegex);

          if (match) {
            const thisBaseName = match[1];
            const thisVersion = parseInt(match[2]);
            const thisExtension = match[3];

            if (thisBaseName === baseFileName && thisExtension === fileExtension) {
              console.log('Found matching version:', fileName, 'Version:', thisVersion);
              allVersions.push({
                file,
                version: thisVersion,
                path: file.name
              });
            }
          }
        });

        console.log('All matching versions found:', allVersions.length);

        if (allVersions.length > 1) { // Need at least 2 versions to compare
          // Sort versions with newest first
          allVersions.sort((a, b) => b.version - a.version);

          console.log('Sorted versions:', allVersions.map(v => ({
            path: v.path,
            version: v.version
          })));

          // Prepare version options for dropdown
          const versionOptions = allVersions.map((v, index) => {
            let label;
            if (index === 0) {
              // Latest version
              label = `Latest (${formatVersionDate(v.version)})`;
            } else {
              // Older versions with date
              label = formatVersionDate(v.version);
            }

            return {
              id: v.path,
              version: v.version,
              label,
              path: v.path
            };
          });

          setAvailableVersions(versionOptions);

          // Get the index of the current version
          const currentIndex = allVersions.findIndex(v =>
            v.path === currentFilePath || v.version === versionNumber
          );

          // Default comparison is with the previous version
          if (currentIndex === 0 && allVersions.length > 1) {
            // We're the newest version, compare with the second newest
            const previousVersion = allVersions[1];
            console.log('Will compare newest with second newest:', previousVersion.path);

            await performComparison(previousVersion.path, currentFilePath); // Compare previous (A) with current (B)
          } else if (currentIndex > 0) {
            // We're not the newest, compare with the next newer version
            const newerVersion = allVersions[currentIndex - 1];
            console.log('Will compare with newer version:', newerVersion.path);

            await performComparison(currentFilePath, newerVersion.path); // Compare current (A) with newer (B)
          } else {
            // We couldn't find our version in the list, fall back to comparing with newest
            console.log('Current version not found in list, falling back to newest vs. second newest');
            const [newest, secondNewest] = allVersions;

            await performComparison(secondNewest.path, newest.path); // Compare second newest (A) with newest (B)
          }
        } else {
          setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '', isLoading: false, error: 'Need at least two versions to compare. This appears to be the only version.' });
        }
      } else {
        // It's a base file (has no version suffix)
        const parts = currentFileName.split('.');
        const fileExtension = parts.pop();
        const baseFileName = parts.join('.');

        console.log('Base file detected:', {
          baseFileName,
          fileExtension
        });

        // Look for any versioned files with a simpler, more direct approach
        const versionRegex = new RegExp(`^(${baseFileName})-v(\\d+)\\.(${fileExtension})$`);
        console.log('Using regex pattern for versions:', versionRegex.toString());

        const versionedFiles = [];

        supabaseFilesData.forEach(file => {
          const fileName = file.name.split('/').pop();
          const match = fileName.match(versionRegex);

          if (match) {
            const version = parseInt(match[2]);
            console.log('Found matching versioned file:', fileName, 'Version:', version);
            versionedFiles.push({
              file,
              version,
              path: file.name
            });
          }
        });

        console.log('Versioned files found:', versionedFiles.length);

        if (versionedFiles.length > 0) {
          // Find the newest version
          versionedFiles.sort((a, b) => b.version - a.version);

          // Prepare version options for dropdown - all versioned files
          const versionOptions = versionedFiles.map((v, index) => {
            let label;
            if (index === 0) {
              // Latest version
              label = `Latest (${formatVersionDate(v.version)})`;
            } else {
              // Older versions with date
              label = formatVersionDate(v.version);
            }

            return {
              id: v.path,
              version: v.version,
              label,
              path: v.path
            };
          });

          setAvailableVersions(versionOptions);
          const newestVersion = versionedFiles[0];

          console.log('Using newest version for comparison:', newestVersion.path);

          await performComparison(currentFilePath, newestVersion.path); // Compare base (A) with newest (B)
        } else {
          setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '', isLoading: false, error: 'This is the only version of the file. No comparison available.' });
        }
      }
    } else {
      // Folder selected or selection cleared
      setComparisonData({ lineDiffPatch: null, originalA: '', originalB: '', isLoading: false, error: null });
    }
  // Pass language dependency
  }, [supabaseFilesData, selectedFileLanguage]); // Removed compareSupabaseFiles from deps as it's an import

  const handleVersionChange = useCallback(async (dropdown, versionId) => {
    console.log(`Selected version for ${dropdown} dropdown:`, versionId);

    let firstId = selectedVersionId;
    let secondId = secondSelectedVersionId;

    if (dropdown === 'first') {
      firstId = versionId;
      setSelectedVersionId(versionId);
    } else {
      secondId = versionId;
      setSecondSelectedVersionId(versionId);
    }

    if (selectedFile && firstId && secondId) {
      const firstVersion = availableVersions.find(v => v.id === firstId);
      const secondVersion = availableVersions.find(v => v.id === secondId);

      if (firstVersion && secondVersion) {
        console.log(`Comparing ${firstVersion.label} (${firstId}) with ${secondVersion.label} (${secondId})`);
        // Set loading state
        setComparisonData(prev => ({ ...prev, isLoading: true, error: null }));
        try {
          // Perform comparison with selected language
          const result = await compareSupabaseFiles(
            'gemini-files',
            firstId,
            secondId,
            selectedFileLanguage // Pass language
          );
          if (result) {
            // Update state with correct structure (lineDiffPatch)
            setComparisonData({
              lineDiffPatch: result.lineDiffPatch,
              originalA: result.originalA,
              originalB: result.originalB,
              isLoading: false,
              error: null
            });
          } else {
            setComparisonData({
              lineDiffPatch: null,
              originalA: '',
              originalB: '',
              isLoading: false,
              error: 'Error during comparison.'
            });
          }
        } catch (err) {
          console.error("Error in handleVersionChange comparison:", err);
          setComparisonData({
            lineDiffPatch: null,
            originalA: '',
            originalB: '',
            isLoading: false,
            error: `Comparison failed: ${err.message}`
          });
        }
      }
    }
  // Pass language dependency
  }, [selectedFile, selectedVersionId, secondSelectedVersionId, availableVersions, selectedFileLanguage]); // Removed compareSupabaseFiles from deps

  const handleToggleFolder = useCallback((folderId) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const version = `${year}${month}${day}${hour}`;
      const fileNameParts = file.name.split('.');
      const baseName = fileNameParts.slice(0, -1).join('.');
      const extension = fileNameParts.pop();

      // Updated filename format to preserve original extension before version and add .txt at the end
      const newFileName = `${baseName}-v${version}.${extension}.txt`;

      try {
        const { data, error } = await supabase
          .storage
          .from('gemini-files')
          .upload(newFileName, file);

        if (error) {
          console.error('Error uploading file:', error);
          alert(`Error uploading file: ${error.message}`);
        } else {
          console.log('File uploaded successfully:', data);
          alert(`File "${newFileName}" uploaded successfully!`);
          // Refresh the file list after successful upload
          await fetchFiles();
        }
      } catch (error) {
        console.error('An unexpected error occurred during upload:', error);
        alert(`An unexpected error occurred: ${error.message}`);
      }
    }
    // Clear the file input so the same file can be uploaded again
    event.target.value = null;
  };

  // Determine content for DiffViewer based on loading and error states
  const diffViewerContent = useMemo(() => {
    if (comparisonData.isLoading) {
      return { lineDiffPatch: null, originalA: '', originalB: '', message: 'Loading comparison...' };
    }
    if (comparisonData.error) {
      return { lineDiffPatch: null, originalA: '', originalB: '', message: comparisonData.error };
    }
    // If not loading and no error, return the actual data (or null if no diff yet)
    return {
      lineDiffPatch: comparisonData.lineDiffPatch,
      originalA: comparisonData.originalA,
      originalB: comparisonData.originalB,
      message: null // No specific message needed if data is present or null initially
    };
  }, [comparisonData]);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-300">
      {/* Sidebar */}
      <div className="w-64 md:w-72 lg:w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0 flex flex-col font-sans">
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide select-none">
            Files
          </h2>
          <input
            type="file"
            id="uploadFile"
            className="hidden"
            onChange={handleFileUpload}
          />
          <label htmlFor="uploadFile" className="inline-flex items-center px-4 py-2 border border-gray-700 text-gray-400 rounded-md text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring focus:ring-blue-300 bg-gray-800 hover:bg-gray-700 cursor-pointer mt-2">
            Upload File
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <FileTree
            items={fileSystem}
            onFileSelect={handleFileSelect}
            selectedFileId={selectedFile?.id ?? null}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            {/* Tab Bar Area */}
            <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-900">
              <div className="px-4 py-2 text-sm text-gray-200 bg-gray-950 border-r border-gray-800">
                {/* Display the cleaned name in the tab */}
                {selectedFile.displayName}
                {/* TODO: Add a close 'x' button later */}
              </div>
              {/* Add more inactive tabs here if implementing multi-tab */}
            </div> {/* This is the correct closing tag for the tab bar */}

            {/* Diff Viewer Area - Make it fill ALL available space horizontally */}
            <div className="flex-1 w-full flex flex-col min-h-0">
              {/* Conditionally render based on loading/error or pass data */}
              {diffViewerContent.message ? (
                 <div className="p-4 text-gray-600">{diffViewerContent.message}</div>
              ) : (
                <DiffViewer
                  key={`${selectedFile.id}-${selectedVersionId}-${secondSelectedVersionId}`} // More specific key
                  // Pass the correct prop name: lineDiffPatch
                  lineDiffPatch={diffViewerContent.lineDiffPatch}
                  originalContentA={diffViewerContent.originalA}
                  originalContentB={diffViewerContent.originalB}
                  fileName={selectedFile.displayName || extractOriginalFilename(selectedFile.name)}
                  versions={availableVersions}
                  selectedVersion={selectedVersionId}
                  secondSelectedVersion={secondSelectedVersionId}
                  onVersionChange={handleVersionChange}
                  language={selectedFileLanguage} // Pass the detected language
                />
              )}
            </div>
          </>
        ) : (
          // Placeholder when no file is selected
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm select-none font-sans">
            Select a file to view changes
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
