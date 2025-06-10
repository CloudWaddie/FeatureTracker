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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function ModelChecker() {
    const [models, setModels] = useState([]);
    const [allFetchedModels, setAllFetchedModels] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showMoreInfo, setShowMoreInfo] = useState(false);
    const [dataSource, setDataSource] = useState('lmarena'); // 'lmarena' or 'gemini'
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        async function fetchModelsData() {
            setIsLoading(true);
            let endpoint = '/api/db/getModels'; // Default to LMArena (existing models table)
            if (dataSource === 'gemini') {
                endpoint = '/api/db/getGeminiApiModels';
            }
            try {
                const response = await fetch(endpoint);
                if (!response.ok) {
                    throw new Error(`Network response was not ok from ${endpoint}`);
                }
                const data = await response.json();
                const sortedData = Array.isArray(data) ? data.sort((a, b) => (a.name || '').localeCompare(b.name || '')) : [];
                setAllFetchedModels(sortedData);
                setModels(sortedData);
            } catch (error) {
                console.error("Failed to fetch models:", error);
                setAllFetchedModels([]);
                setModels([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchModelsData();
    }, [dataSource]); // Refetch when dataSource changes

    const handleDataSourceChange = (value) => {
        setDataSource(value);
        setSearchTerm(''); // Clear search term when changing data source
    };

    const handleSearchTermChange = (e) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);

        if (newSearchTerm === '') {
            setModels(allFetchedModels.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } else {
            const lowerCaseSearchTerm = newSearchTerm.toLowerCase();
            const filtered = allFetchedModels.filter(model => {
                if (typeof model === 'object' && model !== null) {
                    return Object.values(model).some(value =>
                        String(value).toLowerCase().includes(lowerCaseSearchTerm)
                    );
                }
                return false;
            });
            setModels(filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        }
    };

    const geminiSpecificHeaders = [
        { key: 'version', label: 'Version' },
        { key: 'description', label: 'Description' },
        { key: 'inputTokenLimit', label: 'Input Tokens' },
        { key: 'outputTokenLimit', label: 'Output Tokens' },
        { key: 'supportedGenerationMethods', label: 'Gen Methods' },
        { key: 'temperature', label: 'Temp' },
        { key: 'topP', label: 'Top P' },
        { key: 'topK', label: 'Top K' },
    ];

    return (
        <div className="flex flex-col items-center justify-start min-h-screen pt-10 px-4">
            <h1 className="text-4xl font-bold mb-4">Model Checker</h1>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4 w-full max-w-md">
                <div className="flex-1">
                    <Label htmlFor="dataSourceSelect" className="mb-1 block text-sm font-medium">Data Source</Label>
                    <Select value={dataSource} onValueChange={handleDataSourceChange}>
                        <SelectTrigger id="dataSourceSelect">
                            <SelectValue placeholder="Select data source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="lmarena">LMArena Models</SelectItem>
                            <SelectItem value="gemini">Gemini API Models</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1">
                    <Label htmlFor="modelSearchInput" className="mb-1 block text-sm font-medium">Search Model</Label>
                    <Input
                        id="modelSearchInput"
                        type="text"
                        placeholder="Enter model name or keyword"
                        className="border border-gray-300 rounded p-2 w-full"
                        value={searchTerm}
                        onChange={handleSearchTermChange}
                    />
                </div>
            </div>

            <div className="flex items-center mb-4">
                <input
                    type="checkbox"
                    id="showMoreInfo"
                    checked={showMoreInfo}
                    onChange={(e) => setShowMoreInfo(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="showMoreInfo" className="text-sm font-medium text-gray-700">Show advanced info</label>
            </div>

            {isLoading && <p className="mt-6 text-gray-600">Loading models...</p>}

            {!isLoading && models.length > 0 && (
                <div className="w-full mt-6 mx-auto overflow-x-auto">
                    <h2 className="text-2xl font-semibold mb-3 text-center">Search Results</h2>
                    <Table>
                        <TableCaption>{models.length} model(s) found.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                {dataSource === 'lmarena' && <TableHead>Provider</TableHead>}
                                <TableHead>ID</TableHead>
                                {showMoreInfo && dataSource === 'lmarena' && <TableHead>Model API ID</TableHead>}
                                {showMoreInfo && dataSource === 'lmarena' && <TableHead>Public ID</TableHead>}
                                {showMoreInfo && dataSource === 'lmarena' &&  <TableHead>Provider ID</TableHead>}
                                {showMoreInfo && <TableHead>Multi Modal</TableHead>}
                                {showMoreInfo && dataSource === 'lmarena' &&  <TableHead>Supports Structured Output</TableHead>}
                                {showMoreInfo && dataSource === 'lmarena' &&  <TableHead>Base Sample Weight</TableHead>}
                                {showMoreInfo && dataSource === 'lmarena' && <TableHead>Is Private</TableHead>}
                                {showMoreInfo && dataSource === 'lmarena' && <TableHead>New Model</TableHead>}
                                {showMoreInfo && dataSource === 'gemini' && geminiSpecificHeaders.map(header => (
                                    <TableHead key={header.key}>{header.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {models.map((model, index) => (
                                <TableRow key={model.id || model.name || `model-${index}`}>
                                    <TableCell>{model.name || 'N/A'}</TableCell>
                                    {dataSource === 'lmarena' && <TableCell>{model.provider || 'N/A'}</TableCell>}
                                    <TableCell>{model.id || 'N/A'}</TableCell>
                                    {showMoreInfo && dataSource === 'lmarena' && <TableCell>{model.modelApiId || 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'lmarena' && <TableCell>{model.publicId || 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'lmarena' &&  <TableCell>{model.providerId || 'N/A'}</TableCell>}
                                    {showMoreInfo && <TableCell>{typeof model.multiModal === 'boolean' ? (model.multiModal ? 'Yes' : 'No') : 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'lmarena' &&  <TableCell>{typeof model.supportsStructuredOutput === 'boolean' ? (model.supportsStructuredOutput ? 'Yes' : 'No') : 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'lmarena' && <TableCell>{model.baseSampleWeight || 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'lmarena' && <TableCell>{typeof model.isPrivate === 'boolean' ? (model.isPrivate ? 'Yes' : 'No') : 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'lmarena' && <TableCell>{typeof model.newModel === 'boolean' ? (model.newModel ? 'Yes' : 'No') : 'N/A'}</TableCell>}
                                    {showMoreInfo && dataSource === 'gemini' && geminiSpecificHeaders.map(header => (
                                        <TableCell key={header.key}>
                                            {Array.isArray(model[header.key]) ? model[header.key].join(', ') : (model[header.key] !== undefined && model[header.key] !== null ? String(model[header.key]) : 'N/A')}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {!isLoading && models.length === 0 && searchTerm && (
                 <p className="mt-6 text-gray-600">No models found matching your search term.</p>
            )}
            {!isLoading && models.length === 0 && !searchTerm && (
                 <p className="mt-6 text-gray-600">No models available for the selected source.</p>
            )}
        </div>
    );
}
