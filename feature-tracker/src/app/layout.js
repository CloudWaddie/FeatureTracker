import "./globals.css";

export const metadata = {
  title: "Feature Tracker",
  description: "Realtime tracking of features added to AI apps",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
        rel="alternate"
        type="application/rss+xml"
        title="Feature Tracker"
        href={`${process.env.DOMAIN}/api/rss`}
        />
      </head>
      <body className="bg-black text-white min-h-screen">
        {/* Navbar */}
        <div className="sticky top-0 z-50 flex flex-col min-h-10 border-b border-solid border-white min-w-screen bg-gray-950">
          <div className="flex flex-row justify-between items-center p-4">
            <div>
              <h1 className="text-4xl font-bold">Feature Tracker</h1>
              <p className="text-xs">Realtime tracking of features added to AI apps</p>
            </div>
            <div className="flex flex-row gap-5">
              <a href="/" className="text-sm mb-1">Home</a>
              <a href="/model-checker" className="text-sm">Model Checker</a>
            </div>
          </div>
        </div>  
        <div className="p-4">
          {children}
        </div>
      </body>
    </html>
  );
}
