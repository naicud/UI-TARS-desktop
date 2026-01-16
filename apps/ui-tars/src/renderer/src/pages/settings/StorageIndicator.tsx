import { useState, useEffect } from 'react';
import { Trash2, Database, HardDrive, RefreshCcw } from 'lucide-react';
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

export function StorageIndicator() {
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

        <div className="pt-4 border-t flex justify-between items-center bg-red-50/50 p-4 rounded-lg">
          <div className="flex gap-3 items-center">
            <div className="p-2 bg-red-100 rounded-full">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">Danger Zone</p>
              <p className="text-xs text-red-700">
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
}
