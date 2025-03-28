// components/FileTree.jsx
import React from 'react';
import { VscFolder, VscFolderOpened, VscFile, VscChevronRight, VscChevronDown } from 'react-icons/vsc';

const FileTree = ({
  items,
  level = 0,
  onFileSelect,
  selectedFileId,
  expandedFolders,
  onToggleFolder,
}) => {
  const indent = level * 16;

  return (
    // Use slightly larger vertical space for better separation with new font
    <ul className="space-y-1">
      {items.map((item) => {
        if (item.type === 'folder') {
          const isExpanded = expandedFolders.has(item.id);
          return (
            <li key={item.id}>
              <div
                onClick={() => onToggleFolder(item.id)}
                // Slightly more padding, ensure vertical alignment
                className="flex items-center cursor-pointer pl-2 pr-3 py-1.5 rounded text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors duration-100"
                style={{ paddingLeft: `${indent + 8}px` }}
              >
                {isExpanded
                  ? <VscChevronDown className="mr-1 flex-shrink-0" size={16} />
                  : <VscChevronRight className="mr-1 flex-shrink-0" size={16} />}
                {isExpanded
                  ? <VscFolderOpened className="mr-1.5 text-sky-500 flex-shrink-0" size={16}/>
                  : <VscFolder className="mr-1.5 text-sky-500 flex-shrink-0" size={16} />}
                {/* Text size remains small, but font makes it clearer */}
                <span className="text-sm truncate select-none">{item.name}</span>
              </div>
              {isExpanded && item.children.length > 0 && (
                <FileTree
                  items={item.children}
                  level={level + 1}
                  onFileSelect={onFileSelect}
                  selectedFileId={selectedFileId}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                />
              )}
            </li>
          );
        } else {
          const isSelected = selectedFileId === item.id;
          return (
            <li key={item.id}>
              <div
                onClick={() => onFileSelect(item)}
                className={`flex items-center cursor-pointer pl-2 pr-3 py-1.5 rounded transition-colors duration-100 ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-300' // Kept the subtle selection
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
                // Adjust indent to align text visually with folder text
                style={{ paddingLeft: `${indent + 8 + 16 + 6 }px` }}
              >
                <VscFile className="mr-1.5 text-gray-500 flex-shrink-0" size={16} />
                <span className="text-sm truncate select-none">{item.name}</span>
              </div>
            </li>
          );
        }
      })}
    </ul>
  );
};

export default FileTree;