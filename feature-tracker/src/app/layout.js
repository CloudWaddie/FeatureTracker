import "./globals.css";

export const metadata = {
  title: "Feature Tracker",
  description: "Realtime tracking of features added to AI apps",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
        rel="alternate"
        type="application/rss+xml"
        title="Feature Tracker"
        href=`${process.env.DOMAIN}/api/rss`
        />
      </head>
      <body>
        {/* Navbar */}
        <div className="sticky top-0 z-50 flex flex-col min-h-10 border-b border-solid border-white min-w-screen">
          <div className="flex flex-col p-4">
            <h1 className="text-4xl font-bold">Feature Tracker</h1>
            <p className="text-xs">Realtime tracking of features added to AI apps</p>
          </div>
        </div>
        <div className="p-4">
          {children}
        </div>
      </body>
    </html>
  );
}
