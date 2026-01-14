import { useState } from 'react';
import { Button } from '@renderer/components/ui/button';
import { RefreshCcw, Sun, Moon, Monitor } from 'lucide-react';
import { api } from '@/renderer/src/api';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';

import { REPO_OWNER, REPO_NAME } from '@main/shared/constants';

export const GeneralSettings = () => {
  const { theme, setTheme } = useTheme();
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateDetail, setUpdateDetail] = useState<{
    currentVersion: string;
    version: string;
    link: string | null;
  } | null>();

  const handleCheckForUpdates = async () => {
    setUpdateLoading(true);
    try {
      const detail = await api.checkForUpdatesDetail();
      console.log('detail', detail);

      if (detail.updateInfo) {
        setUpdateDetail({
          currentVersion: detail.currentVersion,
          version: detail.updateInfo.version,
          link: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${detail.updateInfo.version}`,
        });
        return;
      } else if (!detail.isPackaged) {
        toast.info('Unpackaged version does not support update check!');
      } else {
        toast.success('No update available', {
          description: `current version: ${detail.currentVersion} is the latest version`,
          position: 'top-right',
          richColors: true,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Theme Settings */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Theme</label>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                <span>Light</span>
              </div>
            </SelectItem>
            <SelectItem value="dark">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </div>
            </SelectItem>
            <SelectItem value="system">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span>System</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose your preferred color scheme.
        </p>
      </div>

      {/* Update Check */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Updates</label>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={updateLoading}
            onClick={handleCheckForUpdates}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`}
            />
            {updateLoading ? 'Checking...' : 'Check for Updates'}
          </Button>
          {updateDetail?.version && (
            <div className="text-sm text-muted-foreground">
              {`${updateDetail.currentVersion} → ${updateDetail.version} (latest)`}
            </div>
          )}
          {updateDetail?.link && (
            <div className="text-sm text-muted-foreground">
              Release Notes:{' '}
              <a
                href={updateDetail.link}
                target="_blank"
                className="underline text-primary hover:text-primary/80"
                rel="noreferrer"
              >
                View on GitHub
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
