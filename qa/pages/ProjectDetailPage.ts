import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Wraps frontend/src/features/projects/ProjectDetailPage.jsx. */
export class ProjectDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  heading(projectName: string) {
    return this.page.getByRole('heading', { name: projectName, exact: true });
  }

  get backButton() {
    return this.page.getByRole('button', { name: 'Back to projects' });
  }

  /**
   * getByRole('button', { name: 'Edit' }) is ambiguous once any deliverable
   * row exists: each row also has an icon-only "Edit"/"Delete" button whose
   * accessible name comes from an aria-label, not visible text, but role+name
   * matching doesn't distinguish the two. `hasText` filters on actual text
   * content, which only the page-level button (labeled Button, not IconButton)
   * has - the row buttons render an icon with no visible text at all.
   */
  get editButton() {
    return this.page.getByRole('button').filter({ hasText: 'Edit' });
  }

  get deleteButton() {
    return this.page.getByRole('button').filter({ hasText: 'Delete' });
  }

  get setUpBudgetButton() {
    return this.page.getByRole('button', { name: 'Set up budget' });
  }

  get viewBudgetButton() {
    return this.page.getByRole('button', { name: 'View budget' });
  }

  get newDeliverableButton() {
    return this.page.getByRole('button', { name: 'New Deliverable' });
  }

  get deliverableSearchInput() {
    return this.page.getByPlaceholder('Search deliverables…');
  }

  get deliverableStatusFilter() {
    return this.page.getByRole('combobox', { name: 'Status' });
  }

  get emptyDeliverablesState() {
    return this.page.getByText(/No deliverables/);
  }

  deliverableRow(name: string) {
    return this.page.getByRole('row', { name: new RegExp(name) });
  }

  dependenciesButtonForRow(name: string) {
    return this.deliverableRow(name).getByRole('button', { name: 'Dependencies' });
  }

  editButtonForRow(name: string) {
    return this.deliverableRow(name).getByRole('button', { name: 'Edit' });
  }

  deleteButtonForRow(name: string) {
    return this.deliverableRow(name).getByRole('button', { name: 'Delete' });
  }

  async openViaUrl(projectId: string): Promise<void> {
    await this.goto(`/projects/${projectId}`);
  }

  async openDeliverable(name: string): Promise<void> {
    await this.dependenciesButtonForRow(name).click();
  }
}
