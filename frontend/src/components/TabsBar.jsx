import React from 'react';

const TabsBar = ({ tabs, activeTab, onTabClick, onTabClose }) => {
  return (
    <div className="flex border-b border-gray-700 bg-gray-800">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center px-4 py-2 cursor-pointer border-r border-gray-700 ${
            activeTab?.id === tab.id ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-700'
          }`}
          onClick={() => onTabClick(tab)}
        >
          <span>{tab.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering onTabClick
              onTabClose(tab.id);
            }}
            className="ml-2 text-gray-500 hover:text-white text-xs"
            aria-label={`Close ${tab.name}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default TabsBar;
