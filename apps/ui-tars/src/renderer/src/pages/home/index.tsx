/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Info } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@renderer/components/ui/card';
import { Button } from '@renderer/components/ui/button';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';

import { Operator } from '@main/store/types';
import { useSession } from '../../hooks/useSession';
import {
  checkVLMSettings,
  LocalSettingsDialog,
} from '@renderer/components/Settings/local';

import computerUseImg from '@resources/home_img/computer_use.png?url';
import browserUseImg from '@resources/home_img/browser_use.png?url';
import { HYBRID_OPERATOR } from '@renderer/const'; // Import constant
import { sleep } from '@ui-tars/shared/utils';

import { FreeTrialDialog } from '../../components/AlertDialog/freeTrialDialog';
import { DragArea } from '../../components/Common/drag';
import { OPERATOR_URL_MAP } from '../../const';

const Home = () => {
  const navigate = useNavigate();
  const { createSession } = useSession();
  const [localConfig, setLocalConfig] = useState({
    open: false,
    operator: Operator.LocalComputer,
  });
  const [remoteConfig, setRemoteConfig] = useState({
    open: false,
    operator: Operator.RemoteComputer,
  });

  const toRemoteComputer = async (value: 'free' | 'paid') => {
    console.log('toRemoteComputer', value);
    const session = await createSession('New Session', {
      operator: Operator.RemoteComputer,
      isFree: value === 'free',
    });

    if (value === 'free') {
      navigate('/free-remote', {
        state: {
          operator: Operator.RemoteComputer,
          sessionId: session?.id,
          isFree: true,
          from: 'home',
        },
      });

      return;
    }

    navigate('/paid-remote', {
      state: {
        operator: Operator.RemoteComputer,
        sessionId: session?.id,
        isFree: false,
        from: 'home',
      },
    });
  };

  const toRemoteBrowser = async (value: 'free' | 'paid') => {
    console.log('toRemoteBrowser', value);

    const session = await createSession('New Session', {
      operator: Operator.RemoteBrowser,
      isFree: value === 'free',
    });

    if (value === 'free') {
      navigate('/free-remote', {
        state: {
          operator: Operator.RemoteBrowser,
          sessionId: session?.id,
          isFree: true,
          from: 'home',
        },
      });
      return;
    }

    navigate('/paid-remote', {
      state: {
        operator: Operator.RemoteBrowser,
        sessionId: session?.id,
        isFree: false,
        from: 'home',
      },
    });
  };

  /** local click logic start */
  const toLocal = async (operator: Operator) => {
    const session = await createSession('New Session', {
      operator: operator,
    });

    navigate('/local', {
      state: {
        operator: operator,
        sessionId: session?.id,
        from: 'home',
      },
    });
  };

  const handleLocalPress = async (operator: Operator) => {
    const hasVLM = await checkVLMSettings();

    if (hasVLM) {
      toLocal(operator);
    } else {
      setLocalConfig({ open: true, operator: operator });
    }
  };

  const handleFreeDialogComfirm = async () => {
    if (remoteConfig.operator === Operator.RemoteBrowser) {
      toRemoteBrowser('free');
    } else {
      toRemoteComputer('free');
    }
  };

  const handleRemoteDialogClose = (status: boolean) => {
    setRemoteConfig({ open: status, operator: remoteConfig.operator });
  };

  const handleLocalSettingsSubmit = async () => {
    setLocalConfig({ open: false, operator: localConfig.operator });

    await sleep(200);

    await toLocal(localConfig.operator);
  };

  const handleLocalSettingsClose = () => {
    setLocalConfig({ open: false, operator: localConfig.operator });
  };
  /** local click logic end */

  return (
    <div className="w-full h-full flex flex-col">
      <DragArea></DragArea>
      <div className="w-full h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold mt-1 mb-8">
          Welcome to Jarvis Desktop
        </h1>
        <Alert className="mb-4 w-[960px]">
          {' '}
          {/* Increased width to fit 3 cards */}
          <Info className="h-4 w-4 mt-2" />
          <AlertDescription>
            <div className="flex items-center">
              <p className="text-sm text-muted-foreground">
                You can also experience the remote versions on Volcano
                Engine:&nbsp;
              </p>
              <Button
                variant="link"
                className="p-0 text-blue-500 hover:text-blue-600 hover:underline cursor-pointer"
                onClick={() =>
                  window.open(
                    OPERATOR_URL_MAP[Operator.RemoteComputer].url,
                    '_blank',
                  )
                }
              >
                Computer Operator
              </Button>
              <span>&nbsp;and&nbsp;</span>
              <Button
                variant="link"
                className="p-0 text-blue-500 hover:text-blue-600 hover:underline cursor-pointer"
                onClick={() =>
                  window.open(
                    OPERATOR_URL_MAP[Operator.RemoteBrowser].url,
                    '_blank',
                  )
                }
              >
                Browser Operator
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        <div className="flex gap-6">
          <Card className="w-[300px] py-5">
            <CardHeader className="px-5">
              <CardTitle>Computer Operator</CardTitle>
              <CardDescription>
                Use Jarvis to automate and complete tasks directly on your
                computer.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <img
                src={computerUseImg}
                alt="Computer Use"
                className="w-full h-full aspect-video object-fill rounded-lg"
              />
            </CardContent>
            <CardFooter className="gap-3 px-5 flex justify-between">
              <Button
                onClick={() => handleLocalPress(Operator.LocalComputer)}
                className="w-full"
              >
                Use Local Computer
              </Button>
            </CardFooter>
          </Card>

          <Card className="w-[300px] py-5 border-primary/50 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl-md z-10">
              Recommended
            </div>
            <CardHeader className="px-5">
              <CardTitle>{HYBRID_OPERATOR}</CardTitle>
              <CardDescription>
                Automatically switches between Computer and Browser modes for
                best performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <img
                src={computerUseImg} // Reusing image for now
                alt="Hybrid Mode"
                className="w-full h-full aspect-video object-fill rounded-lg grayscale-[0.3] hover:grayscale-0 transition-all"
              />
            </CardContent>
            <CardFooter className="gap-3 px-5 flex justify-between">
              <Button
                onClick={() => handleLocalPress(Operator.Hybrid)}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
              >
                Use Hybrid (Auto)
              </Button>
            </CardFooter>
          </Card>

          <Card className="w-[300px] py-5">
            <CardHeader className="px-5">
              <CardTitle>Browser Operator</CardTitle>
              <CardDescription>
                Let Jarvis help you automate browser tasks, from pages to forms.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <img
                src={browserUseImg}
                alt="Browser Use"
                className="w-full h-full aspect-video object-fill rounded-lg"
              />
            </CardContent>
            <CardFooter className="gap-3 px-5 flex justify-between">
              <Button
                onClick={() => handleLocalPress(Operator.LocalBrowser)}
                className="w-full"
              >
                Use Local Browser
              </Button>
            </CardFooter>
          </Card>
        </div>
        <LocalSettingsDialog
          isOpen={localConfig.open}
          onSubmit={handleLocalSettingsSubmit}
          onClose={handleLocalSettingsClose}
        />
        <FreeTrialDialog
          open={remoteConfig.open}
          onOpenChange={handleRemoteDialogClose}
          onConfirm={handleFreeDialogComfirm}
        />
      </div>
      <DragArea></DragArea>
    </div>
  );
};

export default Home;
