import type { Page } from '@playwright/test';

/**
 * The persistent sidebar + topbar shared by every authenticated page
 * (frontend/src/layouts/AppLayout.jsx). Not a "page" on its own - composed
 * into every other Page Object that renders inside AppLayout.
 */
export class AppNavigation {
  constructor(private readonly page: Page) {}

  get dashboardLink() {
    return this.page.getByRole('link', { name: 'Dashboard' });
  }

  get projectsLink() {
    return this.page.getByRole('link', { name: 'Projects' });
  }

  get resourcesLink() {
    return this.page.getByRole('link', { name: 'Resources' });
  }

  get budgetsLink() {
    return this.page.getByRole('link', { name: 'Budgets' });
  }

  get mobileMenuButton() {
    return this.page.getByRole('button', { name: 'Open navigation' });
  }

  get themeToggleButton() {
    return this.page.getByRole('button', { name: 'Toggle color mode' });
  }

  get accountMenuButton() {
    return this.page.getByRole('button', { name: 'Account menu' });
  }

  get signOutMenuItem() {
    return this.page.getByRole('menuitem', { name: 'Sign out' });
  }

  async goToProjects(): Promise<void> {
    await this.projectsLink.click();
  }

  async goToResources(): Promise<void> {
    await this.resourcesLink.click();
  }

  async goToBudgets(): Promise<void> {
    await this.budgetsLink.click();
  }

  async goToDashboard(): Promise<void> {
    await this.dashboardLink.click();
  }

  async openAccountMenu(): Promise<void> {
    await this.accountMenuButton.click();
  }

  async signOut(): Promise<void> {
    await this.openAccountMenu();
    await this.signOutMenuItem.click();
  }

  async toggleTheme(): Promise<void> {
    await this.themeToggleButton.click();
  }
}
