import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/projects/ProjectFormDialog.jsx (create + edit). */
export class ProjectFormDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  get nameInput() {
    return this.dialog.getByRole('textbox', { name: 'Name' });
  }

  get descriptionInput() {
    return this.dialog.getByRole('textbox', { name: 'Description' });
  }

  get statusSelect() {
    return this.dialog.getByRole('combobox', { name: 'Status' });
  }

  get riskLevelSelect() {
    return this.dialog.getByRole('combobox', { name: 'Risk level' });
  }

  get startDateInput() {
    return this.dialog.getByLabel('Start date');
  }

  get endDateInput() {
    return this.dialog.getByLabel('End date');
  }

  get errorAlert() {
    return this.dialog.getByRole('alert');
  }

  get createButton() {
    return this.dialog.getByRole('button', { name: 'Create project' });
  }

  get saveButton() {
    return this.dialog.getByRole('button', { name: 'Save changes' });
  }

  get cancelButton() {
    return this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async selectStatus(label: string): Promise<void> {
    await this.statusSelect.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async selectRiskLevel(label: string): Promise<void> {
    await this.riskLevelSelect.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async create(name: string): Promise<void> {
    await this.fillName(name);
    await this.createButton.click();
    // Wait for the dialog to actually unmount before returning - otherwise a
    // caller that immediately interacts with an identically-labeled field on
    // the page underneath (e.g. the Status filter vs. this dialog's Status
    // select) can race against the closing dialog and hit a strict-mode
    // "resolved to 2 elements" failure.
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
