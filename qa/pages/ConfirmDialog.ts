import type { Page } from '@playwright/test';

/**
 * Wraps components/ConfirmDialog.jsx, reused across every destructive action
 * (delete project, delete deliverable, remove assignment, remove entry,
 * delete budget). One object for all of them - the title differs per call
 * site, so callers assert on `titleText(expected)` themselves if needed.
 */
export class ConfirmDialog {
  constructor(private readonly page: Page) {}

  get dialog() {
    return this.page.getByRole('dialog').last();
  }

  titleText(expectedTitle: string) {
    return this.dialog.getByRole('heading', { name: expectedTitle });
  }

  get cancelButton() {
    return this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async confirm(buttonLabel: string): Promise<void> {
    await this.dialog.getByRole('button', { name: buttonLabel, exact: true }).click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
