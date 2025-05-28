'use client';

import { useEffect, useState, useMemo } from 'react';
import { logClientError } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from "next-auth/react";

export default function LogsViewerPage() {
  // Hooks must be called at the top level and in the same order.
  const [loading, setLoading] = useState(true); // Manages loading state for logs
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState('');
  const [openLogLevelSelector, setOpenLogLevelSelector] = useState(false);
  const [allLogs, setAllLogs] = useState([]); // State to store all fetched logs
  const { data: session, status } = useSession(); // Hook for session management

  // useEffect for fetching logs, dependent on session status
  useEffect(() => {
    async function fetchLogs() {
      // setLoading(true) is handled by the conditional logic before this function is called
      try {
        const response = await fetch('/api/getLogs');
        if (!response.ok) {
          const errorData = await response.text().catch(() => `HTTP error! status: ${response.status}`);
          throw new Error(errorData || `HTTP error! status: ${response.status}`);
        }
        const textData = await response.text();
        const lines = textData.trim().split('\n');
        const processedLogs = lines.map(line => {
          try {
            const log = JSON.parse(line);
            return {
              ...log,
              timestamp: log.timestamp || new Date(0).toISOString() // Default to epoch if timestamp is missing
            };
          } catch (parseError) {
            console.error('Failed to parse log line:', line, parseError);
            // Optionally, log this error to the server or handle it appropriately
            // For now, we'll return null and filter it out later, or you can skip it
            return null; 
          }
        }).filter(log => log !== null); // Filter out any logs that failed to parse

        setAllLogs(processedLogs);
        setError(null); // Clear previous errors on successful fetch
      } catch (e) {
        // Log the error to the server
        logClientError('error', 'Failed to fetch logs in LogsViewerPage', { 
          msg: e.message, 
          errorStack: e.stack,
          errorName: e.name 
        });
        setError(e.message);
        setAllLogs([]); // Clear logs on error
      } finally {
        setLoading(false); // Stop loading indicator once fetch attempt is complete
      }
    }

    if (status === "authenticated" && session) {
      setLoading(true); // Indicate loading when authenticated and about to fetch logs
      fetchLogs(); // Initial fetch
      const intervalId = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
      return () => clearInterval(intervalId); // Cleanup interval on component unmount or if dependencies change
    } else if (status === "unauthenticated") {
      setAllLogs([]); // Clear logs if not authenticated
      setLoading(false); // Not loading data
      setError(null); // Clear any previous errors
    } else if (status === "loading") { // Session is still loading
      setLoading(true); // Keep UI in loading state while session loads
      setAllLogs([]); // Ensure no stale logs are shown
      setError(null); // Clear errors
    }
  }, [status, session]); // Re-run effect if session status or session data changes

  const filteredAndSortedLogs = useMemo(() => {
    return allLogs
      .filter(log => {
        const searchTermLower = searchTerm.toLowerCase();
        let messageMatch = true; // Default to true (pass) if searchTerm is empty

        if (searchTermLower) { // Only apply message search if searchTerm is not empty
          if (typeof log.message === 'string') {
            messageMatch = log.message.toLowerCase().includes(searchTermLower);
          } else if (typeof log.message === 'object' && log.message !== null) {
            try {
              // Stringify the object message to allow searching its content
              messageMatch = JSON.stringify(log.message).toLowerCase().includes(searchTermLower);
            } catch (e) {
              // If stringification or search fails, consider it not a match
              messageMatch = false;
            }
          } else if (log.message !== null && log.message !== undefined) {
            // For other primitive types like numbers or booleans, convert to string
            messageMatch = String(log.message).toLowerCase().includes(searchTermLower);
          } else {
            // If log.message is null or undefined, it cannot match a non-empty searchTerm
            messageMatch = false;
          }
        }

        const levelMatch = selectedLogLevel ? (log.level?.toUpperCase() === selectedLogLevel) : true; // selectedLogLevel is already uppercase from uniqueLogLevels and onSelect
        return messageMatch && levelMatch;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Newest first
  }, [allLogs, searchTerm, selectedLogLevel]);

  const uniqueLogLevels = useMemo(() => {
    const levels = new Set(allLogs.map(log => log.level?.toUpperCase()).filter(Boolean));
    return ["", ...Array.from(levels).sort()]; // Add "" for "All Levels"
  }, [allLogs]);

  // Conditional rendering based on authentication and data loading status
  if (status === "loading") {
    return (
      <div className="container mx-auto p-4">
        <p>Authenticating...</p>
      </div>
    );
  }

  if (status !== "authenticated" || !session) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-red-500">You must be logged in to view logs.</p>
      </div>
    );
  }

  // At this point, user is authenticated. Now check for log loading/error states.
  if (loading && status === "authenticated") { // Show loading if logs are being fetched or session just authenticated
    return <div className="container mx-auto p-4"><p>Loading logs...</p></div>;
  }

  if (error && status === "authenticated") { // Show error if there was an issue fetching logs
    return <div className="container mx-auto p-4"><p className="text-red-500">Error loading logs: {error}</p></div>;
  }

  // Render the logs table if authenticated, not loading, and no error
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Logs Viewer</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          type="text"
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        <Popover open={openLogLevelSelector} onOpenChange={setOpenLogLevelSelector}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openLogLevelSelector}
              className="w-[200px] justify-between"
            >
              {selectedLogLevel
                ? uniqueLogLevels.find((level) => level === selectedLogLevel) || "Select level..."
                : "All Levels"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search level..." />
              <CommandList>
                <CommandEmpty>No level found.</CommandEmpty>
                <CommandGroup>
                  {uniqueLogLevels.map((level) => (
                    <CommandItem
                      key={level || 'all'}
                      value={level}
                      onSelect={(currentValue) => {
                        setSelectedLogLevel(currentValue === "" ? "" : currentValue);
                        setOpenLogLevelSelector(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedLogLevel === level ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {level || "All Levels"}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {filteredAndSortedLogs.length === 0 && !loading && (
        <p>No logs found matching your criteria.</p>
      )}

      {filteredAndSortedLogs.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Timestamp</TableHead>
                <TableHead className="w-[100px]">Level</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedLogs.map((log, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold",
                      log.level?.toUpperCase() === "ERROR" && "bg-red-100 text-red-800",
                      log.level?.toUpperCase() === "WARN" && "bg-yellow-100 text-yellow-800",
                      log.level?.toUpperCase() === "INFO" && "bg-blue-100 text-blue-800",
                      log.level?.toUpperCase() === "DEBUG" && "bg-green-100 text-green-800",
                      log.level?.toUpperCase() === "FATAL" && "bg-purple-100 text-purple-800",
                      !["ERROR", "WARN", "INFO", "DEBUG", "FATAL"].includes(log.level?.toUpperCase()) && "bg-gray-100 text-gray-800"
                    )}>
                      {log.level}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-pre-wrap break-all">{typeof log.message === 'object' ? JSON.stringify(log.message, null, 2) : String(log.message)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
