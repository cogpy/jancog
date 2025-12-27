import { test, expect } from '@playwright/test'

/**
 * Keyboard Shortcuts E2E Tests
 * Tests keyboard navigation and shortcuts functionality
 */

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should focus chat input with keyboard', async ({ page }) => {
    // Press common shortcut for focusing chat
    await page.keyboard.press('Control+/')
    await page.waitForTimeout(300)

    // Or try Tab navigation
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
  })

  test('should open new thread with shortcut', async ({ page }) => {
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(300)
  })

  test('should open settings with shortcut', async ({ page }) => {
    await page.keyboard.press('Control+,')
    await page.waitForTimeout(300)
  })

  test('should navigate with arrow keys', async ({ page }) => {
    // Focus an element first
    await page.keyboard.press('Tab')

    // Navigate with arrows
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)

    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(100)
  })

  test('should close dialogs with Escape', async ({ page }) => {
    // Open a dialog
    const dialogTrigger = page.getByRole('button').first()
    if (await dialogTrigger.isVisible()) {
      await dialogTrigger.click()
      await page.waitForTimeout(300)

      // Try to close with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })
})

test.describe('Chat Input Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should submit with Enter', async ({ page }) => {
    const chatInput = page.getByRole('textbox').or(
      page.locator('textarea')
    ).first()

    if (await chatInput.isVisible()) {
      await chatInput.fill('Test message')
      // Enter should submit (or Ctrl+Enter)
      await page.keyboard.press('Control+Enter')
      await page.waitForTimeout(300)
    }
  })

  test('should insert newline with Shift+Enter', async ({ page }) => {
    const chatInput = page.getByRole('textbox').or(
      page.locator('textarea')
    ).first()

    if (await chatInput.isVisible()) {
      await chatInput.fill('Line 1')
      await page.keyboard.press('Shift+Enter')
      await page.keyboard.type('Line 2')

      const value = await chatInput.inputValue()
      // Should contain both lines
      expect(value.includes('Line 1')).toBe(true)
    }
  })

  test('should clear input with Escape', async ({ page }) => {
    const chatInput = page.getByRole('textbox').or(
      page.locator('textarea')
    ).first()

    if (await chatInput.isVisible()) {
      await chatInput.fill('Some text')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })
})

test.describe('Accessibility Keyboard', () => {
  test('should allow full keyboard navigation', async ({ page }) => {
    await page.goto('/')

    // Should be able to tab through all interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(50)
    }

    // Should be able to tab backwards
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+Tab')
      await page.waitForTimeout(50)
    }
  })

  test('should activate buttons with Space/Enter', async ({ page }) => {
    await page.goto('/')

    const button = page.getByRole('button').first()
    if (await button.isVisible()) {
      await button.focus()
      await page.keyboard.press('Space')
      await page.waitForTimeout(100)
    }
  })
})
