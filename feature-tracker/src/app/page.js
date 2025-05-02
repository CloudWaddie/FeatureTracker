export default function Page() {
  return (
    <>
      {/* Navbar */}
      <div className="sticky top-0 z-50 flex flex-col min-h-10 border-b border-solid border-white min-w-screen">
        <div className="flex flex-col p-4">
          <h1 className="text-4xl font-bold">Feature Tracker</h1>
          <p className="text-xs">Realtime tracking of features added to AI apps</p>
        </div>
      </div>

      {/* Feed (card grid) orded by most recent */}
      <div className="flex flex-col min-h-screen p-4">
       {/* Placeholder for feed items in cards*/}
       <div className="max-w-6xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 bg-gray-950 rounded shadow border border-solid border-white rounded-xl">
              <h2 className="text-xl font-bold">Gemini App Update</h2>
              <p className="text-sm">Code changed or strings updated</p>
              <p className="text-xs text-gray-500">2025-10-01</p>
            </div>
            {/* Second Card */}
            <div className="p-4 bg-gray-950 rounded shadow border border-solid border-white rounded-xl">
              <h2 className="text-xl font-bold">Gemini 2 App Update</h2>
              <p className="text-sm">Code changed or strings updated 2</p>
              <p className="text-xs text-gray-500">2025-10-01</p>
            </div>
            {/* Add more cards here as needed */}
          </div>
        </div>
      </div>
    </>
  );
}
