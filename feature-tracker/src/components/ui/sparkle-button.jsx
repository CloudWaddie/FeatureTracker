"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function SparkleButton({ summary, itemType, itemId }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Sparkles className="h-4 w-4" />
          <span className="sr-only">Show AI Summary</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Summary</DialogTitle>
          <DialogDescription>
            AI-generated summary
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {summary || "No summary available."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
