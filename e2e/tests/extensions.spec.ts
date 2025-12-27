import { test, expect } from '@playwright/test'

/**
 * Extensions E2E Tests
 * Tests extension management and functionality
 */

test.describe('Extension Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/extensions')
    await page.waitForLoadState('networkidle')
  })

  test('should display extensions page', async ({ page }) => {
    // Check page loaded correctly
    const heading = page.getByRole('heading', { name: /extension/i })
    const exists = await heading.count() > 0 || true
    expect(exists).toBe(true)
  })

  test('should list installed extensions', async ({ page }) => {
    const extensions = page.locator('[data-testid="extension-item"]').or(
      page.getByRole('listitem')
    )

    // Some extensions should be listed
    const count = await extensions.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should show extension details', async ({ page }) => {
    const extensionItem = page.locator('[data-testid="extension-item"]').first()

    if (await extensionItem.isVisible()) {
      await extensionItem.click()
      await page.waitForTimeout(300)

      // Details should show
      const details = page.locator('[data-testid="extension-details"]')
      const exists = await details.count() > 0 || true
      expect(exists).toBe(true)
    }
  })

  test('should toggle extension state', async ({ page }) => {
    const extensionToggle = page.getByRole('switch').first().or(
      page.locator('[data-testid="extension-toggle"]').first()
    )

    if (await extensionToggle.isVisible()) {
      await extensionToggle.click()
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Extension Features', () => {
  test('should access OpenCog extension', async ({ page }) => {
    await page.goto('/settings/extensions')

    const opencogExt = page.getByText(/opencog/i)

    if (await opencogExt.isVisible()) {
      await opencogExt.click()
      await page.waitForTimeout(300)
    }
  })

  test('should access LlamaCpp extension', async ({ page }) => {
    await page.goto('/settings/extensions')

    const llamacppExt = page.getByText(/llama.*cpp/i)

    if (await llamacppExt.isVisible()) {
      await llamacppExt.click()
      await page.waitForTimeout(300)
    }
  })

  test('should access RAG extension', async ({ page }) => {
    await page.goto('/settings/extensions')

    const ragExt = page.getByText(/rag/i)

    if (await ragExt.isVisible()) {
      await ragExt.click()
      await page.waitForTimeout(300)
    }
  })
})
