import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/resources/AssignmentFormDialog.jsx. */
export class AssignmentFormDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  get projectInput() {
    return this.dialog.getByRole('combobox', { name: 'Project' });
  }

  get deliverableSelect() {
    return this.dialog.getByRole('combobox', { name: 'Deliverable (optional)' });
  }

  get personInput() {
    return this.dialog.getByRole('combobox', { name: 'Person' });
  }

  get roleOnProjectInput() {
    return this.dialog.getByRole('textbox', { name: 'Role on project' });
  }

  get allocationSlider() {
    return this.dialog.getByRole('slider');
  }

  get errorAlert() {
    return this.dialog.getByRole('alert');
  }

  get createButton() {
    return this.dialog.getByRole('button', { name: 'Create assignment' });
  }

  get saveButton() {
    return this.dialog.getByRole('button', { name: 'Save changes' });
  }

  async selectProject(name: string): Promise<void> {
    await this.projectInput.click();
    await this.projectInput.fill(name);
    await this.page.getByRole('option', { name }).click();
  }

  async selectPerson(nameOrEmailFragment: string): Promise<void> {
    await this.personInput.click();
    await this.personInput.fill(nameOrEmailFragment);
    await this.page.getByRole('option', { name: new RegExp(nameOrEmailFragment) }).click();
  }

  /** Sets the allocation slider via keyboard for a precise, deterministic value. */
  async setAllocation(percent: number): Promise<void> {
    await this.allocationSlider.focus();
    await this.allocationSlider.fill(String(percent));
  }
}
