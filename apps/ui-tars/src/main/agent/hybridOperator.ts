/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  type ScreenshotOutput,
  type ExecuteParams,
  type ExecuteOutput,
  Operator as BaseOperator,
} from '@ui-tars/sdk/core';
import { StatusEnum } from '@ui-tars/shared/types';
import { NutJSElectronOperator } from './operator';
import { DefaultBrowserOperator } from '@ui-tars/operator-browser';
import { SearchEngine } from '@ui-tars/operator-browser/dist/types';
import { logger } from '@main/logger';

/**
 * HybridOperator combines Computer Use and Browser Use capabilities.
 *
 * Strategy:
 * - Uses Computer Use (NutJS) as the primary operator for full OS visibility
 * - Dynamically activates Browser Use for web-specific actions when detected
 * - Provides additional high-level browser actions as "skills"
 */
export class HybridOperator implements BaseOperator {
  private computerOperator: NutJSElectronOperator;
  private browserOperator: DefaultBrowserOperator | null = null;
  private browserSessionActive = false;
  private browserAvailable = false;
  private lastScreenParams: {
    screenWidth: number;
    screenHeight: number;
    scaleFactor: number;
  } | null = null;

  /**
   * Extended action spaces combining both Computer and Browser capabilities
   */
  static MANUAL = {
    ACTION_SPACES: [
      // Base Computer Use actions
      ...NutJSElectronOperator.MANUAL.ACTION_SPACES,
      // Extended Browser-aware actions
      `open_browser(url='') # Opens a high-fidelity browser session for complex web tasks. Use this when you need precise web interaction.`,
      `close_browser() # Closes the browser session and returns to computer-only mode.`,
    ],
  };

  /**
   * Actions that are compatible with browser execution
   * Extracted as constant for easy extensibility (OCP - Open/Closed Principle)
   */
  private static readonly BROWSER_COMPATIBLE_ACTIONS = [
    'click',
    'type',
    'scroll',
    'navigate',
    'navigate_back',
    'left_double',
    'right_single',
  ] as const;

  constructor() {
    this.computerOperator = new NutJSElectronOperator();
    logger.info('[HybridOperator] Initialized with computer operator');
  }

  /**
   * Initialize browser capabilities lazily
   */
  private async ensureBrowserOperator(): Promise<DefaultBrowserOperator | null> {
    if (this.browserOperator) {
      return this.browserOperator;
    }

    try {
      this.browserAvailable = DefaultBrowserOperator.hasBrowser();
      if (!this.browserAvailable) {
        logger.warn('[HybridOperator] Browser not available on this system');
        return null;
      }

      this.browserOperator = await DefaultBrowserOperator.getInstance(
        false, // highlight
        false, // showActionInfo
        false, // showWaterFlow
        false, // isCallUser
        SearchEngine.GOOGLE, // searchEngine
        'always_reuse', // tabCreationStrategy
      );

      logger.info('[HybridOperator] Browser operator initialized');
      return this.browserOperator;
    } catch (error) {
      logger.error(
        '[HybridOperator] Failed to initialize browser operator:',
        error,
      );
      return null;
    }
  }

  /**
   * Takes a screenshot using the appropriate operator
   * When browser session is active, captures browser viewport
   * Otherwise captures full screen via Computer Use
   */
  async screenshot(): Promise<ScreenshotOutput> {
    if (this.browserSessionActive && this.browserOperator) {
      try {
        logger.info('[HybridOperator] Taking browser screenshot');
        return await this.browserOperator.screenshot();
      } catch (error) {
        logger.warn(
          '[HybridOperator] Browser screenshot failed, falling back to computer:',
          error,
        );
      }
    }

    // Default: full screen capture via Computer Use
    logger.info('[HybridOperator] Taking computer screenshot');
    return await this.computerOperator.screenshot();
  }

  /**
   * Execute an action using the appropriate operator
   */
  async execute(params: ExecuteParams): Promise<ExecuteOutput> {
    const { action_type, action_inputs } = params.parsedPrediction;

    // Store screen params for use in open_browser navigation
    this.lastScreenParams = {
      screenWidth: params.screenWidth,
      screenHeight: params.screenHeight,
      scaleFactor: params.scaleFactor,
    };

    logger.info(
      '[HybridOperator] Executing action:',
      action_type,
      action_inputs,
    );

    // Handle hybrid-specific actions
    switch (action_type) {
      case 'open_browser':
        return await this.handleOpenBrowser(action_inputs);

      case 'close_browser':
        return await this.handleCloseBrowser();

      case 'navigate':
      case 'navigate_back':
        // If we have an active browser session, use it
        if (this.browserSessionActive && this.browserOperator) {
          return await this.browserOperator.execute(params);
        }
        // Otherwise, try to open browser first
        await this.handleOpenBrowser({ url: action_inputs?.content || '' });
        if (this.browserOperator) {
          return await this.browserOperator.execute(params);
        }
        break;
    }

    // Route to active operator
    if (this.browserSessionActive && this.browserOperator) {
      // Check if this is a browser-compatible action (using static constant for OCP)
      if (
        HybridOperator.BROWSER_COMPATIBLE_ACTIONS.includes(
          action_type as (typeof HybridOperator.BROWSER_COMPATIBLE_ACTIONS)[number],
        )
      ) {
        try {
          return await this.browserOperator.execute(params);
        } catch (error) {
          logger.warn(
            '[HybridOperator] Browser action failed, falling back to computer:',
            error,
          );
        }
      }
    }

    // Default: use Computer Use
    return await this.computerOperator.execute(params);
  }

  /**
   * Opens a browser session for high-fidelity web interaction
   */
  private async handleOpenBrowser(
    inputs: Record<string, unknown>,
  ): Promise<ExecuteOutput> {
    const url = (inputs?.url as string) || '';

    logger.info(
      '[HybridOperator] Opening browser session',
      url ? `to ${url}` : '',
    );

    const browser = await this.ensureBrowserOperator();
    if (!browser) {
      return {
        status: StatusEnum.ERROR,
      };
    }

    this.browserSessionActive = true;

    // If a URL was provided, navigate to it
    if (url) {
      try {
        // Use stored screen params if available, otherwise use reasonable defaults
        const screenWidth = this.lastScreenParams?.screenWidth ?? 1920;
        const screenHeight = this.lastScreenParams?.screenHeight ?? 1080;
        const scaleFactor = this.lastScreenParams?.scaleFactor ?? 1;

        await browser.execute({
          parsedPrediction: {
            action_type: 'navigate',
            action_inputs: { content: url },
          },
          screenWidth,
          screenHeight,
          scaleFactor,
        } as ExecuteParams);
      } catch (error) {
        logger.error('[HybridOperator] Navigation failed:', error);
      }
    }

    return {
      status: StatusEnum.RUNNING,
    };
  }

  /**
   * Closes the browser session and returns to computer-only mode
   */
  private async handleCloseBrowser(): Promise<ExecuteOutput> {
    logger.info('[HybridOperator] Closing browser session');

    this.browserSessionActive = false;

    // Note: We don't destroy the browser instance, just deactivate the session
    // This allows for faster reactivation if needed

    return {
      status: StatusEnum.RUNNING,
    };
  }

  /**
   * Cleanup all operators
   */
  async cleanup(): Promise<void> {
    logger.info('[HybridOperator] Cleaning up');

    if (this.browserOperator) {
      try {
        await this.browserOperator.cleanup();
      } catch (error) {
        logger.error('[HybridOperator] Browser cleanup error:', error);
      }
    }

    this.browserSessionActive = false;
    this.browserOperator = null;
  }
}
