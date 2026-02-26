import { test, expect } from '@playwright/test';
import process from 'node:process';
import { Buffer } from 'node:buffer';

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.VITE_DEV_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.VITE_DEV_ADMIN_PASSWORD;
const adminToken = process.env.E2E_ADMIN_TOKEN || process.env.VITE_DEV_ADMIN_TOKEN || process.env.DEV_ADMIN_BEARER_TOKEN;

test.describe('Admin authentication and ingestion', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (or VITE_DEV_ADMIN_*) for admin E2E tests.');

  test('logs in, adds source with tags, uploads by click and drag-drop, and logs out', async ({ page }) => {
    const cleanupSourceUrls = new Set<string>();

    await page.goto('/login?redirect=/admin');

    await page.getByLabel('Email').fill(adminEmail!);
    await page.getByLabel('Password').fill(adminPassword!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();

    const sourceUrl = `https://example.com/?source=community-resource-${Date.now()}`;
    cleanupSourceUrls.add(sourceUrl);
    await page.getByPlaceholder('https://example.com/page').fill(sourceUrl);
    await page.getByPlaceholder('Tags (comma separated, optional)').first().fill('__e2e__,community');
    await page.getByRole('button', { name: /^Add$/ }).click();

    await expect(page.getByText(/Added source and indexed|Queued:/i)).toBeVisible();
    await expect(page.getByText(sourceUrl)).toBeVisible();

    await page.getByRole('button', { name: /Upload/i }).click();

    const fileInput = page.locator('input[type="file"]');
    const clickUploadFilename = `community-resource-${Date.now()}-click.txt`;
    await fileInput.setInputFiles({
      name: clickUploadFilename,
      mimeType: 'text/plain',
      buffer: Buffer.from('Community resource upload for automated verification.'),
    });
    await page.getByPlaceholder('Tags (comma separated, optional)').last().fill('__e2e__,community');
    await page.getByRole('button', { name: /Upload & Embed/i }).click();
    await expect(page.getByText(/Uploaded:\s*\d+ chunks inserted\./i)).toBeVisible();

    await page.getByRole('button', { name: /Sources/i }).click();
    await expect(page.locator('span', { hasText: clickUploadFilename }).first()).toBeVisible();

    await page.getByRole('button', { name: /Upload/i }).click();

    const dropZone = page.getByText(/Drop a file here or click to select/i).locator('..');
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    const dragUploadFilename = `community-resource-drag-${Date.now()}.txt`;
    await page.evaluate(
      ({ dt, name }) => {
        const file = new File(['Community resource drag-and-drop upload for automated verification.'], name, { type: 'text/plain' });
        (dt as DataTransfer).items.add(file);
      },
      { dt: dataTransfer, name: dragUploadFilename },
    );

    await dropZone.dispatchEvent('drop', { dataTransfer });
    await page.getByPlaceholder('Tags (comma separated, optional)').last().fill('__e2e__,community');
    await page.getByRole('button', { name: /Upload & Embed/i }).click();
    await expect(page.getByText(/Uploaded:\s*\d+ chunks inserted\./i)).toBeVisible();

    await page.getByRole('button', { name: /Sources/i }).click();
    await expect(page.locator('span', { hasText: dragUploadFilename }).first()).toBeVisible();

    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: /Documents|Documentos/i })).toBeVisible();

    if (adminToken) {
      const listResponse = await page.request.get('/api/v1/admin/sources?limit=500&offset=0', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (listResponse.ok()) {
        const payload = (await listResponse.json()) as { sources?: Array<{ url?: string; tags?: string[] }> };
        for (const source of payload.sources ?? []) {
          const sourceUrlValue = source.url ?? '';
          const sourceTags = source.tags ?? [];
          if (sourceTags.includes('__e2e__')) {
            cleanupSourceUrls.add(sourceUrlValue);
          }
        }
      }

      for (const cleanupUrl of cleanupSourceUrls) {
        if (!cleanupUrl) continue;
        await page.request.delete(`/api/v1/admin/sources?url=${encodeURIComponent(cleanupUrl)}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        });
      }
    }

    await page.getByRole('button', { name: /Sign out/i }).click();
    await expect(page.getByRole('link', { name: /Admin login/i })).toBeVisible();
  });
});
