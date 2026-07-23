import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/budgets/BudgetDetailDialog.jsx. */
export class BudgetDetailDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  get editBudgetButton() {
    return this.dialog.getByRole('button', { name: 'Edit budget' });
  }

  /** Only rendered for admin - see backend budgets-service delete_budget() role gate. */
  get deleteBudgetButton() {
    return this.dialog.getByRole('button', { name: 'Delete budget' });
  }

  get addEntryButton() {
    return this.dialog.getByRole('button', { name: 'Add entry' });
  }

  get emptyEntriesState() {
    return this.dialog.getByText('No spend recorded yet');
  }

  get closeButton() {
    return this.dialog.getByRole('button', { name: 'Close' });
  }

  entryListItem(category: string) {
    return this.dialog.getByText(new RegExp(`^${category}`));
  }

  removeEntryButtonFor(category: string) {
    return this.dialog.locator('li', { hasText: category }).getByRole('button', { name: 'Remove entry' });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
