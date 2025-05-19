'use client';

import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Page() {
  const { data: session, status } = useSession();
  const [feedData, setFeedData] = useState(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const hideItem = async (id, currentIsHidden) => {
    const newIsHidden = currentIsHidden === 1 ? 0 : 1;
    try {
      const response = await fetch('/api/db/hideFeedItem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, isHidden: newIsHidden }),
      });
      if (!response.ok) {
        throw new Error('Failed to update item visibility');
      }
      // Optimistically update the UI or refetch data
      setFeedData(prevData => 
        prevData.map(item => 
          item.id === id ? { ...item, isHidden: newIsHidden } : item
        )
      );
    } catch (error) {
      console.error(`Failed to update item visibility for id: ${id}`, error);
    }
  };

  useEffect(() => {
    const fetchTotalPages = async () => {
      try {
        const res = await fetch("/api/getTotalPages");
        if (!res.ok) {
          throw new Error("Failed to fetch total pages");
        }
        const textData = await res.text();
        const numPages = parseInt(textData, 10);
        setTotalPages(isNaN(numPages) ? 1 : numPages);
      } catch (error) {
        console.error(error);
        setTotalPages(1); // Default to 1 page on error
      }
    };

    const fetchFeedData = async (page) => {
      setLoadingFeed(true);
      try {
        const res = await fetch(`/api/db/getFeed?page=${page}`);
        if (!res.ok) {
          throw new Error("Failed to fetch feed data");
        }
        const data = await res.json();
        setFeedData(data);
      } catch (error) {
        console.error(error);
        setFeedData(null); // Clear data on error
        // Handle error state appropriately
      } finally {
        setLoadingFeed(false);
      }
    };

    if (status === "authenticated") {
      fetchTotalPages();
      fetchFeedData(currentPage);
    }
  }, [status, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (status === "loading") {
    return <div>Loading control panel...</div>;
  }

  if (status === "unauthenticated" || !session) {
    notFound();
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Control Panel</h2>
        <Button onClick={() => signOut()}>Sign out</Button>
      </div>
      <p className="mb-6">
        Welcome to the control panel, {session.user.name}!
      </p>

      <h3 className="text-2xl font-semibold mb-4">Feed Database</h3>
      {loadingFeed ? (
        <p>Loading feed data...</p>
      ) : feedData && feedData.length > 0 ? (
        <Table>
          <TableCaption>A list of your recent feed items.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>App Id</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedData.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.id}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  {item.details && item.details.length > 100
                    ? `${item.details.slice(0, 100)}...`
                    : item.details}
                </TableCell>
                <TableCell>{item.appId || "N/A"}</TableCell>
                <TableCell>
                  {new Date(item.date).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => hideItem(item.id, item.isHidden)}>
                    {item.isHidden === 1 ? 'Show' : 'Hide'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p>No feed data available.</p>
      )}
      {feedData && feedData.length > 0 && (
        <div className="flex justify-center items-center space-x-2 mt-4">
          <Button
            onClick={handlePreviousPage}
            disabled={currentPage === 1 || loadingFeed}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={handleNextPage}
            disabled={currentPage === totalPages || loadingFeed}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
