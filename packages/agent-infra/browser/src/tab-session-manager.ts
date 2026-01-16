/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Page } from 'puppeteer-core';
import type { Logger } from '@agent-infra/logger';
import type { BrowserInterface } from './types';

/**
 * Strategy for deciding when to create new tabs vs reuse existing ones
 */
export type TabCreationStrategy = 'always_reuse' | 'smart' | 'always_new';

/**
 * Configuration options for TabSessionManager
 */
export interface TabSessionManagerOptions {
  /** Logger instance for debugging */
  logger?: Logger;
  /** Strategy for tab creation decisions */
  strategy?: TabCreationStrategy;
  /** Callback when user explicitly requests new tab - allows UI confirmation */
  onNewTabRequest?: (url: string) => Promise<boolean>;
}

/**
 * URL patterns that should typically open in new tabs
 * These patterns indicate external navigation that shouldn't replace current context
 */
const NEW_TAB_PATTERNS = [/^mailto:/i, /^tel:/i, /^javascript:/i];

/**
 * Domains that are typically "workspace" sites where users want persistence
 */
const WORKSPACE_DOMAINS = [
  'mail.google.com',
  'gmail.com',
  'outlook.office.com',
  'outlook.live.com',
  'calendar.google.com',
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'github.com',
  'notion.so',
  'slack.com',
  'trello.com',
  'asana.com',
];

/**
 * TabSessionManager - Intelligent tab management for browser automation
 *
 * Manages browser tabs following Single-Tab-Per-Session principle with
 * intelligent decisions about when to create new tabs.
 *
 * PRINCIPLES:
 * - KISS: Simple rule-based decisions
 * - DRY: Centralized tab logic
 * - SOLID: Single responsibility for tab management
 *
 * @example
 * ```typescript
 * const manager = new TabSessionManager(browser, { strategy: 'smart' });
 * const page = await manager.getOrCreateSessionPage('https://gmail.com');
 * // Later navigation reuses same page
 * await manager.navigateTo('https://gmail.com/compose');
 * ```
 */
export class TabSessionManager {
  private sessionPage: Page | null = null;
  private readonly strategy: TabCreationStrategy;
  private readonly logger?: Logger;
  private readonly onNewTabRequest?: (url: string) => Promise<boolean>;
  private lastNavigatedUrl: string | null = null;

  constructor(
    private readonly browser: BrowserInterface,
    options: TabSessionManagerOptions = {},
  ) {
    this.strategy = options.strategy ?? 'smart';
    this.logger = options.logger;
    this.onNewTabRequest = options.onNewTabRequest;
    this.logger?.info(
      '[TabSessionManager] Initialized with strategy:',
      this.strategy,
    );
  }

  /**
   * Gets the current session page or creates one if needed.
   * NEVER creates a new tab if the session page is still valid.
   *
   * @param initialUrl - Optional URL to navigate to if creating new page
   * @returns Promise resolving to the session page
   */
  async getOrCreateSessionPage(initialUrl?: string): Promise<Page> {
    this.logger?.info('[TabSessionManager] getOrCreateSessionPage called', {
      initialUrl,
    });

    // Check if current session page is still valid
    if (await this.isSessionPageValid()) {
      this.logger?.info('[TabSessionManager] Reusing existing session page');
      if (initialUrl && this.shouldNavigateToUrl(initialUrl)) {
        await this.navigateTo(initialUrl);
      }
      return this.sessionPage!;
    }

    // Try to find a reusable page from existing tabs
    const reusablePage = await this.findReusablePage();
    if (reusablePage) {
      this.logger?.info('[TabSessionManager] Found reusable page');
      this.sessionPage = reusablePage;
      if (initialUrl) {
        await this.navigateTo(initialUrl);
      }
      return this.sessionPage;
    }

    // Only now create a new page
    this.logger?.info('[TabSessionManager] Creating new session page');
    this.sessionPage = await this.browser.createPage();
    if (initialUrl) {
      await this.navigateTo(initialUrl);
    }
    return this.sessionPage;
  }

  /**
   * Navigate the session page to a new URL.
   * Uses the current session page - never creates new tabs for navigation.
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.sessionPage) {
      throw new Error(
        'No session page available. Call getOrCreateSessionPage first.',
      );
    }

    this.logger?.info('[TabSessionManager] Navigating to:', url);

    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);

    await this.sessionPage.goto(normalizedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    this.lastNavigatedUrl = normalizedUrl;
  }

  /**
   * Explicitly request a new tab.
   * This is for cases where the user or agent explicitly wants a new tab.
   * May trigger user confirmation if configured.
   *
   * @param url - URL to open in new tab
   * @param reason - Reason for new tab (for logging/confirmation)
   * @returns Promise resolving to the new page
   */
  async requestNewTab(url: string, reason?: string): Promise<Page> {
    this.logger?.info('[TabSessionManager] New tab requested', { url, reason });

    // If confirmation callback is set, ask for approval
    if (this.onNewTabRequest) {
      const approved = await this.onNewTabRequest(url);
      if (!approved) {
        this.logger?.info('[TabSessionManager] New tab request denied by user');
        // Fall back to navigating in current tab
        await this.navigateTo(url);
        return this.sessionPage!;
      }
    }

    const newPage = await this.browser.createPage();
    await newPage.goto(this.normalizeUrl(url), { waitUntil: 'networkidle2' });

    // Update session to point to new tab
    this.sessionPage = newPage;
    this.lastNavigatedUrl = url;

    return newPage;
  }

  /**
   * Determines if a navigation requires a new tab based on strategy.
   * Used by the agent to make intelligent decisions.
   *
   * @param currentUrl - Current page URL
   * @param targetUrl - Target navigation URL
   * @returns true if a new tab should be created
   */
  shouldCreateNewTab(currentUrl: string | null, targetUrl: string): boolean {
    if (this.strategy === 'always_reuse') {
      return false;
    }

    if (this.strategy === 'always_new') {
      return true;
    }

    // Smart strategy logic
    // Check if target URL matches patterns that should always open in new tab
    if (NEW_TAB_PATTERNS.some((pattern) => pattern.test(targetUrl))) {
      return true;
    }

    if (!currentUrl) {
      return false; // No current URL, just navigate
    }

    try {
      const current = new URL(currentUrl);
      const target = new URL(targetUrl);

      // Same domain - definitely reuse
      if (current.hostname === target.hostname) {
        return false;
      }

      // If current page is a workspace domain, ask before leaving
      const isLeavingWorkspace = WORKSPACE_DOMAINS.some((domain) =>
        current.hostname.includes(domain),
      );
      const isGoingToWorkspace = WORKSPACE_DOMAINS.some((domain) =>
        target.hostname.includes(domain),
      );

      // Leaving one workspace for another - might want new tab
      if (isLeavingWorkspace && isGoingToWorkspace) {
        return true;
      }

      // All other cases - reuse
      return false;
    } catch {
      // If URL parsing fails, just reuse
      return false;
    }
  }

  /**
   * Get the current session page without creating a new one.
   * @returns The current session page or null
   */
  getSessionPage(): Page | null {
    return this.sessionPage;
  }

  /**
   * Get URL of the current session page.
   */
  async getCurrentUrl(): Promise<string | null> {
    if (!(await this.isSessionPageValid())) {
      return null;
    }
    try {
      return await this.sessionPage!.url();
    } catch {
      return null;
    }
  }

  /**
   * Cleanup - close session page and reset state
   */
  async cleanup(): Promise<void> {
    this.logger?.info('[TabSessionManager] Cleanup called');
    if (this.sessionPage) {
      try {
        await this.sessionPage.close();
      } catch (e) {
        this.logger?.warn('[TabSessionManager] Error closing session page:', e);
      }
      this.sessionPage = null;
      this.lastNavigatedUrl = null;
    }
  }

  /**
   * Check if the current session page is still valid and responsive.
   */
  private async isSessionPageValid(): Promise<boolean> {
    if (!this.sessionPage) {
      return false;
    }

    try {
      // Try to execute a simple command to verify the page is responsive
      await this.sessionPage.evaluate(() => document.readyState);
      return true;
    } catch {
      this.logger?.warn('[TabSessionManager] Session page is no longer valid');
      this.sessionPage = null;
      return false;
    }
  }

  /**
   * Find a reusable page from existing browser tabs.
   * In smart/always_reuse strategy, we always reuse the active page.
   * We only skip reuse in 'always_new' strategy.
   */
  private async findReusablePage(): Promise<Page | null> {
    try {
      // In always_new strategy, never reuse
      if (this.strategy === 'always_new') {
        return null;
      }

      const activePage = await this.browser.getActivePage();
      if (!activePage) {
        return null;
      }

      // Verify the page is responsive
      try {
        await activePage.evaluate(() => document.readyState);
      } catch {
        this.logger?.warn('[TabSessionManager] Active page not responsive');
        return null;
      }

      const url = await activePage.url();
      this.logger?.info('[TabSessionManager] Found active page to reuse:', url);

      // Reuse the active page - this is the key fix!
      // We should ALWAYS reuse existing pages instead of creating new ones
      return activePage;
    } catch (e) {
      this.logger?.warn('[TabSessionManager] Error finding reusable page:', e);
      return null;
    }
  }

  /**
   * Check if we should actually navigate given the URL.
   * Avoids unnecessary navigation if already on the target URL.
   */
  private shouldNavigateToUrl(targetUrl: string): boolean {
    if (!this.lastNavigatedUrl) {
      return true;
    }

    try {
      const current = new URL(this.lastNavigatedUrl);
      const target = new URL(targetUrl);

      // Same origin + pathname = no need to navigate
      return (
        current.origin !== target.origin || current.pathname !== target.pathname
      );
    } catch {
      return true;
    }
  }

  /**
   * Normalize URL to ensure it has a protocol.
   */
  private normalizeUrl(url: string): string {
    if (!/^https?:\/\//i.test(url)) {
      return 'https://' + url;
    }
    return url;
  }
}
