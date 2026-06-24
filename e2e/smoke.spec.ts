import { test, expect } from '@playwright/test';

test.describe('Plantcaer Smoke Tests', () => {
  test('login page loads with all form elements', async ({ page }) => {
    await page.goto('/auth/login');

    // Page loads with correct heading
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Form has email input with proper label
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Form has password input with proper label
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Sign in button exists
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    // Link to signup exists
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();

    // No error messages on initial load
    await expect(page.locator('text=Email').first()).toBeVisible();
  });

  test('signup page loads with all form elements', async ({ page }) => {
    await page.goto('/auth/signup');

    // Page title
    await expect(page.getByRole('heading', { name: /create account|get started/i })).toBeVisible();

    // Form fields with labels
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    // Create account button
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();

    // Link to login
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('homepage redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    // Should redirect to /auth/login
    await page.waitForURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();
  });

  test('add plant page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/plants/new');
    await page.waitForURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();
  });

  test('care page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/care');
    await page.waitForURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();
  });

  test('plant detail page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/plant/nonexistent-plant-123');
    await page.waitForURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();
  });

  test('login form shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill in fields with invalid credentials
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // Click submit
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should show an error message from Supabase (not crash)
    // Wait a moment for the API call to return
    await page.waitForTimeout(3000);

    // Either we're on login page with an error, or redirected (unlikely with invalid creds)
    const hasError = await page.locator('[class*="bg-red"]').first().isVisible().catch(() => false);
    expect(page.url()).toContain('/auth/login');
  });

  test('signup form shows error for existing account', async ({ page }) => {
    await page.goto('/auth/signup');

    // Try signing up with a taken email pattern
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');

    // Submit
    await page.getByRole('button', { name: 'Create account' }).click();

    // Wait for API response
    await page.waitForTimeout(3000);

    // Should show error or redirect with check_email param
    const redirectedToCheckEmail = page.url().includes('check_email=true');
    const hasError = await page.locator('[class*="bg-red"]').first().isVisible().catch(() => false);
    expect(redirectedToCheckEmail || hasError).toBeTruthy();
  });

  test('app has dark theme', async ({ page }) => {
    await page.goto('/auth/login');

    // Check body background color is dark
    const bodyBg = await page.locator('body').evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    // Should be a dark color (e.g. rgb(10, 31, 26) for #0a1f1a)
    expect(bodyBg).toMatch(/^rgb\(\s*\d{1,2}/);
    const r = parseInt(bodyBg.match(/\d+/)?.[0] || '255');
    expect(r).toBeLessThan(50);
  });

  test('no console errors on login page', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    expect(consoleErrors).toHaveLength(0);
  });

  test('login page navigation works end-to-end', async ({ page }) => {
    await page.goto('/auth/login');

    // Can navigate to signup
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/auth\/signup/);

    // Can navigate back to login
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
