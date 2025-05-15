'use client'

import { useState, useEffect } from 'react';

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
                console.error('Error fetching initial models:', error);
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
                <input
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
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-700 rounded shadow">
                            <thead className="bg-gray-900 text-white">
                            <tr>
                                <th className="py-2 px-4 border-b text-left">ID</th>
                                <th className="py-2 px-4 border-b text-left">Name</th>
                                <th className="py-2 px-4 border-b text-left">Provider</th>
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Model API ID</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Public ID</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Provider ID</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Multi Modal</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Supports Structured Output</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Base Sample Weight</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">Is Private</th>}
                                {showMoreInfo && <th className="py-2 px-4 border-b text-left">New Model</th>}
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {models.map((model) => (
                                <tr key={model.id} className="bg-gray-600 hover:bg-gray-700">
                                    <td className="py-2 px-4 border-b">{model.id}</td>
                                    <td className="py-2 px-4 border-b">{model.name}</td>
                                    <td className="py-2 px-4 border-b">{model.provider}</td>
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.modelApiId}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.publicId}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.providerId}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.multiModal ? 'Yes' : 'No'}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.supportsStructuredOutput ? 'Yes' : 'No'}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.baseSampleWeight}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.isPrivate ? 'Yes' : 'No'}</td>}
                                    {showMoreInfo && <td className="py-2 px-4 border-b">{model.newModel ? 'Yes' : 'No'}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}
            {models.length === 0 && searchTerm && (
                 <p className="mt-6 text-gray-600">No models found matching your search term.</p>
            )}
        </div>
    );
}
