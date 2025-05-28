'use client'

import { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function ModelChecker() {
    const [models, setModels] = useState([]);
    const [allFetchedModels, setAllFetchedModels] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showMoreInfo, setShowMoreInfo] = useState(false);

    useEffect(() => {
        async function fetchInitialModels() {
            try {
                const response = await fetch('/api/db/getModels');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                const sortedData = data.sort((a, b) => a.name.localeCompare(b.name));
                setAllFetchedModels(sortedData);
                setModels(sortedData); // Initialize displayed models
            } catch (error) {
                setAllFetchedModels([]);
                setModels([]);
            }
        }
        fetchInitialModels();
    }, []); // Runs once on mount

    const handleSearchTermChange = (e) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);

        if (newSearchTerm === '') {
            setModels(allFetchedModels.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
            const lowerCaseSearchTerm = newSearchTerm.toLowerCase();
            const filtered = allFetchedModels.filter(model => {
                return Object.values(model).some(value =>
                    String(value).toLowerCase().includes(lowerCaseSearchTerm)
                );
            });
            setModels(filtered.sort((a, b) => a.name.localeCompare(b.name)));
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-screen pt-10">
            <h1 className="text-4xl font-bold mb-4">Model Checker</h1>
            <p className="mb-4">Search for a model by name.</p>
            <div className="mb-4">
                <Input
                    type="text"
                    placeholder="Enter model name"
                    className="border border-gray-300 rounded p-2"
                    value={searchTerm}
                    onChange={handleSearchTermChange}
                />
            </div>

            <div className="flex items-center mb-4">
                <input
                    type="checkbox"
                    id="showMoreInfo"
                    checked={showMoreInfo}
                    onChange={(e) => setShowMoreInfo(e.target.checked)}
                    className="mr-2"
                />
                <label htmlFor="showMoreInfo" className="text-sm">Show advanced info</label>
            </div>

            {models.length > 0 && (
                <div className="w-full mt-6 mx-auto">
                    <h2 className="text-2xl font-semibold mb-3 text-center">Search Results</h2>
                    <Table>
                        <TableCaption>{models.length} model(s) found.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Provider</TableHead>
                                {showMoreInfo && <TableHead>Model API ID</TableHead>}
                                {showMoreInfo && <TableHead>Public ID</TableHead>}
                                {showMoreInfo && <TableHead>Provider ID</TableHead>}
                                {showMoreInfo && <TableHead>Multi Modal</TableHead>}
                                {showMoreInfo && <TableHead>Supports Structured Output</TableHead>}
                                {showMoreInfo && <TableHead>Base Sample Weight</TableHead>}
                                {showMoreInfo && <TableHead>Is Private</TableHead>}
                                {showMoreInfo && <TableHead>New Model</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {models.map((model) => (
                                <TableRow key={model.id}>
                                    <TableCell>{model.id}</TableCell>
                                    <TableCell>{model.name}</TableCell>
                                    <TableCell>{model.provider}</TableCell>
                                    {showMoreInfo && <TableCell>{model.modelApiId}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.publicId}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.providerId}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.multiModal ? 'Yes' : 'No'}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.supportsStructuredOutput ? 'Yes' : 'No'}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.baseSampleWeight}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.isPrivate ? 'Yes' : 'No'}</TableCell>}
                                    {showMoreInfo && <TableCell>{model.newModel ? 'Yes' : 'No'}</TableCell>}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {models.length === 0 && searchTerm && (
                 <p className="mt-6 text-gray-600">No models found matching your search term.</p>
            )}
        </div>
    );
}
