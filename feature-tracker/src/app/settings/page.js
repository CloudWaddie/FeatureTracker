'use client';

import { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [enableBetaUI, setEnableBetaUI] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedPreference = localStorage.getItem('enableBetaUI');
    if (storedPreference) {
      setEnableBetaUI(JSON.parse(storedPreference));
    }
  }, []);

  const handleToggleBetaUI = (checked) => {
    if (isMounted) {
      setEnableBetaUI(checked);
      localStorage.setItem('enableBetaUI', JSON.stringify(checked));
    }
  };

  if (!isMounted) {
    return null; // Or a loading spinner
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-4">
        <div className="flex items-center space-x-2 p-4 border rounded-lg">
          <Switch
            id="beta-ui-toggle"
            checked={enableBetaUI}
            onCheckedChange={handleToggleBetaUI}
          />
          <Label htmlFor="beta-ui-toggle" className="text-lg">
            Enable Beta UI
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Toggle this switch to enable or disable the new Beta User Interface. Changes will apply on your next visit to the main page.
        </p>
      </div>
    </div>
  );
}
