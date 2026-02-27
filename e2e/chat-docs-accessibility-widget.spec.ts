import { test, expect } from '@playwright/test';

test.describe('Community flows', () => {
  test('documents links, chat interactions, accessibility controls, keyboard combos, and chat widget', async ({ page, context }) => {
    const docsHealth = await page.request.get('/api/v1/documents/overview');
    test.skip(!docsHealth.ok(), 'Requires running gateway/docs backend for full community flow e2e');

    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: /Documents|Documentos/i })).toBeVisible();

    const sourceLinks = page.locator('table tbody a[href^="http"]');
    await expect(sourceLinks.first()).toBeVisible();
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      sourceLinks.first().click(),
    ]);
    await expect(popup).toHaveURL(/https?:\/\//);
    await popup.close();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Vecinita/i })).toBeVisible();

    const mainComposer = page.locator('main textarea').first();
    await mainComposer.fill('Hello Vecinita, can you share housing resources?');
    await mainComposer.press('Enter');
    await expect(page.getByText('Hello Vecinita, can you share housing resources?')).toBeVisible();

    await mainComposer.fill('Can you also include food assistance contacts?');
    await mainComposer.press('Enter');
    await expect(page.getByText('Can you also include food assistance contacts?')).toBeVisible();

    await page.keyboard.press('Alt+a');
    await expect(page.getByRole('dialog')).toBeVisible();

    const toggles = page.getByRole('dialog').locator('input[type="checkbox"]');
    const toggleCount = await toggles.count();
    for (let index = 0; index < toggleCount; index += 1) {
      const toggle = toggles.nth(index);
      await toggle.check();
      await expect(toggle).toBeChecked();
      await toggle.uncheck();
      await expect(toggle).not.toBeChecked();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.keyboard.press('Alt+k');
    await expect(page.getByRole('heading', { name: /Keyboard Shortcuts|Atajos de Teclado/i })).toBeVisible();
    await page.keyboard.press('Escape');

    const widgetOpenButton = page.locator('button.fixed[aria-label]').first();
    await widgetOpenButton.click();

    const widgetComposer = page.locator('textarea').last();
    await widgetComposer.fill('Widget test message');
    await page.getByRole('button', { name: /Send message|Enviar mensaje/i }).last().click();
    await expect(page.getByText('Widget test message')).toBeVisible();

    await page.getByRole('link', { name: /Admin login/i }).click();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin/);
    await expect(page.getByRole('heading', { name: /Admin Login/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    await page.getByRole('link', { name: /Browse documents/i }).click();
    await expect(page).toHaveURL(/\/documents/);
  });
});
