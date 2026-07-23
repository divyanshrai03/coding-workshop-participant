import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/projects/DeliverableFormDialog.jsx (create + edit). */
export class DeliverableFormDialog {
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

  get ownerInput() {
    return this.dialog.getByRole('combobox', { name: 'Owner' });
  }

  get dueDateInput() {
    return this.dialog.getByLabel('Due date');
  }

  get errorAlert() {
    return this.dialog.getByRole('alert');
  }

  get createButton() {
    return this.dialog.getByRole('button', { name: 'Create deliverable' });
  }

  get saveButton() {
    return this.dialog.getByRole('button', { name: 'Save changes' });
  }

  get cancelButton() {
    return this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async selectStatus(label: string): Promise<void> {
    await this.statusSelect.click();
    await this.page.getByRole('option', { name: label }).click();
  }

  async create(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.createButton.click();
    // See ProjectFormDialog.create() for why this wait matters - avoids a
    // race with page-level fields sharing a label with this dialog's fields.
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
