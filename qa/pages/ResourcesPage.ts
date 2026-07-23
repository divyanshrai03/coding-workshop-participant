import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { AppNavigation } from './AppNavigation';

/** Wraps frontend/src/features/resources/ResourcesPage.jsx. */
export class ResourcesPage extends BasePage {
  readonly nav: AppNavigation;

  constructor(page: Page) {
    super(page);
    this.nav = new AppNavigation(page);
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Resources', exact: true });
  }

  get searchInput() {
    return this.page.getByPlaceholder('Search by name or email…');
  }

  get roleFilter() {
    return this.page.getByRole('combobox', { name: 'Role' });
  }

  row(fullName: string) {
    return this.page.getByRole('row', { name: new RegExp(fullName) });
  }

  assignmentsButtonForRow(fullName: string) {
    return this.row(fullName).getByRole('button', { name: 'View assignments' });
  }

  async open(): Promise<void> {
    await this.goto('/resources');
    await this.heading.waitFor({ state: 'visible' });
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  async filterByRole(label: string): Promise<void> {
    await this.roleFilter.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async openAssignments(fullName: string): Promise<void> {
    await this.assignmentsButtonForRow(fullName).click();
  }
}
