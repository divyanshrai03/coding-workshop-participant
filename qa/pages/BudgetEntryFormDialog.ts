import type { Page } from '@playwright/test';

/**
 * Wraps frontend/src/features/budgets/BudgetEntryFormDialog.jsx.
 *
 * This dialog is *always* nested inside BudgetDetailDialog (there's no
 * top-level entry point). `.last()` is ambiguous here: once this dialog
 * unmounts, `getByRole('dialog').last()` just re-matches the still-open
 * parent, so a naive `waitFor({ state: 'hidden' })` on it would poll forever
 * against a dialog that's visible by design. Scoping by this dialog's own
 * heading instead identifies *this* dialog regardless of what else is open.
 */
export class BudgetEntryFormDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Add spend entry' }) });
  }

  get categoryInput() {
    return this.dialog.getByRole('textbox', { name: 'Category' });
  }

  get descriptionInput() {
    return this.dialog.getByRole('textbox', { name: 'Description' });
  }

  get amountInput() {
    return this.dialog.getByRole('spinbutton', { name: 'Amount' });
  }

  get errorAlert() {
    return this.dialog.getByRole('alert');
  }

  get addEntryButton() {
    return this.dialog.getByRole('button', { name: 'Add entry' });
  }

  async addEntry(category: string, amount: string): Promise<void> {
    await this.categoryInput.fill(category);
    await this.amountInput.fill(amount);
    await this.addEntryButton.click();
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
