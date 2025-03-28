'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer';
import { supabase } from '@/lib/supabaseClient';
import { compareSupabaseFiles } from '@/lib/data';

const FileExplorer = () => {
  const [fileSystem, setFileSystem] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [diffContent, setDiffContent] = useState(''); // State to store the diff

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const { data, error } = await supabase
          .storage
          .from('gemini-files')
          .list();

        if (error) {
          console.error('Error fetching files from Supabase:', error);
          return;
        }
        console.log('Supabase Data:', data);
        const transformedFileSystem = transformSupabaseFiles(data);
        setFileSystem(transformedFileSystem);
      } catch (error) {
        console.error('An unexpected error occurred while fetching files:', error);
      }
    };

    fetchFiles();
  }, []);

  const transformSupabaseFiles = (files) => {
    const root = { id: 'root', name: 'root', type: 'folder', children: [] };
    const lookup = { root };

    files.forEach(file => {
      const pathParts = file.name.split('/');
      const fileName = pathParts[pathParts.length - 1]; // Get the filename with extension
      const baseFileName = fileName.split('.')[0];
      const isVersionFile = fileName.startsWith(`${baseFileName}-v`) && !isNaN(parseInt(fileName.split('-v')[1]?.split('.')[0]));

      // Only add to the tree if it's not a version file
      if (!isVersionFile) {
        let currentParent = root;
        let currentPath = '';

        pathParts.forEach((part, index) => {
          const isFolder = index < pathParts.length - 1;
          currentPath += (currentPath ? '/' : '') + part;
          const id = currentPath;

          if (!lookup[id]) {
            const newItem = {
              id: id,
              name: part,
              type: isFolder ? 'folder' : 'file',
              children: isFolder ? [] : null,
              path: currentPath,
            };
            lookup[id] = newItem;
            currentParent.children.push(newItem);
          }
          currentParent = lookup[id];
        });
      }
    });

    return root.children;
  };

  const handleFileSelect = useCallback(async (selectedFileItem) => {
    setSelectedFile(selectedFileItem);
    if (selectedFileItem && selectedFileItem.type === 'file') {
      const currentFileName = selectedFileItem.name;
      const currentFilePath = selectedFileItem.path;
      const baseFileName = currentFileName.split('.')[0]; // Get the name without the extension

      // Filter for files that start with the base name followed by '-v'
      const versionFiles = fileSystem.filter(file =>
        file.name.startsWith(`${baseFileName}-v`) && file.name !== currentFileName
      );

      if (versionFiles.length > 0) {
        // Extract version numbers and find the highest
        const versions = versionFiles.map(file => {
          const parts = file.name.split('-v');
          if (parts.length > 1) {
            const versionPart = parts[1].split('.')[0]; // Get the number before the extension
            return parseInt(versionPart);
          }
          return 0; // Or some default if parsing fails
        }).filter(version => !isNaN(version)); // Filter out any non-numbers

        if (versions.length > 0) {
          const latestVersion = Math.max(...versions);
          const oldFileName = `${baseFileName}-v${latestVersion}.${currentFileName.split('.')[1]}`;
          const oldFilePath = selectedFileItem.path.replace(currentFileName, oldFileName);

          const diff = await compareSupabaseFiles('gemini-files', oldFilePath, currentFilePath);
          setDiffContent(diff || 'Could not load diff or old version not found.');
        } else {
          setDiffContent('No previous versions found.');
        }
      } else {
        setDiffContent('No previous versions found.');
      }
    } else {
      setDiffContent(''); // Clear diff if a folder is selected
    }
  }, [compareSupabaseFiles, fileSystem]); // Make sure fileSystem is in the dependencies

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

  return (
    <div className="flex h-screen bg-gray-950 text-gray-300">
      {/* Sidebar */}
      <div className="w-64 md:w-72 lg:w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0 flex flex-col font-sans">
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
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
                {selectedFile.name}
                {/* TODO: Add a close 'x' button later */}
              </div>
              {/* Add more inactive tabs here if implementing multi-tab */}
            </div>

            {/* Diff Viewer Area */}
            <DiffViewer
              key={selectedFile.id}
              diffContent={currentDiff}
            />
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