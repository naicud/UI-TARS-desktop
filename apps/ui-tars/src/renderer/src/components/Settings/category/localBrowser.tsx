/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useSetting } from '@renderer/hooks/useSetting';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@renderer/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import {
  SearchEngineForSettings,
  TabCreationStrategy,
} from '@/main/store/types';

import googleIcon from '@resources/icons/google-color.svg?url';
import bingIcon from '@resources/icons/bing-color.svg?url';
import baiduIcon from '@resources/icons/baidu-color.svg?url';

const formSchema = z.object({
  searchEngineForBrowser: z.nativeEnum(SearchEngineForSettings),
  tabCreationStrategy: z.nativeEnum(TabCreationStrategy),
});

/**
 * Descriptions for each tab creation strategy
 */
const TAB_STRATEGY_INFO = {
  [TabCreationStrategy.ALWAYS_REUSE]: {
    label: 'Always Reuse',
    description:
      'Always reuse the same browser tab. Best for predictable navigation without multiple tabs.',
  },
  [TabCreationStrategy.SMART]: {
    label: 'Smart',
    description:
      'Intelligently decides based on URL patterns. Opens new tabs when switching between workspace domains (Gmail, Google Docs, etc.).',
  },
  [TabCreationStrategy.ALWAYS_NEW]: {
    label: 'Always New',
    description:
      'Opens a new tab for each navigation. Use when you need to keep track of visited pages.',
  },
};

export function LocalBrowserSettings() {
  const { settings, updateSetting } = useSetting();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      searchEngineForBrowser: undefined,
      tabCreationStrategy: undefined,
    },
  });

  const [newSearchEngine, newTabStrategy] = form.watch([
    'searchEngineForBrowser',
    'tabCreationStrategy',
  ]);

  useEffect(() => {
    if (Object.keys(settings).length) {
      form.reset({
        searchEngineForBrowser: settings.searchEngineForBrowser,
        tabCreationStrategy:
          settings.tabCreationStrategy ?? TabCreationStrategy.ALWAYS_REUSE,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    if (!Object.keys(settings).length) {
      return;
    }

    const validAndSave = async () => {
      let hasChanges = false;
      const updatedSettings = { ...settings };

      if (
        newSearchEngine !== undefined &&
        newSearchEngine !== settings.searchEngineForBrowser
      ) {
        updatedSettings.searchEngineForBrowser = newSearchEngine;
        hasChanges = true;
      }

      if (
        newTabStrategy !== undefined &&
        newTabStrategy !== settings.tabCreationStrategy
      ) {
        updatedSettings.tabCreationStrategy = newTabStrategy;
        hasChanges = true;
      }

      if (hasChanges) {
        updateSetting(updatedSettings);
      }
    };

    validAndSave();
  }, [newSearchEngine, newTabStrategy, settings, updateSetting]);

  return (
    <>
      <Form {...form}>
        <form className="space-y-6">
          <FormField
            control={form.control}
            name="searchEngineForBrowser"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Search Engine:</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-[124px]">
                      <SelectValue placeholder="Select a search engine" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SearchEngineForSettings.GOOGLE}>
                      <div className="flex items-center gap-2">
                        <img
                          src={googleIcon}
                          alt="Google"
                          className="w-4 h-4"
                        />
                        <span>Google</span>
                      </div>
                    </SelectItem>
                    <SelectItem value={SearchEngineForSettings.BING}>
                      <div className="flex items-center gap-2">
                        <img src={bingIcon} alt="Bing" className="w-4 h-4" />
                        <span>Bing</span>
                      </div>
                    </SelectItem>
                    <SelectItem value={SearchEngineForSettings.BAIDU}>
                      <div className="flex items-center gap-2">
                        <img src={baiduIcon} alt="Baidu" className="w-4 h-4" />
                        <span>Baidu</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tabCreationStrategy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tab Management Strategy:</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select tab strategy" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={TabCreationStrategy.ALWAYS_REUSE}>
                      <div className="flex items-center gap-2">
                        <span>🔄</span>
                        <span>
                          {
                            TAB_STRATEGY_INFO[TabCreationStrategy.ALWAYS_REUSE]
                              .label
                          }
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value={TabCreationStrategy.SMART}>
                      <div className="flex items-center gap-2">
                        <span>🧠</span>
                        <span>
                          {TAB_STRATEGY_INFO[TabCreationStrategy.SMART].label}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value={TabCreationStrategy.ALWAYS_NEW}>
                      <div className="flex items-center gap-2">
                        <span>➕</span>
                        <span>
                          {
                            TAB_STRATEGY_INFO[TabCreationStrategy.ALWAYS_NEW]
                              .label
                          }
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs text-muted-foreground mt-1">
                  {field.value && TAB_STRATEGY_INFO[field.value]?.description}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </>
  );
}
