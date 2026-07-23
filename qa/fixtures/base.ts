import { test as base, expect } from '@playwright/test';
import { env } from '../config/env';

/**
 * Base fixture extension point. Every spec should import `test`/`expect`
 * from here (not directly from `@playwright/test`) so future fixtures - a
 * per-role authenticated UI session in Phase 3, a per-role API bearer token
 * in Phase 4 - land in one place and every existing spec picks them up
 * automatically instead of being migrated file-by-file later.
 */
export const test = base.extend({});

export { expect, env };
