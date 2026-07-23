import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get fullNameInput() {
    return this.page.getByRole('textbox', { name: 'Full name' });
  }

  get emailInput() {
    return this.page.getByRole('textbox', { name: 'Email' });
  }

  get passwordInput() {
    return this.page.getByLabel('Password', { exact: false });
  }

  get createAccountButton() {
    return this.page.getByRole('button', { name: 'Create account' });
  }

  get errorAlert() {
    return this.page.getByRole('alert');
  }

  get signInLink() {
    return this.page.getByRole('link', { name: 'Sign in' });
  }

  async open(): Promise<void> {
    await this.goto('/register');
  }

  async register(fullName: string, email: string, password: string): Promise<void> {
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.createAccountButton.click();
  }
}
