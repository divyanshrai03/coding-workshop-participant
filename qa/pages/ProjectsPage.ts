import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { AppNavigation } from './AppNavigation';

/** Wraps frontend/src/features/projects/ProjectsPage.jsx. */
export class ProjectsPage extends BasePage {
  readonly nav: AppNavigation;

  constructor(page: Page) {
    super(page);
    this.nav = new AppNavigation(page);
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Projects', exact: true });
  }

  get searchInput() {
    return this.page.getByPlaceholder('Search projects…');
  }

  get statusFilter() {
    return this.page.getByRole('combobox', { name: 'Status' });
  }

  get riskFilter() {
    return this.page.getByRole('combobox', { name: 'Risk' });
  }

  get sortSelect() {
    return this.page.getByRole('combobox', { name: 'Sort' });
  }

  /**
   * The "New Project" button appears twice when the list is empty (page
   * header action + empty-state action) - `.first()` always targets the
   * header's, which is present regardless of list state.
   */
  get newProjectButton() {
    return this.page.getByRole('button', { name: 'New Project' }).first();
  }

  get emptyState() {
    return this.page.getByText(/No projects/);
  }

  row(projectName: string) {
    return this.page.getByRole('row', { name: new RegExp(projectName) });
  }

  deleteButtonForRow(projectName: string) {
    return this.row(projectName).getByRole('button', { name: 'Delete project' });
  }

  async open(): Promise<void> {
    await this.goto('/projects');
    await this.heading.waitFor({ state: 'visible' });
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  async filterByStatus(label: string): Promise<void> {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async filterByRisk(label: string): Promise<void> {
    await this.riskFilter.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async openProject(projectName: string): Promise<void> {
    await this.page.getByRole('cell', { name: projectName }).click();
  }
}
