// components/FileExplorer.jsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer';
import { initialFileSystem, generateDiff } from '@/lib/data';

const FileExplorer = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(() => {
      const rootFolderIds = initialFileSystem
          .filter(item => item.type === 'folder')
          .map(item => item.id);
      return new Set(rootFolderIds);
  });

  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
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
    return generateDiff(selectedFile.oldContent || '', selectedFile.newContent || '');
  }, [selectedFile]);

  return (
    // Base container uses Inter font via body/html
    <div className="flex h-screen bg-gray-950 text-gray-300">
      {/* Sidebar - Apply sans font, slightly adjusted width/padding */}
      <div className="w-64 md:w-72 lg:w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0 flex flex-col font-sans"> {/* Ensure font + Divider */}
        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
             <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide select-none">
                Files
             </h2>
        </div>
        {/* File Tree container */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
            <FileTree
              items={initialFileSystem}
              onFileSelect={handleFileSelect}
              selectedFileId={selectedFile?.id ?? null}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
            />
        </div>
      </div>

      {/* Content Area - Now includes Tabs + DiffViewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <> {/* Use fragment */}
            {/* Tab Bar Area */}
            <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-900"> {/* Tab bar background */}
               {/* Active Tab Item - Only one tab for now */}
               <div className="px-4 py-2 text-sm text-gray-200 bg-gray-950 border-r border-gray-800"> {/* Matches DiffViewer bg */}
                 {selectedFile.name}
                 {/* TODO: Add a close 'x' button later */}
               </div>
               {/* Add more inactive tabs here if implementing multi-tab */}
            </div>

            {/* Diff Viewer Area */}
            <DiffViewer
              key={selectedFile.id} // Force re-render on file change
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