'use client';

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Info, Settings } from "lucide-react";
import { useFeatureFlagEnabled } from 'posthog-js/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Navbar() {
  const betaUiFeatureEnabled = useFeatureFlagEnabled('beta-ui');

  return (
    <div className="sticky top-0 z-50 flex flex-col min-h-10 border-b border-solid border-white min-w-screen bg-gray-950">
      <div className="flex flex-row justify-between items-center p-4">
        <div>
          <Link href="/">
            <h1 className="text-4xl font-bold">Feature Tracker</h1>
          </Link>
          <div className="flex items-center">
            <p className="text-xs">Realtime tracking of features added to AI apps</p>
            <div className="ml-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-gray-400 hover:text-white transition-colors">
                    <Info className="w-4 h-4 inline-block" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Feature Tracker</AlertDialogTitle>
                    <AlertDialogDescription>
                      This app tracks features added to AI applications in real-time, allowing users to see the latest updates and changes. I spent ages making this, so I really appreciate your support!
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
                        <AccordionItem value="item-4">
                          <AccordionTrigger>What is Polestar explore?</AccordionTrigger>
                          <AccordionContent>
                            Polestar explore is a personal tracker requested by my family to find updates to the Polestar app. You can ignore this...
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
          <NavigationMenuList className="flex flex-row gap-5 items-center">
            {betaUiFeatureEnabled && (
              <NavigationMenuItem>
                <Link href="/settings" legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )}
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
  );
}
