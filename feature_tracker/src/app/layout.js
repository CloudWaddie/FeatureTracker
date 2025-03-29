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

  const supabaseUrl = 'https://mccbekclrcnckrzfdoza.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2Jla2NscmNuY2tyemZkb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNDczNDAsImV4cCI6MjA1ODcyMzM0MH0.7HSl_zdjOrfcQFLFYFES-t0KGaK2zRAnt1MDP3_Dpqk';

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