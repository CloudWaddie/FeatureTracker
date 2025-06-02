"use client";

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leaderboardTypeMap } from '@/app/consts';

async function getLeaderboards() {
  const res = await fetch('/api/db/getLeaderboards');
  if (!res.ok) {
    throw new Error('Failed to fetch leaderboards list');
  }
  return res.json();
}

async function getLeaderboardData(leaderboardName) {
  const url = leaderboardName ? `/api/db/getLeaderboardData?leaderboardName=${leaderboardName}` : '/api/db/getLeaderboardData';
  const res = await fetch(url);
  if (!res.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error(`Failed to fetch data for ${leaderboardName || 'default'}`);
  }
  return res.json();
}

export default function LeaderboardViewerPage() {
  const [leaderboards, setLeaderboards] = useState([]);
  const [selectedLeaderboard, setSelectedLeaderboard] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      try {
        const boardsData = await getLeaderboards(); // boardsData is { leaderboards: [...] }
        const boardNames = boardsData.leaderboards; // boardNames is [...]
        setLeaderboards(boardNames); // Store the array of strings
        if (boardNames.length > 0) {
          // Try to find a default or set the first one
          const defaultBoardName = boardNames.find(name => name === 'vision-overall-default') || boardNames[0];
          setSelectedLeaderboard(defaultBoardName);
        } else {
          setLoading(false);
        }
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  const fetchLeaderboardTableData = useCallback(async (leaderboardName) => {
    if (!leaderboardName) return;
    setLoading(true);
    setData(null); // Clear previous data
    setError(null); // Clear previous error
    try {
      const result = await getLeaderboardData(leaderboardName);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLeaderboard) {
      fetchLeaderboardTableData(selectedLeaderboard);
    }
  }, [selectedLeaderboard, fetchLeaderboardTableData]);

  const handleLeaderboardChange = (value) => {
    setSelectedLeaderboard(value);
  };

  if (error && !data) { // Show error only if there's no data to display (e.g. initial load error)
    return <div className="container mx-auto py-10">Error loading leaderboards: {error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Leaderboard Viewer</h1>
        {leaderboards.length > 0 && (
          <Select onValueChange={handleLeaderboardChange} value={selectedLeaderboard}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a leaderboard" />
            </SelectTrigger>
            <SelectContent>
              {leaderboards.map((boardName) => (
                <SelectItem key={boardName} value={boardName}>
                  {leaderboardTypeMap[boardName] || boardName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading && <div>Loading leaderboard data...</div>}
      {error && data && <div className="text-red-500 mb-4">Error loading data for {leaderboardTypeMap[selectedLeaderboard] || selectedLeaderboard}: {error}</div>}
      
      {data && data.length > 0 && (
        <Table>
          <TableCaption>
            Displaying leaderboard: {leaderboardTypeMap[selectedLeaderboard] || selectedLeaderboard}.
          </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Rank</TableHead>
            <TableHead>Model Name</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Votes</TableHead>
            <TableHead>License</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.rank}</TableCell>
              <TableCell>{item.modelName}</TableCell>
              <TableCell>{item.modelOrganization}</TableCell>
              <TableCell className="text-right">{item.score}</TableCell>
              <TableCell className="text-right">{item.votes}</TableCell>
              <TableCell>{item.license}</TableCell>
              <TableCell>
                <a href={item.modelUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Link
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      )} 
    </div>
  );
}
