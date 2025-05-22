'use client';

import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { typeDisplayNameMap } from "../consts";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function Page() {
  const { data: session, status } = useSession();
  const [feedData, setFeedData] = useState(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [tableInfo, setTableInfo] = useState(null); // Stores PRAGMA table_info
  const [tableData, setTableData] = useState(null); // Stores SELECT * data
  const [loadingTableInfo, setLoadingTableInfo] = useState(false);
  const [loadingTableData, setLoadingTableData] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, columnName, originalValue, rowId }
  const [editValue, setEditValue] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
  const [isHidingCategory, setIsHidingCategory] = useState(true); // New state to track action
  const [dialogOpen, setDialogOpen] = useState(false); // Control dialog visibility

  const hideItem = async (id, currentIsHidden) => {
    const newIsHidden = currentIsHidden === 1 ? 0 : 1;
    try {
      const response = await fetch('/api/db/hideFeedItem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isHidden: newIsHidden }),
      });
      if (!response.ok) throw new Error('Failed to update item visibility');
      setFeedData(prevData => 
        prevData.map(item => item.id === id ? { ...item, isHidden: newIsHidden } : item)
      );
      toast.success(`Successfully ${newIsHidden === 1 ? 'hidden' : 'shown'} item with ID ${id}.`);
    } catch (error) {
      console.error(`Failed to update item visibility for id: ${id}`, error);
      toast.error(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch("/api/db/getAllTables");
        if (!res.ok) throw new Error("Failed to fetch tables");
        const data = await res.json();
        setTables(data);
      } catch (error) {
        console.error(error);
        setTables([]);
      }
    };

    const fetchTotalPages = async () => {
      try {
        const res = await fetch("/api/getTotalPages?showHidden=true");
        if (!res.ok) throw new Error("Failed to fetch total pages");
        const textData = await res.text();
        const numPages = parseInt(textData, 10);
        setTotalPages(isNaN(numPages) ? 1 : numPages);
      } catch (error) {
        console.error(error);
        setTotalPages(1);
      }
    };

    const fetchFeedData = async (page) => {
      setLoadingFeed(true);
      try {
        const res = await fetch(`/api/db/getFeed?page=${page}&showHidden=true`);
        if (!res.ok) throw new Error("Failed to fetch feed data");
        const data = await res.json();
        setFeedData(data);
      } catch (error) {
        console.error(error);
        setFeedData(null);
      } finally {
        setLoadingFeed(false);
      }
    };

    if (status === "authenticated") {
      fetchTables();
      fetchTotalPages();
      fetchFeedData(currentPage);
    }
  }, [status, currentPage]);

  const fetchTableDetails = async (tableName) => {
    if (!tableName) return;
    setSelectedTable(tableName);
    setTableInfo(null);
    setTableData(null);
    setEditingCell(null); // Reset editing state when table changes

    setLoadingTableInfo(true);
    try {
      const infoRes = await fetch(`/api/db/getTableInfo/${tableName}`);
      if (!infoRes.ok) throw new Error(`Failed to fetch table info for ${tableName}`);
      const infoData = await infoRes.json();
      setTableInfo(infoData);
    } catch (error) {
      console.error(error);
      setTableInfo(null);
    } finally {
      setLoadingTableInfo(false);
    }

    setLoadingTableData(true);
    try {
      const dataRes = await fetch(`/api/db/getTableData/${tableName}`);
      if (!dataRes.ok) throw new Error(`Failed to fetch data for table ${tableName}`);
      const data = await dataRes.json();
      setTableData(data);
    } catch (error) {
      console.error(error);
      setTableData(null);
    } finally {
      setLoadingTableData(false);
    }
  };

  const handleCellClick = (rowIndex, columnName, originalValue, rowId) => {
    // Prevent editing primary key 'id' column for now
    if (columnName === 'id') {
        toast.warning("Primary key 'id' cannot be edited.");
        return;
    }
    setEditingCell({ rowIndex, columnName, originalValue, rowId });
    setEditValue(originalValue === null || originalValue === undefined ? "" : String(originalValue));
  };

  const handleEditChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleSaveEdit = async () => {
    if (!editingCell || !selectedTable) return;
    const { rowIndex, columnName, rowId } = editingCell;
    
    // Type conversion based on column type (simplified)
    let finalValue = editValue;
    const columnSchema = tableInfo.find(col => col.name === columnName);
    if (columnSchema) {
        if (columnSchema.type.toUpperCase().includes('INT')) {
            finalValue = parseInt(editValue, 10);
            if (isNaN(finalValue)) {
                 toast.error(`Invalid number for ${columnName}. Please enter a valid integer.`);
                 return;
            }
        } else if (columnSchema.type.toUpperCase().includes('REAL') || columnSchema.type.toUpperCase().includes('FLOAT') || columnSchema.type.toUpperCase().includes('DOUBLE')) {
            finalValue = parseFloat(editValue);
             if (isNaN(finalValue)) {
                 toast.error(`Invalid number for ${columnName}. Please enter a valid number.`);
                 return;
            }
        }
        // Add more type checks as needed (BOOLEAN, DATE, etc.)
    }


    try {
      const response = await fetch(`/api/db/updateTableData/${selectedTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, column: columnName, value: finalValue }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save edit');
      }
      toast.success(`Successfully updated ${columnName} for row ID ${rowId}.`);
      // Optimistically update local data
      setTableData(prevData => {
        const newData = [...prevData];
        newData[rowIndex] = { ...newData[rowIndex], [columnName]: finalValue };
        return newData;
      });
      setEditingCell(null);
    } catch (error) {
      console.error('Failed to save edit:', error);
      toast.error(`Error saving: ${error.message}`);
      // Optionally revert to originalValue or keep editing
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };


  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  if (status === "loading") return <div>Loading control panel...</div>;
  if (status === "unauthenticated" || !session) {
    notFound();
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">Control Panel</h2>
        <div className="flex items-center space-x-2"> {/* Added a div to group buttons and apply gap */}
          {/* AlertDialog for Hiding/Showing Categories */}
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {/* Triggers are now separate buttons but control the same dialog */}
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{isHidingCategory ? "Hide" : "Show"} a Category</AlertDialogTitle>
                <AlertDialogDescription>
                  Select a category to {isHidingCategory ? "hide. This will prevent new items from this category from appearing in the main feed." : "show. This will allow new items from this category to appear in the main feed."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Popover open={categoryComboboxOpen} onOpenChange={setCategoryComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryComboboxOpen}
                      className="w-full justify-between bg-gray-800 text-white hover:bg-gray-700 hover:text-white"
                    >
                      {selectedCategory
                        ? typeDisplayNameMap[selectedCategory] || "Select category..."
                        : "Select category..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-gray-800 border-gray-700">
                    <Command>
                      <CommandInput placeholder="Search category..." />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {Object.entries(typeDisplayNameMap).map(([value, label]) => (
                            <CommandItem
                              key={value}
                              value={value}
                              onSelect={(currentValue) => {
                                setSelectedCategory(currentValue === selectedCategory ? "" : currentValue);
                                setCategoryComboboxOpen(false);
                              }}
                              className="text-white hover:bg-gray-700 aria-selected:bg-blue-600"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCategory === value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {setSelectedCategory(""); setDialogOpen(false);}}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  if (selectedCategory) {
                    try {
                      const response = await fetch('/api/db/hideCategory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ category: selectedCategory, hide: isHidingCategory }),
                      });
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `Failed to ${isHidingCategory ? "hide" : "show"} category ${typeDisplayNameMap[selectedCategory]}`);
                      }
                      toast.success(`Successfully ${isHidingCategory ? "hid" : "showed"} category "${typeDisplayNameMap[selectedCategory]}".`);
                      setSelectedCategory(""); // Reset selection
                      setDialogOpen(false); // Close dialog on success
                      // Optionally, refresh data or update UI
                    } catch (error) {
                      console.error(`Failed to ${isHidingCategory ? "hide" : "show"} category: ${selectedCategory}`, error);
                      toast.error(`Error: ${error.message}`);
                    }
                  } else {
                    toast.warning("Please select a category.");
                  }
                }}>{isHidingCategory ? "Hide" : "Show"} Category</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Buttons to trigger the dialog */}
          <Button variant="outline" onClick={() => { setIsHidingCategory(true); setDialogOpen(true); }}>Hide Category</Button>
          <Button variant="outline" onClick={() => { setIsHidingCategory(false); setDialogOpen(true); }}>Show Category</Button>
          <Button onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>
      <p className="mb-6">Welcome to the control panel, {session.user.name}!</p>

      <h3 className="text-2xl font-semibold mb-4">Feed Database</h3>
      {loadingFeed ? <p>Loading feed data...</p> : feedData && feedData.length > 0 ? (
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
                <TableCell>{item.details && item.details.length > 100 ? `${item.details.slice(0, 100)}...` : item.details}</TableCell>
                <TableCell>{item.appId || "N/A"}</TableCell>
                <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => hideItem(item.id, item.isHidden)}>
                    {item.isHidden === 1 ? 'Show' : 'Hide'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : <p>No feed data available.</p>}
      {feedData && feedData.length > 0 && (
        <div className="flex justify-center items-center space-x-2 mt-4 mb-8">
          <Button onClick={handlePreviousPage} disabled={currentPage === 1 || loadingFeed} variant="outline">Previous</Button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <Button onClick={handleNextPage} disabled={currentPage === totalPages || loadingFeed} variant="outline">Next</Button>
        </div>
      )}

      <h3 className="text-2xl font-semibold mb-4 mt-8">Database Tables</h3>
      {tables.length > 0 ? (
        <div className="mb-4">
          <label htmlFor="table-combobox" className="mr-2 block mb-1">Select a table:</label>
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboboxOpen}
                className="w-[200px] justify-between bg-gray-800 text-white hover:bg-gray-700 hover:text-white"
                id="table-combobox"
              >
                {selectedTable
                  ? tables.find((table) => table === selectedTable)
                  : "Select table..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0 bg-gray-800 border-gray-700">
              <Command>
                <CommandInput placeholder="Search table..." />
                <CommandList>
                  <CommandEmpty>No table found.</CommandEmpty>
                  <CommandGroup>
                    {tables.map((table) => (
                      <CommandItem
                        key={table}
                        value={table}
                        onSelect={(currentValue) => {
                          const newSelectedTable = currentValue === selectedTable ? null : currentValue;
                          setSelectedTable(newSelectedTable);
                          if (newSelectedTable) {
                            fetchTableDetails(newSelectedTable);
                          } else {
                            // Clear details if table is deselected
                            setTableInfo(null);
                            setTableData(null);
                            setEditingCell(null);
                          }
                          setComboboxOpen(false);
                        }}
                        className="text-white hover:bg-gray-700 aria-selected:bg-blue-600"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTable === table ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {table}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      ) : <p>No tables found or unable to load tables.</p>}

      {loadingTableInfo && <p>Loading table structure...</p>}
      {selectedTable && tableInfo && (
        <>
          <h4 className="text-xl font-semibold my-4">Table Structure: {selectedTable}</h4>
          <Table>
            <TableCaption>Structure of table: {selectedTable}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Column ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead>
                <TableHead>Not Null</TableHead><TableHead>Default Value</TableHead><TableHead>Primary Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableInfo.map((col) => (
                <TableRow key={col.cid}>
                  <TableCell>{col.cid}</TableCell><TableCell>{col.name}</TableCell><TableCell>{col.type}</TableCell>
                  <TableCell>{col.notnull ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{col.dflt_value === null ? 'NULL' : col.dflt_value}</TableCell>
                  <TableCell>{col.pk ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {loadingTableData && <p className="mt-4">Loading table data...</p>}
      {selectedTable && tableData && tableInfo && (
         <>
          <h4 className="text-xl font-semibold my-4">Table Data: {selectedTable}</h4>
          {tableData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>Content of table: {selectedTable}. Click a cell to edit (ID column is not editable).</TableCaption>
                <TableHeader>
                  <TableRow>
                    {tableInfo.map(col => <TableHead key={col.name}>{col.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, rowIndex) => (
                    <TableRow key={row.id || rowIndex}> {/* Use row.id if available, otherwise rowIndex */}
                      {tableInfo.map(col => {
                        const isEditingThisCell = editingCell && editingCell.rowIndex === rowIndex && editingCell.columnName === col.name;
                        return (
                          <TableCell 
                            key={`${row.id || rowIndex}-${col.name}`} 
                            onClick={() => !isEditingThisCell && col.name !== 'id' && handleCellClick(rowIndex, col.name, row[col.name], row.id)}
                            className={`${col.name !== 'id' ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" : ""} p-2`}
                          >
                            {isEditingThisCell ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-1 sm:space-y-0 sm:space-x-1">
                                <Input
                                  type="text"
                                  value={editValue}
                                  onChange={handleEditChange}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit();
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                  className="h-8 text-sm bg-white dark:bg-gray-900 border-blue-500 flex-grow"
                                />
                                <div className="flex space-x-1">
                                  <Button onClick={handleSaveEdit} size="sm" className="h-8 px-2 text-xs flex-grow sm:flex-grow-0">Save</Button>
                                  <Button onClick={handleCancelEdit} variant="outline" size="sm" className="h-8 px-2 text-xs flex-grow sm:flex-grow-0">Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              typeof row[col.name] === 'boolean' ? row[col.name].toString() : (row[col.name] === null || row[col.name] === undefined ? <span className="text-gray-500 italic">NULL</span> : row[col.name])
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p>No data in this table.</p>}
        </>
      )}
      
      {selectedTable && !loadingTableInfo && !tableInfo && <p>Could not load structure for {selectedTable}.</p>}
      {selectedTable && !loadingTableData && !tableData && tableInfo && <p>Could not load data for {selectedTable}.</p>}
    </div>
  );
}
