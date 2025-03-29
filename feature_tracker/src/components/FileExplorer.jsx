'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer';
import { useSupabase } from '../app/supabase-provider';
import { compareSupabaseFiles } from '@/lib/data';

const FileExplorer = () => {
  const [fileSystem, setFileSystem] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [diffContent, setDiffContent] = useState('');
  const [supabaseFilesData, setSupabaseFilesData] = useState([]); // Store the raw data from Supabase
  const supabase = useSupabase();

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
      const versionMatch = fileName.match(/^(.+)-v(\d+)\.(.+)$/);

      if (versionMatch) {
        // It's a versioned file
        const [, baseName, versionNumber, extension] = versionMatch;
        // Use the original base filename for grouping to handle future versions
        const baseFileName = `${baseName}.${extension}`;
        const fullPath = dirPath ? `${dirPath}/${baseFileName}` : baseFileName;

        if (!fileGroups[fullPath]) {
          fileGroups[fullPath] = [];
        }

        fileGroups[fullPath].push({
          ...file,
          versionNumber: parseInt(versionNumber),
          baseFileName: baseFileName,
          displayName: baseFileName // Add display name without version number
        });
      } else {
        // It's a base file (no version)
        const fullPath = dirPath ? `${dirPath}/${fileName}` : fileName;

        if (!fileGroups[fullPath]) {
          fileGroups[fullPath] = [];
        }

        fileGroups[fullPath].push({
          ...file,
          versionNumber: 0,
          baseFileName: fileName,
          displayName: fileName // For non-versioned files, display name is same as name
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
          name: file.displayName || filePart, // Use the display name without version
          type: 'file',
          children: null,
          path: currentPath,
          // Store both the original name with version and the display name
          fileData: file,
          originalName: filePart,
          displayName: file.displayName
        };
        lookup[id] = newItem;
        currentParent.children.push(newItem);
      }
    });

    return root.children;
  };

  const handleFileSelect = useCallback(async (selectedFileItem) => {
    setSelectedFile(selectedFileItem);
    if (selectedFileItem && selectedFileItem.type === 'file') {
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
      const versionRegex = /^(.+)-v(\d+)\.(.+)$/;
      const versionMatch = currentFileName.match(versionRegex);

      // Check if this is a versioned file (has -v123456 in the name)
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
          
          // Get the index of the current version (might be -1 if not found, which is handled below)
          const currentIndex = allVersions.findIndex(v => 
            v.path === currentFilePath || v.version === versionNumber
          );
          console.log('Current file index in version list:', currentIndex, 'Current path:', currentFilePath);
          
          if (currentIndex === 0 && allVersions.length > 1) {
            // We're the newest version, compare with the second newest
            const previousVersion = allVersions[1];
            console.log('Will compare newest with second newest:', previousVersion.path);
            
            const diff = await compareSupabaseFiles(
              'gemini-files',
              previousVersion.path,
              currentFilePath
            );
            
            setDiffContent(diff || `No differences found between current version and v${previousVersion.version}`);
          } else if (currentIndex > 0) {
            // We're not the newest, compare with the next newer version
            const newerVersion = allVersions[currentIndex - 1];
            console.log('Will compare with newer version:', newerVersion.path);
            
            const diff = await compareSupabaseFiles(
              'gemini-files',
              currentFilePath,
              newerVersion.path
            );
            
            setDiffContent(diff || `No differences found between current version and v${newerVersion.version}`);
          } else {
            // We couldn't find our version in the list, fall back to comparing with newest
            console.log('Current version not found in list, falling back to newest vs. second newest');
            const [newest, secondNewest] = allVersions;
            
            const diff = await compareSupabaseFiles(
              'gemini-files',
              secondNewest.path,
              newest.path
            );
            
            setDiffContent(diff || `Comparing latest version (v${newest.version}) with previous (v${secondNewest.version})`);
          }
        } else {
          setDiffContent('Need at least two versions to compare. This appears to be the only version.');
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
          const newestVersion = versionedFiles[0];
          
          console.log('Using newest version for comparison:', newestVersion.path);
          
          // Compare base file with the newest version
          const diff = await compareSupabaseFiles(
            'gemini-files',
            currentFilePath,
            newestVersion.path
          );
          
          setDiffContent(diff || `Comparing base file with v${newestVersion.version}`);
        } else {
          setDiffContent('This is the only version of the file. No comparison available.');
        }
      }
    } else {
      setDiffContent('');
    }
  }, [supabaseFilesData, compareSupabaseFiles]);

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

  const currentDiff = useMemo(() => {
    return diffContent;
  }, [diffContent]);

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
      const newFileName = `${baseName}-v${version}.${extension}`;

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
            <label htmlFor="uploadFile" className="inline-flex items-center px-4 py-2 border border-gray-700 text-gray-400 rounded-md text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring focus:ring-blue-300 bg-gray-800 hover:bg-gray-700 cursor-pointer">
              Upload File
            </label>
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide select-none">
            Files
          </h2>
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
                {selectedFile.displayName || selectedFile.name}
                {/* TODO: Add a close 'x' button later */}
              </div>
              {/* Add more inactive tabs here if implementing multi-tab */}
            </div>

            {/* Diff Viewer Area - Make sure it takes full width and gets diffContent */}
            <div className="flex-1 w-full overflow-auto">
              <DiffViewer
                key={selectedFile.id}
                diffContent={currentDiff || 'Loading comparison...'}
                fileName={selectedFile.displayName || selectedFile.name}
              />
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