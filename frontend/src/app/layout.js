import { Geist, Geist_Mono } from "next/font/google";
import { SupabaseProvider } from './supabase-provider';
import createSupabaseServerClient from './supabase-server';
import Navigation from '../components/Navigation';
import './globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: 'Feature Tracker',
  description: 'Track features for your projects',
};

export default async function RootLayout({ children }) {
  const supabase = await createSupabaseServerClient();
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Read Supabase URL and Key from environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Anon Key in environment variables for RootLayout.");
    // Handle the error appropriately, maybe render an error page or throw
    // For now, just log and potentially let SupabaseProvider handle the error downstream
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SupabaseProvider 
          supabaseUrl={supabaseUrl}
          supabaseKey={supabaseKey}
          initialSession={session}
        >
          <div className="app-container">
            <Navigation />
            <main className="content">
              {children}
            </main>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}
