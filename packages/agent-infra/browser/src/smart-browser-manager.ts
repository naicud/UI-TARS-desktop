/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Logger } from '@agent-infra/logger';
import { defaultLogger } from '@agent-infra/logger';
import type { BrowserInterface, LaunchOptions } from './types';
import { LocalBrowser } from './local-browser';
import { RemoteBrowser } from './remote-browser';

/**
 * Configuration options for SmartBrowserManager
 */
export interface SmartBrowserConfig {
  /** Port for Chrome debugging. @default 9222 */
  debugPort?: number;
  /** Whether to keep browser alive after manager is destroyed. @default true */
  persistentMode?: boolean;
  /** User data directory for Chrome profile (for session persistence) */
  userDataDir?: string;
  /** Logger instance */
  logger?: Logger;
  /** Launch options passed to browser */
  launchOptions?: LaunchOptions;
  /** Callback when a new browser needs to be launched (for user notification) */
  onBrowserLaunch?: () => void | Promise<void>;
}

/**
 * Browser connection mode
 */
export type BrowserConnectionMode = 'attached' | 'launched' | 'reused';

/**
 * Result of getting a browser
 */
export interface GetBrowserResult {
  browser: BrowserInterface;
  mode: BrowserConnectionMode;
  isNewInstance: boolean;
}

/**
 * SmartBrowserManager - Intelligent browser instance management
 *
 * Implements "Smart Detection" pattern:
 * 1. First tries to connect to an existing browser with debug port active
 * 2. If none found, checks if we have a persistent instance from previous session
 * 3. If neither, launches a new browser with debug port enabled
 *
 * The browser instance persists across Jarvis sessions for seamless UX.
 *
 * PRINCIPLES:
 * - KISS: Simple detection logic
 * - DRY: Centralized browser lifecycle management
 * - SOLID: Single responsibility for browser instance management
 *
 * @example
 * ```typescript
 * const manager = SmartBrowserManager.getInstance();
 * const { browser, mode } = await manager.getOrCreateBrowser();
 *
 * if (mode === 'launched') {
 *   console.log('New browser launched with debug port');
 * } else if (mode === 'attached') {
 *   console.log('Connected to existing browser');
 * }
 * ```
 */
export class SmartBrowserManager {
  private static instance: SmartBrowserManager | null = null;

  private browser: BrowserInterface | null = null;
  private readonly debugPort: number;
  private readonly persistentMode: boolean;
  private readonly userDataDir?: string;
  private readonly logger: Logger;
  private readonly launchOptions: LaunchOptions;
  private readonly onBrowserLaunch?: () => void | Promise<void>;

  private isConnectedToExternal: boolean = false;

  private constructor(config: SmartBrowserConfig = {}) {
    this.debugPort = config.debugPort ?? 9222;
    this.persistentMode = config.persistentMode ?? true;
    this.userDataDir = config.userDataDir;
    this.logger = (config.logger ?? defaultLogger).spawn(
      '[SmartBrowserManager]',
    );
    this.launchOptions = config.launchOptions ?? {};
    this.onBrowserLaunch = config.onBrowserLaunch;

    this.logger.info('Initialized', {
      debugPort: this.debugPort,
      persistentMode: this.persistentMode,
      userDataDir: this.userDataDir,
    });
  }

  /**
   * Get the singleton instance of SmartBrowserManager
   */
  static getInstance(config?: SmartBrowserConfig): SmartBrowserManager {
    if (!SmartBrowserManager.instance) {
      SmartBrowserManager.instance = new SmartBrowserManager(config);
    }
    return SmartBrowserManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing or reconfiguration)
   */
  static resetInstance(): void {
    SmartBrowserManager.instance = null;
  }

  /**
   * Gets an existing browser or launches a new one.
   *
   * Priority:
   * 1. Connect to existing debug-enabled browser (user's browser)
   * 2. Reuse our persistent instance if still alive
   * 3. Launch new browser with debug port
   *
   * @returns Browser instance and connection mode
   */
  async getOrCreateBrowser(): Promise<GetBrowserResult> {
    this.logger.info('getOrCreateBrowser called');

    // 1. Try to connect to existing debug port (external browser)
    if (await this.isDebugPortActive()) {
      this.logger.info('Found existing browser with debug port active');

      // Check if we're already connected to this browser
      if (this.browser && this.isConnectedToExternal) {
        const isAlive = await this.isBrowserAlive(this.browser);
        if (isAlive) {
          this.logger.info('Reusing existing connection to external browser');
          return {
            browser: this.browser,
            mode: 'reused',
            isNewInstance: false,
          };
        }
      }

      // Connect to the external browser
      const browser = await this.connectToExisting();
      return {
        browser,
        mode: 'attached',
        isNewInstance: true,
      };
    }

    // 2. Check if we have a persistent instance that's still alive
    if (this.browser && !this.isConnectedToExternal) {
      const isAlive = await this.isBrowserAlive(this.browser);
      if (isAlive) {
        this.logger.info('Reusing persistent browser instance');
        return {
          browser: this.browser,
          mode: 'reused',
          isNewInstance: false,
        };
      } else {
        this.logger.warn('Persistent browser is no longer alive');
        this.browser = null;
      }
    }

    // 3. Launch new browser with debug port
    this.logger.info('No existing browser found, launching new one');

    // Notify user that we're launching a new browser
    if (this.onBrowserLaunch) {
      await this.onBrowserLaunch();
    }

    const browser = await this.launchWithDebugPort();
    return {
      browser,
      mode: 'launched',
      isNewInstance: true,
    };
  }

  /**
   * Check if the debug port is active (a browser is listening)
   */
  async isDebugPortActive(): Promise<boolean> {
    const endpoint = `http://127.0.0.1:${this.debugPort}/json/version`;
    this.logger.info('Checking debug port at:', endpoint);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.logger.info('Debug port active, browser info:', {
          browser: data.Browser,
          webSocketUrl: data.webSocketDebuggerUrl,
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.info('Debug port not active:', (error as Error).message);
      return false;
    }
  }

  /**
   * Connect to an existing browser via Chrome DevTools Protocol
   */
  private async connectToExisting(): Promise<BrowserInterface> {
    this.logger.info('Connecting to existing browser at port:', this.debugPort);

    const browser = new RemoteBrowser({
      cdpEndpoint: `http://127.0.0.1:${this.debugPort}/json/version`,
      logger: this.logger,
    });

    await browser.launch(this.launchOptions);

    this.browser = browser;
    this.isConnectedToExternal = true;

    this.logger.success('Connected to existing browser');
    return browser;
  }

  /**
   * Launch a new browser with debug port enabled
   */
  private async launchWithDebugPort(): Promise<BrowserInterface> {
    this.logger.info('Launching new browser with debug port:', this.debugPort);

    const browser = new LocalBrowser({
      logger: this.logger,
    });

    const launchArgs = [
      `--remote-debugging-port=${this.debugPort}`,
      ...(this.launchOptions.args ?? []),
    ];

    await browser.launch({
      ...this.launchOptions,
      args: launchArgs,
      userDataDir: this.userDataDir,
    });

    this.browser = browser;
    this.isConnectedToExternal = false;

    this.logger.success('Launched new browser with debug port');
    return browser;
  }

  /**
   * Check if a browser instance is still alive and responsive
   */
  private async isBrowserAlive(browser: BrowserInterface): Promise<boolean> {
    try {
      // Try to get a page to verify browser is responsive
      // Note: getActivePage may throw if no pages exist, which means browser is alive but empty
      const page = await browser.getActivePage();
      await page.evaluate(() => document.readyState);
      return true;
    } catch (e) {
      // If error is "No pages available", browser is alive but has no pages
      // This is still considered "alive" - TabSessionManager will create a page
      const errorMessage = (e as Error).message;
      if (errorMessage.includes('No pages available')) {
        this.logger.info(
          'Browser alive but no pages - TabSessionManager will handle',
        );
        return true;
      }
      // Any other error means browser is not responsive
      return false;
    }
  }

  /**
   * Get the current browser instance without creating a new one
   */
  getBrowser(): BrowserInterface | null {
    return this.browser;
  }

  /**
   * Check if currently connected to an external (user-launched) browser
   */
  isExternalBrowser(): boolean {
    return this.isConnectedToExternal;
  }

  /**
   * Get the debug port being used
   */
  getDebugPort(): number {
    return this.debugPort;
  }

  /**
   * Close the browser instance
   *
   * @param force - If true, closes even external browsers.
   *                If false, only closes browsers we launched.
   */
  async closeBrowser(force: boolean = false): Promise<void> {
    if (!this.browser) {
      return;
    }

    // Don't close external browsers unless forced
    if (this.isConnectedToExternal && !force) {
      this.logger.info(
        'Not closing external browser (use force=true to override)',
      );
      this.browser = null;
      this.isConnectedToExternal = false;
      return;
    }

    // Don't close in persistent mode unless forced
    if (this.persistentMode && !force) {
      this.logger.info('Persistent mode: keeping browser open');
      return;
    }

    try {
      await this.browser.close();
      this.logger.info('Browser closed');
    } catch (error) {
      this.logger.warn('Error closing browser:', error);
    } finally {
      this.browser = null;
      this.isConnectedToExternal = false;
    }
  }

  /**
   * Cleanup - disconnect from browser without closing it
   */
  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from browser');
    this.browser = null;
    this.isConnectedToExternal = false;
  }
}
