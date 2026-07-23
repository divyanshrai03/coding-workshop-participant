import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/budgets/BudgetFormDialog.jsx (create + edit). */
export class BudgetFormDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  get projectInput() {
    return this.dialog.getByRole('combobox', { name: 'Project' });
  }

  get plannedAmountInput() {
    return this.dialog.getByRole('spinbutton', { name: 'Planned amount' });
  }

  get currencyInput() {
    return this.dialog.getByRole('textbox', { name: 'Currency' });
  }

  get errorAlert() {
    return this.dialog.getByRole('alert');
  }

  get createButton() {
    return this.dialog.getByRole('button', { name: 'Create budget' });
  }

  get saveButton() {
    return this.dialog.getByRole('button', { name: 'Save changes' });
  }

  async selectProject(name: string): Promise<void> {
    await this.projectInput.click();
    await this.projectInput.fill(name);
    await this.page.getByRole('option', { name }).click();
  }

  async create(plannedAmount: string): Promise<void> {
    await this.plannedAmountInput.fill(plannedAmount);
    await this.createButton.click();
    // See ProjectFormDialog.create() for why this wait matters.
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
