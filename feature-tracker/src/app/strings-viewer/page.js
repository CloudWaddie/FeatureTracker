'use client';

import { useEffect, useState } from 'react';
import { logClientError } from '@/lib/utils';
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
import { Button } from "@/components/ui/button" // Assuming Button component exists
// Monaco Editor
import { Editor } from '@monaco-editor/react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function StringsViewerPage() {
    const [apps, setApps] = useState([]);
    const [selectedAppId, setSelectedAppId] = useState(null); // Changed to store appId
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [xmlData, setXmlData] = useState(''); // State for XML data
    const [fetchError, setFetchError] = useState(null); // State for fetch error
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 768); // Example breakpoint for mobile
        };
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    useEffect(() => {
        const fetchApps = async () => {
            try {
                const response = await fetch('/api/db/getAndroidApps');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                // Assuming data is an array of objects like { appId: "..." }
                setApps(data.map(item => item.appId));
            } catch (error) {
                logClientError("error", "Failed to fetch apps in strings-viewer", { error: error.message, stack: error.stack });
                setFetchError("Failed to load app list. Please try again later.");
            }
        };

        fetchApps();
    }, []);

    useEffect(() => {
        const fetchStrings = async () => {
            if (selectedAppId) {
                setFetchError(null); // Clear previous errors
                try {
                    const response = await fetch(`/api/getStrings?appId=${selectedAppId}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.text(); // Assuming the API returns XML as text
                    setXmlData(data);
                } catch (error) {
                    logClientError("error", `Failed to fetch strings for ${selectedAppId} in strings-viewer`, { error: error.message, stack: error.stack, selectedAppId });
                    setXmlData(''); // Clear data on error
                    setFetchError(`Failed to fetch strings for ${selectedAppId}. This might mean the app does not have a strings file.`);
                }
            } else {
                setXmlData(''); // Clear data if no app is selected
                setFetchError(null); // Clear error if no app is selected
            }
        };

        fetchStrings();
    }, [selectedAppId]);

    return (
        <div className="flex flex-col h-screen p-4"> {/* Changed min-h-screen to h-screen and removed items-center */}
            <h1 className="text-3xl font-bold mb-4">Strings Viewer</h1>
            
            {fetchError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {fetchError}
                    </AlertDescription>
                </Alert>
            )}

            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start">
                        {selectedAppId ? selectedAppId : "Select an App"} 
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search app..." />
                        <CommandList>
                            <CommandEmpty>No apps found.</CommandEmpty>
                            <CommandGroup>
                                {apps.map((appId) => ( // Iterate over appIds
                                    <CommandItem
                                        key={appId} // Use appId as key
                                        value={appId} // Use appId as value
                                        onSelect={() => {
                                            setSelectedAppId(appId); // Store selected appId
                                            setPopoverOpen(false);
                                            logClientError("info", "Selected app ID in strings-viewer", { appId });
                                        }}
                                    >
                                        {appId} {/* Display appId */}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedAppId && !fetchError && (
                <div className="mt-8 p-4 border rounded-md w-full flex-1 flex flex-col min-h-0"> {/* Added min-h-0 */}
                    <Editor
                        height="100%"
                        defaultLanguage="xml"
                        theme='vs-dark'
                        value={xmlData} // Bind editor value to xmlData state
                        options={{
                            readOnly: true, // Make the editor read-only
                            scrollBeyondLastLine: false, // Disable scrolling beyond last line
                            minimap: {
                                enabled: !isMobile
                            }
                        }}
                    />
                </div>
            )}

            {!selectedAppId && apps.length > 0 && (
                 <p className="text-lg mt-8">Select an app to view its strings.</p>
            )}
             {!selectedAppId && apps.length === 0 && (
                 <p className="text-lg mt-8">Loading apps or no apps available.</p>
            )}
        </div>
    );
}
