import "./globals.css";
import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import Image from "next/image";

export const metadata = {
  title: "Feature Tracker",
  description: "Realtime tracking of features added to AI apps",
};

export default function RootLayout({ children }) {
  return (
    <SessionProvider>
      <html lang="en" className="dark">
        <head>
          <link
          rel="alternate"
          type="application/rss+xml"
          title="Feature Tracker"
          href={`${process.env.DOMAIN}/api/rss`}
          />
        </head>
        <body className="bg-black text-white min-h-screen flex flex-col">
          {/* Navbar */}
          <div className="sticky top-0 z-50 flex flex-col min-h-10 border-b border-solid border-white min-w-screen bg-gray-950">
            <div className="flex flex-row justify-between items-center p-4">
              <div>
                <h1 className="text-4xl font-bold">Feature Tracker</h1>
                <p className="text-xs">Realtime tracking of features added to AI apps</p>
              </div>
              <div className="flex flex-row gap-5">
                <Link href="/" className="text-sm mb-1">Home</Link>
                <Link href="/model-checker" className="text-sm">Model Checker</Link>
              </div>
            </div>
          </div>  
          <div className="p-4 flex-grow">
            {children}
          </div>
          <footer className="fixed bottom-4 right-4 z-50 flex items-center gap-2 p-3 bg-gray-900 rounded-full shadow-lg">
            <p className="text-sm text-white">Made with 💚 by</p>
            <HoverCard>
              <HoverCardTrigger asChild>
                <Link href="#" className="text-sm text-white flex items-center gap-2">
                  CloudWaddie
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="/avatar.png" alt="CloudWaddie Avatar" />
                    <AvatarFallback>CW</AvatarFallback>
                  </Avatar>
                </Link>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="flex justify-between space-x-4">
                  <Avatar>
                    <AvatarImage src="/avatar.png" />
                    <AvatarFallback>CW</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">@cloudwaddie</h4>
                    <p className="text-sm">
                      Hi! I&apos;m CloudWaddie, a passionate developer and AI enthusiast. I love building tools that make life easier and more fun.
                    </p>
                    <div className="flex items-center pt-2">
                      <span className="text-xs text-muted-foreground">
                        Check out my <Link href="https://github.com/CloudWaddie" className="underline">GitHub</Link>.
                      </span>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </footer>
          <Toaster />
        </body>
      </html>
    </SessionProvider>
  );
}
