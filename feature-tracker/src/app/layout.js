import "./globals.css";
import { PostHogProvider } from './providers'
import Link from "next/link"; // Keep Link for footer or other direct uses if any
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { GoogleTagManager } from '@next/third-parties/google'
import Navbar from "@/components/Navbar"; // Import the new Navbar component

export const metadata = {
  title: "Feature Tracker",
  description: "Realtime tracking of features added to AI apps",
  other: {
    "google-site-verification": "bURyk-A5z78A9pWZ9G3gylCjZcgses8KXg3fa0ETXcs"
  }
};

export default function RootLayout({ children }) {
  return (
    <SessionProvider>
      <PostHogProvider>
        <html lang="en" className="dark">
          <GoogleTagManager gtmId="GTM-WL7RJ9WG"/>
          <head>
            <link rel="icon" href="/icon.jpg" />
            <link
            rel="alternate"
            type="application/rss+xml"
            title="Feature Tracker"
            href={`${process.env.DOMAIN}/api/rss`}
            />
          </head>
          <body className="bg-black text-white min-h-screen flex flex-col">
            <Navbar /> {/* Use the Navbar component here */}
            <div className="p-4 flex-grow">
              {children}
            </div>
            <footer className="fixed bottom-4 right-4 z-50 hidden sm:flex items-center gap-2 p-3 bg-gray-900 rounded-full shadow-lg">
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
                        Hi! I'm CloudWaddie, a passionate developer and AI enthusiast. I love building tools that make life easier and more fun.
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
      </PostHogProvider>
    </SessionProvider>
  );
}
