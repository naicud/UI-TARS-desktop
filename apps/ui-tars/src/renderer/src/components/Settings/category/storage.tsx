/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { Trash2, Database, RefreshCcw, Image } from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@renderer/components/ui/card';
import { Button } from '@renderer/components/ui/button';
import { sessionManager } from '@renderer/db/session';
import { chatManager } from '@renderer/db/chat';
import { useSetting } from '@renderer/hooks/useSetting';
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
} from '@renderer/components/ui/alert-dialog';

export const StorageSettings = () => {
  const { clearSetting } = useSetting();
  const [usage, setUsage] = useState({
    sessions: 0,
    chats: 0,
    total: 0,
    loading: true,
  });

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const fetchUsage = async () => {
    setUsage((prev) => ({ ...prev, loading: true }));
    try {
      const sessionUsage = await sessionManager.getSessionUsage();
      const chatUsage = await chatManager.getChatUsage();
      setUsage({
        sessions: sessionUsage,
        chats: chatUsage,
        total: sessionUsage + chatUsage,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
      setUsage((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const handleClearScreenshots = async () => {
    try {
      await chatManager.clearAllScreenshots();
      toast.success('Screenshots cleared successfully.');
      await fetchUsage();
    } catch (error) {
      toast.error('Failed to clear screenshots', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleClearChats = async () => {
    try {
      await sessionManager.clearAllSessions();
      await chatManager.clearAllChats();
      toast.success('All chats and screenshots cleared successfully.');
      await fetchUsage();
    } catch (error) {
      toast.error('Failed to clear chats', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleClearAll = async () => {
    try {
      await sessionManager.clearAllSessions();
      await chatManager.clearAllChats();
      await clearSetting();
      toast.success('All data cleared successfully. Application will reload.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast.error('Failed to clear data', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <CardTitle>Storage Management</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchUsage}
            disabled={usage.loading}
          >
            <RefreshCcw
              className={`w-4 h-4 ${usage.loading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
        <CardDescription>
          Manage your local data usage including conversation history and
          screenshots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Total Usage</span>
            <span>{formatBytes(usage.total)}</span>
          </div>
          {/* Custom Progress Bar */}
          <div className="h-4 w-full bg-secondary rounded-full overflow-hidden flex">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{
                width: `${Math.min((usage.chats / (usage.total || 1)) * 100, 100)}%`,
              }}
              title={`Chats & Screenshots: ${formatBytes(usage.chats)}`}
            />
            <div
              className="h-full bg-blue-400 transition-all duration-500 ease-out"
              style={{
                width: `${Math.min((usage.sessions / (usage.total || 1)) * 100, 100)}%`,
              }}
              title={`Session Metadata: ${formatBytes(usage.sessions)}`}
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Screenshots & Chats ({formatBytes(usage.chats)})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Metadata ({formatBytes(usage.sessions)})</span>
            </div>
          </div>
        </div>

        {/* Clear Screenshots Section */}
        <div className="pt-4 border-t flex justify-between items-center bg-amber-50/50 dark:bg-amber-950/30 p-4 rounded-lg">
          <div className="flex gap-3 items-center">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
              <Image className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Clear Only Screenshots
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Remove all screenshots from conversations. Text history is
                preserved.
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                Clear Screenshots
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Screenshots Only?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all screenshots from your
                  conversation history to save space. Your text messages and
                  settings will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearScreenshots}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Yes, Clear Screenshots
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Clear Chats Section */}
        <div className="flex justify-between items-center bg-orange-50/50 dark:bg-orange-950/30 p-4 rounded-lg">
          <div className="flex gap-3 items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
              <Trash2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                Clear Only Chats
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Remove all conversation history (sessions, messages,
                screenshots).
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/50"
              >
                Clear Chats
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Chats?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all conversation sessions and
                  messages. Your application settings (API keys, etc.) will be
                  preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearChats}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Yes, Clear Chats
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Danger Zone - Clear All */}
        <div className="flex justify-between items-center bg-red-50/50 dark:bg-red-950/30 p-4 rounded-lg">
          <div className="flex gap-3 items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                Danger Zone
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                Irreversibly clear all data and reset settings.
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Clear All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your:
                  <ul className="list-disc list-inside mt-2 mb-2">
                    <li>All conversation history and screenshots</li>
                    <li>All session metadata</li>
                    <li>All application settings and API keys</li>
                  </ul>
                  The application will reset to its default state.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Yes, Clear Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};
