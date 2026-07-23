import type { Page } from '@playwright/test';

/**
 * Common behavior shared by every Page Object. Feature-specific page classes
 * (LoginPage, ProjectsPage, ResourcesPage, ...) extend this in Phase 3, once
 * real locators can be captured from the running app.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }
}
