'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
// import { initialFileSystem, generateDiff } from '@/lib/data'; // Remove these imports
import { compareSupabaseFiles } from '@/lib/data'; // Import the function for diffing

const FileExplorer = () => {
  const [fileSystem, setFileSystem] = useState([]); // State to hold the file system from Supabase
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set()); // Initialize as an empty Set

  useEffect(() => {
    // Function to fetch files from Supabase bucket
    const fetchFiles = async () => {
      try {
        const { data, error } = await supabase
          .storage
          .from('gemini-files')
          .list();

        if (error) {
          console.error('Error fetching files from Supabase:', error);
          console.error('Supabase Error Details:', error); // Add this line!
          return;
        }
        console.log('Supabase Data:', data); // Add this line
        const transformedFileSystem = transformSupabaseFiles(data);

        setFileSystem(transformedFileSystem);
      } catch (error) {
        console.error('An unexpected error occurred while fetching files:', error);
      }
    };

    fetchFiles();
  }, []);

  // Helper function to transform the flat Supabase list into a hierarchical structure
  const transformSupabaseFiles = (files) => {
    const root = { id: 'root', name: 'root', type: 'folder', children: [] };
    const lookup = { root };

    files.forEach(file => {
      const pathParts = file.name.split('/');
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
            children: isFolder ? [] : null, // Files don't have children
            path: currentPath, // Store the full path for fetching content
          };
          lookup[id] = newItem;
          currentParent.children.push(newItem);
        }
        currentParent = lookup[id];
      });
    });

    return root.children; // Return only the children of the root
  };

  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
    // In the future, here you would trigger compareSupabaseFiles
    // with the old and new versions of the selected file.
    // For now, we'll just store the selected file info.
  }, []);

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
    if (!selectedFile) return '';

    // For now, let's just display the path of the selected file as a placeholder
    // You'll replace this with the actual diff content fetched from Supabase
    return `Selected File Path: ${selectedFile?.path || ''}`;
  }, [selectedFile]);

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