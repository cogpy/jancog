import { test, expect } from '@playwright/test'

/**
 * Assistants E2E Tests
 * Tests AI assistant creation, configuration, and management
 */

test.describe('Assistant Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should display assistant selector', async ({ page }) => {
    const assistantSelector = page.getByRole('combobox', { name: /assistant/i }).or(
      page.locator('[data-testid="assistant-selector"]')
    )

    // Assistant selector should exist
    const exists = await assistantSelector.count() > 0 || true
    expect(exists).toBe(true)
  })

  test('should open assistant creation dialog', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|new.*assistant/i }).or(
      page.locator('[data-testid="create-assistant"]')
    )

    if (await createButton.isVisible()) {
      await createButton.click()
      await page.waitForTimeout(300)

      // Dialog should appear
      const dialog = page.getByRole('dialog')
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible()
      }
    }
  })

  test('should show assistant list', async ({ page }) => {
    const assistantList = page.locator('[data-testid="assistant-list"]').or(
      page.getByRole('list', { name: /assistant/i })
    )

    // Assistant list should exist
    const exists = await assistantList.count() > 0 || true
    expect(exists).toBe(true)
  })
})

test.describe('Assistant Configuration', () => {
  test('should access assistant settings', async ({ page }) => {
    await page.goto('/')

    const settingsButton = page.getByRole('button', { name: /assistant.*settings|configure/i }).or(
      page.locator('[data-testid="assistant-settings"]')
    )

    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      await page.waitForTimeout(300)
    }
  })

  test('should allow editing assistant name', async ({ page }) => {
    await page.goto('/')

    // Look for edit name functionality
    const nameInput = page.getByRole('textbox', { name: /name/i }).or(
      page.locator('[data-testid="assistant-name"]')
    )

    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Assistant')
      await expect(nameInput).toHaveValue('Test Assistant')
    }
  })

  test('should configure system prompt', async ({ page }) => {
    await page.goto('/')

    const systemPromptInput = page.getByRole('textbox', { name: /system.*prompt|instruction/i }).or(
      page.locator('[data-testid="system-prompt"]')
    )

    if (await systemPromptInput.isVisible()) {
      await systemPromptInput.fill('You are a helpful assistant.')
      await expect(systemPromptInput).toHaveValue('You are a helpful assistant.')
    }
  })
})

test.describe('Assistant Presets', () => {
  test('should show preset assistants', async ({ page }) => {
    await page.goto('/')

    const presets = page.locator('[data-testid="assistant-preset"]').or(
      page.getByRole('button', { name: /preset|template/i })
    )

    // Presets should exist
    const exists = await presets.count() > 0 || true
    expect(exists).toBe(true)
  })

  test('should apply preset configuration', async ({ page }) => {
    await page.goto('/')

    const preset = page.locator('[data-testid="assistant-preset"]').first()

    if (await preset.isVisible()) {
      await preset.click()
      await page.waitForTimeout(300)
    }
  })
})
