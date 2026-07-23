import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { AppNavigation } from './AppNavigation';

export class DashboardPage extends BasePage {
  readonly nav: AppNavigation;

  constructor(page: Page) {
    super(page);
    this.nav = new AppNavigation(page);
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Dashboard', exact: true });
  }

  // Section titles use heading role (not getByText) - the page description
  // text also contains some of these words, causing strict-mode collisions.
  get riskBreakdownCard() {
    return this.page.getByRole('heading', { name: 'Risk breakdown' });
  }

  get budgetOverviewCard() {
    return this.page.getByRole('heading', { name: 'Budget overview' });
  }

  get teamWorkloadCard() {
    return this.page.getByRole('heading', { name: 'Team workload' });
  }

  get upcomingDeadlinesCard() {
    return this.page.getByRole('heading', { name: 'Upcoming deadlines' });
  }

  get viewBudgetsButton() {
    return this.page.getByRole('button', { name: 'View budgets' });
  }

  async open(): Promise<void> {
    await this.goto('/dashboard');
    await this.heading.waitFor({ state: 'visible' });
  }
}
