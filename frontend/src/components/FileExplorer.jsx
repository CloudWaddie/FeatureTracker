'use client';

import React, { useState, useCallback } from 'react';
import FileTree from './FileTree';
// Removed Supabase and data fetching imports
// Removed helper functions (moved to page.jsx)

// Simplified FileExplorer: Receives fileSystem and calls onFileSelect with metadata
const FileExplorer = ({ fileSystem, onFileSelect }) => {
  const [selectedFileIdForTree, setSelectedFileIdForTree] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Simplified handleFileSelect: Just calls parent with metadata
  const handleFileSelect = useCallback((selectedFileItem) => {
    // Update local state for highlighting in the tree
    setSelectedFileIdForTree(selectedFileItem?.id ?? null);

    // If a file is selected and parent handler exists, call it with the item
    if (onFileSelect && selectedFileItem && selectedFileItem.type === 'file') {
      // Pass the whole selectedFileItem (contains id, name, path, fileData, originalName, displayName)
      onFileSelect(selectedFileItem);
    } else if (onFileSelect && !selectedFileItem) {
      // Handle deselection if needed (optional)
      // onFileSelect(null);
    }
  }, [onFileSelect]); // Dependency is only the callback from parent

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
    // Removed file upload logic (can be moved to parent or kept separate)
  };

  return (
    // Removed outer div flex h-screen... as parent now controls layout
    // Sidebar container
    <div className="w-64 md:w-72 lg:w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto flex-shrink-0 flex flex-col font-sans h-full"> {/* Added h-full */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide select-none">
          Files
        </h2>
        {/* Removed Upload button for now - can be added back in page.jsx if needed */}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <FileTree
          items={fileSystem || []} // Use fileSystem prop, default to empty array
          onFileSelect={handleFileSelect} // Calls parent with metadata
          selectedFileId={selectedFileIdForTree}
          expandedFolders={expandedFolders}
          onToggleFolder={handleToggleFolder}
        />
      </div>
    </div>
    // Removed Content Area rendering
  );
};

export default FileExplorer;
