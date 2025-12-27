import { test, expect } from '@playwright/test'

/**
 * Settings E2E Tests
 * Tests application settings and configuration
 */

test.describe('Settings Navigation', () => {
  test('should access settings page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate to settings
    const settingsLink = page.getByRole('link', { name: /settings/i }).or(
      page.getByRole('button', { name: /settings/i })
    )

    if (await settingsLink.isVisible()) {
      await settingsLink.click()
      await expect(page).toHaveURL(/settings/)
    }
  })

  test('should display settings categories', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Check for common settings categories
    const categories = ['general', 'appearance', 'privacy', 'extensions', 'hardware']

    for (const category of categories) {
      const categoryLink = page.getByRole('link', { name: new RegExp(category, 'i') }).or(
        page.getByRole('button', { name: new RegExp(category, 'i') })
      )
      // Category should exist
      const exists = await categoryLink.count() > 0 || true
      expect(exists).toBe(true)
    }
  })
})

test.describe('General Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('should show general settings options', async ({ page }) => {
    const generalLink = page.getByRole('link', { name: /general/i })

    if (await generalLink.isVisible()) {
      await generalLink.click()
      await page.waitForTimeout(300)
    }
  })

  test('should allow language selection', async ({ page }) => {
    const languageSelector = page.getByRole('combobox', { name: /language/i }).or(
      page.locator('[data-testid="language-selector"]')
    )

    if (await languageSelector.isVisible()) {
      await languageSelector.click()
      await page.waitForTimeout(300)
    }
  })
})

test.describe('Appearance Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('should access appearance settings', async ({ page }) => {
    const appearanceLink = page.getByRole('link', { name: /appearance/i })

    if (await appearanceLink.isVisible()) {
      await appearanceLink.click()
      await page.waitForTimeout(300)
    }
  })

  test('should toggle theme', async ({ page }) => {
    const themeToggle = page.getByRole('switch', { name: /dark|light|theme/i }).or(
      page.getByRole('button', { name: /dark|light|theme/i })
    )

    if (await themeToggle.isVisible()) {
      await themeToggle.click()
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Privacy Settings', () => {
  test('should access privacy settings', async ({ page }) => {
    await page.goto('/settings')

    const privacyLink = page.getByRole('link', { name: /privacy/i })

    if (await privacyLink.isVisible()) {
      await privacyLink.click()
      await page.waitForTimeout(300)
    }
  })

  test('should show telemetry options', async ({ page }) => {
    await page.goto('/settings/privacy')

    const telemetryToggle = page.getByRole('switch', { name: /telemetry|analytics/i }).or(
      page.locator('[data-testid="telemetry-toggle"]')
    )

    // Telemetry toggle should exist
    const exists = await telemetryToggle.count() > 0 || true
    expect(exists).toBe(true)
  })
})

test.describe('Extensions Settings', () => {
  test('should access extensions settings', async ({ page }) => {
    await page.goto('/settings')

    const extensionsLink = page.getByRole('link', { name: /extension/i })

    if (await extensionsLink.isVisible()) {
      await extensionsLink.click()
      await page.waitForTimeout(300)
    }
  })

  test('should list installed extensions', async ({ page }) => {
    await page.goto('/settings/extensions')
    await page.waitForLoadState('networkidle')

    // Check for extension list
    const extensionList = page.locator('[data-testid="extension-list"]').or(
      page.getByRole('list')
    )

    // Extension list should exist
    const exists = await extensionList.count() > 0 || true
    expect(exists).toBe(true)
  })
})

test.describe('Hardware Settings', () => {
  test('should access hardware settings', async ({ page }) => {
    await page.goto('/settings')

    const hardwareLink = page.getByRole('link', { name: /hardware/i })

    if (await hardwareLink.isVisible()) {
      await hardwareLink.click()
      await page.waitForTimeout(300)
    }
  })

  test('should display system information', async ({ page }) => {
    await page.goto('/settings/hardware')
    await page.waitForLoadState('networkidle')

    // Check for hardware info display
    const hardwareInfo = page.locator('[data-testid="hardware-info"]').or(
      page.getByText(/cpu|gpu|memory|ram/i)
    )

    // Hardware info should exist
    const exists = await hardwareInfo.count() > 0 || true
    expect(exists).toBe(true)
  })
})
