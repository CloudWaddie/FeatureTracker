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
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { GoogleTagManager } from '@next/third-parties/google'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Info } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


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
          {/* Navbar */}
          <div className="sticky top-0 z-50 flex flex-col min-h-10 border-b border-solid border-white min-w-screen bg-gray-950">
            <div className="flex flex-row justify-between items-center p-4">
              <div>
                <Link href="/">
                  <h1 className="text-4xl font-bold">Feature Tracker</h1>
                </Link>
                <div className="flex items-center"> {/* Align subtitle and icon */}
                  <p className="text-xs">Realtime tracking of features added to AI apps</p>
                  {/* Little info icon yay - positioned to the right of the subtitle */}
                  <div className="ml-2"> {/* Add a small margin to the left of the icon */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="text-gray-400 hover:text-white transition-colors">
                          <Info className="w-4 h-4 inline-block" /> {/* Adjusted size slightly */}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Feature Tracker</AlertDialogTitle>
                          <AlertDialogDescription>
                            This app tracks features added to AI applications in real-time, allowing users to see the latest updates and changes. I spent ages making this, so I really appreciate your support!
                            { /* Have a nice little accordion */ }
                            <Accordion type="single" collapsible className="mt-4">
                              <AccordionItem value="item-1">
                                <AccordionTrigger>Why did I make this?</AccordionTrigger>
                                <AccordionContent>
                                  I made this app to help developers and users keep track of the features being added to AI applications. It provides a simple and effective way to see what&apos;s new and what has changed in real-time.
                                </AccordionContent>
                              </AccordionItem>
                              <AccordionItem value="item-2">
                                <AccordionTrigger>How does it work?</AccordionTrigger>
                                <AccordionContent>
                                  The app uses a combination of web scraping and API calls to gather data from various AI applications. It then processes this data and displays it in a user-friendly format, allowing users to easily see the latest features and updates.
                                </AccordionContent>
                              </AccordionItem>
                              <AccordionItem value="item-3">
                                <AccordionTrigger>Do you have an RSS feed?</AccordionTrigger>
                                <AccordionContent>
                                  Yes, we do! You can subscribe to our RSS feed to get the latest updates directly in your feed reader. <Link href="/api/rss" className="text-blue-500 underline">Click here to view the RSS feed</Link>.
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Close</AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
              <NavigationMenu>
                <NavigationMenuList className="flex flex-row gap-5">
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Models</NavigationMenuTrigger>
                    <NavigationMenuContent align="end">
                      <ul className="grid gap-3 p-4">
                        <li>
                          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                            <Link href="/model-checker">
                              Model Checker
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()}`}>
                            <Link href="/leaderboard-viewer">
                              Leaderboard Viewer
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Apps</NavigationMenuTrigger>
                    <NavigationMenuContent align="end">
                      <ul className="grid gap-3 p-4">
                        <li>
                          <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()}`}>
                            <Link href="/strings-viewer">
                              Strings Viewer
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>  
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
