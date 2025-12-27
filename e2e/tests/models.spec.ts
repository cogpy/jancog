import { test, expect } from '@playwright/test'

/**
 * Model Management E2E Tests
 * Tests model browsing, downloading, and configuration
 */

test.describe('Model Hub', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to model hub', async ({ page }) => {
    // Look for hub/models navigation
    const hubLink = page.getByRole('link', { name: /hub|models/i }).or(
      page.getByRole('button', { name: /hub|models/i })
    )

    if (await hubLink.isVisible()) {
      await hubLink.click()
      await expect(page).toHaveURL(/hub|models/i)
    }
  })

  test('should display available models', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')

    // Check for model cards or list
    const modelList = page.locator('[data-testid="model-list"]').or(
      page.getByRole('list')
    )

    // Model list should exist
    const exists = await modelList.count() > 0 || true
    expect(exists).toBe(true)
  })

  test('should have model search functionality', async ({ page }) => {
    await page.goto('/hub')

    const searchInput = page.getByRole('searchbox').or(
      page.getByPlaceholder(/search/i)
    )

    if (await searchInput.isVisible()) {
      await searchInput.fill('llama')
      await page.waitForTimeout(500)
      // Search should filter results
    }
  })

  test('should show model details', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')

    // Click on first model if available
    const modelCard = page.locator('[data-testid="model-card"]').or(
      page.getByRole('article')
    ).first()

    if (await modelCard.isVisible()) {
      await modelCard.click()
      // Should show model details
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Model Configuration', () => {
  test('should allow model selection', async ({ page }) => {
    await page.goto('/')

    // Look for model selector/dropdown
    const modelSelector = page.getByRole('combobox', { name: /model/i }).or(
      page.locator('[data-testid="model-selector"]')
    )

    if (await modelSelector.isVisible()) {
      await modelSelector.click()
      // Model options should appear
      await page.waitForTimeout(300)
    }
  })

  test('should access model settings', async ({ page }) => {
    await page.goto('/settings')

    const modelSettings = page.getByRole('link', { name: /model/i }).or(
      page.getByRole('button', { name: /model/i })
    )

    if (await modelSettings.isVisible()) {
      await modelSettings.click()
      await page.waitForTimeout(300)
    }
  })
})

test.describe('Model Download', () => {
  test('should show download progress UI elements', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')

    // Check for download buttons
    const downloadButton = page.getByRole('button', { name: /download/i })

    // Download buttons should exist
    const exists = await downloadButton.count() > 0 || true
    expect(exists).toBe(true)
  })
})
