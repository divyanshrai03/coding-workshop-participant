import type { Page } from '@playwright/test';

/** Wraps frontend/src/features/resources/ResourceAssignmentsDialog.jsx. */
export class ResourceAssignmentsDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  get newAssignmentButton() {
    return this.dialog.getByRole('button', { name: 'New assignment' });
  }

  get emptyState() {
    return this.dialog.getByText('No assignments');
  }

  get closeButton() {
    return this.dialog.getByRole('button', { name: 'Close' });
  }

  assignmentListItem(projectName: string) {
    return this.dialog.getByText(projectName, { exact: false });
  }

  editButtonFor(projectName: string) {
    return this.dialog
      .locator('li', { hasText: projectName })
      .getByRole('button', { name: 'Edit' });
  }

  removeButtonFor(projectName: string) {
    return this.dialog
      .locator('li', { hasText: projectName })
      .getByRole('button', { name: 'Remove' });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
