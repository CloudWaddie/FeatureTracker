'use client'

import { useState, useEffect, useMemo } from 'react';
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

const API_ENDPOINTS = {
    lmarena: '/api/db/getModels',
    gemini: '/api/db/getGeminiApiModels',
    chatgpt: '/api/db/getChatgptApiModels',
    anthropic: '/api/db/getAnthropicApiModels',
    deepseek: '/api/db/getDeepseekApiModels',
};

// FIELD_HEADER_MAP: Maps raw API field names to display properties
// header: Human-readable column title
// isAdvanced: Boolean, true if column should only be shown when 'showMoreInfo' is checked
const FIELD_HEADER_MAP = {
    // LMArena specific (assuming current structure)
    'name': { header: 'Name', isAdvanced: false }, // Note: Gemini raw 'name' is different, 'displayName' is better
    'provider': { header: 'Provider', isAdvanced: false },
    'id': { header: 'ID', isAdvanced: false }, // Common, but LMArena 'id' might be different from API 'id'
    'modelApiId': { header: 'Model API ID', isAdvanced: true },
    'publicId': { header: 'Public ID', isAdvanced: true },
    'providerId': { header: 'Provider ID', isAdvanced: true },
    'multiModal': { header: 'Multi Modal', isAdvanced: true },
    'supportsStructuredOutput': { header: 'Supports Structured Output', isAdvanced: true },
    'baseSampleWeight': { header: 'Base Sample Weight', isAdvanced: true },
    'isPrivate': { header: 'Is Private', isAdvanced: true },
    'newModel': { header: 'New Model', isAdvanced: true },

    // Gemini specific (from raw API structure)
    // 'name' from Gemini raw is like "models/gemini-pro" - might prefer 'displayName'
    'displayName': { header: 'Display Name', isAdvanced: false },
    'version': { header: 'Version', isAdvanced: false },
    'description': { header: 'Description', isAdvanced: true },
    'inputTokenLimit': { header: 'Input Tokens', isAdvanced: true },
    'outputTokenLimit': { header: 'Output Tokens', isAdvanced: true },
    'supportedGenerationMethods': { header: 'Gen Methods', isAdvanced: true },
    'temperature': { header: 'Temp', isAdvanced: true },
    'topP': { header: 'Top P', isAdvanced: true },
    'topK': { header: 'Top K', isAdvanced: true },

    // Anthropic specific
    'display_name': { header: 'Name', isAdvanced: false }, // Map to 'Name' for consistency
    'created_at': { header: 'Created At', isAdvanced: true },
    // 'id' is common, 'type' might be advanced if needed: { header: 'Type', isAdvanced: true},

    // OpenAI & Deepseek specific
    'owned_by': { header: 'Owned By', isAdvanced: true },
    'created': { header: 'Created Timestamp', isAdvanced: true } // OpenAI
    // 'object': { header: 'Object Type', isAdvanced: true } // e.g. "model", "list"
};


export default function ModelChecker() {
    const [models, setModels] = useState([]);
    const [allFetchedModels, setAllFetchedModels] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showMoreInfo, setShowMoreInfo] = useState(false);
    const [dataSource, setDataSource] = useState('lmarena');
    const [isLoading, setIsLoading] = useState(false);
    const [activeColumnHeaders, setActiveColumnHeaders] = useState([]);

    useEffect(() => {
        async function fetchModelsData() {
            setIsLoading(true);
            setModels([]);
            setAllFetchedModels([]);
            setActiveColumnHeaders([]);

            const endpoint = API_ENDPOINTS[dataSource] || '/api/db/getModels';
            try {
                const response = await fetch(endpoint);
                if (!response.ok) {
                    throw new Error(`Network response was not ok from ${endpoint}`);
                }
                const data = await response.json();
                
                if (Array.isArray(data) && data.length > 0) {
                    // Determine column headers from the first item, maintaining its order
                    const firstItemKeys = Object.keys(data[0]);
                    setActiveColumnHeaders(firstItemKeys);

                    // Sort data by 'name', 'displayName', or 'id' if available
                    const sortedData = [...data].sort((a, b) => {
                        const nameA = a.name || a.displayName || a.display_name || a.id || '';
                        const nameB = b.name || b.displayName || b.display_name || b.id || '';
                        return String(nameA).localeCompare(String(nameB));
                    });
                    setAllFetchedModels(sortedData);
                    setModels(sortedData);
                } else {
                    setAllFetchedModels([]);
                    setModels([]);
                }
            } catch (error) {
                console.error("Failed to fetch models:", error);
                setAllFetchedModels([]);
                setModels([]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchModelsData();
    }, [dataSource]);

    const handleDataSourceChange = (value) => {
        setDataSource(value);
        setSearchTerm('');
    };

    const handleSearchTermChange = (e) => {
        const newSearchTerm = e.target.value;
        setSearchTerm(newSearchTerm);

        if (newSearchTerm === '') {
            setModels(allFetchedModels);
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
            setModels(filtered);
        }
    };
    
    const visibleColumnHeaders = useMemo(() => {
        if (!showMoreInfo) {
            return activeColumnHeaders.filter(key => !FIELD_HEADER_MAP[key]?.isAdvanced);
        }
        return activeColumnHeaders;
    }, [activeColumnHeaders, showMoreInfo]);

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
                            <SelectItem value="chatgpt">ChatGPT API Models</SelectItem>
                            <SelectItem value="anthropic">Anthropic API Models</SelectItem>
                            <SelectItem value="deepseek">Deepseek API Models</SelectItem>
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

            {!isLoading && models.length > 0 && visibleColumnHeaders.length > 0 && (
                <div className="w-full mt-6 mx-auto overflow-x-auto">
                    <h2 className="text-2xl font-semibold mb-3 text-center">Search Results</h2>
                    <Table>
                        <TableCaption>{models.length} model(s) found.</TableCaption>
                        <TableHeader>
                            <TableRow>
                                {visibleColumnHeaders.map(key => (
                                    <TableHead key={key}>
                                        {FIELD_HEADER_MAP[key]?.header || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {models.map((model, index) => (
                                <TableRow key={model.id || model.name || `model-${index}-${dataSource}`}>
                                    {visibleColumnHeaders.map(key => (
                                        <TableCell key={`${key}-${index}`}>
                                            {Array.isArray(model[key]) ? model[key].join(', ') : (model[key] !== undefined && model[key] !== null ? String(model[key]) : 'N/A')}
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
            {!isLoading && (models.length === 0 || visibleColumnHeaders.length === 0) && !searchTerm && (
                 <p className="mt-6 text-gray-600">No models or displayable columns available for the selected source.</p>
            )}
        </div>
    );
}
