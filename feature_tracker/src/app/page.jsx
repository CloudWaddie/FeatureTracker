// src/app/page.jsx
'use client';

import { useEffect, useState } from 'react';
import FileExplorer from '../components/FileExplorer';

export default function Home() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <FileExplorer />
    </div>
  );
}