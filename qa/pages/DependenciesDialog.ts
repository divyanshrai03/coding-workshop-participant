import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/projects/DeliverableDependenciesDialog.jsx. */
export class DependenciesDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  get blockedByHeading() {
    return this.dialog.getByRole('heading', { name: /^Blocked by/ });
  }

  get blockingHeading() {
    return this.dialog.getByRole('heading', { name: /^Blocking/ });
  }

  get dependsOnSelect() {
    return this.dialog.getByRole('combobox', { name: 'Depends on' });
  }

  get dependencyTypeSelect() {
    return this.dialog.getByRole('combobox', { name: 'Type' });
  }

  get addButton() {
    return this.dialog.getByRole('button', { name: 'Add', exact: true });
  }

  get closeButton() {
    return this.dialog.getByRole('button', { name: 'Close' });
  }

  /** Every existing dependency edge is listed as `<name> <status-chip>`. */
  listItem(deliverableName: string) {
    return this.dialog.getByText(deliverableName, { exact: false });
  }

  async addDependency(dependsOnName: string): Promise<void> {
    await this.dependsOnSelect.click();
    await this.page.getByRole('option', { name: dependsOnName }).click();
    await this.addButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
