import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { AppNavigation } from './AppNavigation';

/** Wraps frontend/src/features/budgets/BudgetsPage.jsx. */
export class BudgetsPage extends BasePage {
  readonly nav: AppNavigation;

  constructor(page: Page) {
    super(page);
    this.nav = new AppNavigation(page);
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Budgets', exact: true });
  }

  /** Appears twice when the list is empty (header action + empty-state action) - see ProjectsPage.newProjectButton. */
  get newBudgetButton() {
    return this.page.getByRole('button', { name: 'New Budget' }).first();
  }

  get emptyState() {
    return this.page.getByText(/No budgets/);
  }

  row(projectName: string) {
    return this.page.getByRole('row', { name: new RegExp(projectName) });
  }

  async open(): Promise<void> {
    await this.goto('/budgets');
    await this.heading.waitFor({ state: 'visible' });
  }

  async openBudget(projectName: string): Promise<void> {
    await this.page.getByRole('cell', { name: projectName }).click();
  }
}
