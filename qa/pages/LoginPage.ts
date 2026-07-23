import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get emailInput() {
    return this.page.getByRole('textbox', { name: 'Email' });
  }

  get passwordInput() {
    // MUI TextField type="password" doesn't expose role="textbox" - locate by label instead.
    return this.page.getByLabel('Password', { exact: false });
  }

  get signInButton() {
    return this.page.getByRole('button', { name: 'Sign in' });
  }

  get errorAlert() {
    return this.page.getByRole('alert');
  }

  get createAdminAccountLink() {
    return this.page.getByRole('link', { name: 'Create the first admin account' });
  }

  async open(): Promise<void> {
    await this.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}
