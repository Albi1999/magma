// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'

import { isDark } from '../src/dark-mode.js'

// The dark mode of the studio is the one of the palette of Magma (design-tokens,
// src/formats/dark-scheme.ts): the mode the person chose, the scheme a theme is locked to, and the
// OS when the mode is system or no mds-pref controls the page.

const html = document.documentElement
const set = (attrs: { classes?: string[]; controller?: boolean }) => {
  html.className = (attrs.classes ?? []).join(' ')
  html.toggleAttribute('data-magma-pref', attrs.controller ?? true)
}
const os = (dark: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    addEventListener() {},
    removeEventListener() {},
  }))

afterEach(() => {
  html.className = ''
  html.removeAttribute('data-magma-pref')
  vi.unstubAllGlobals()
})

test('the mode the person chose wins over the OS', () => {
  os(false)
  set({ classes: ['pref-mode-dark'] })
  expect(isDark()).toBe(true)
  os(true)
  set({ classes: ['pref-mode-light'] })
  expect(isDark()).toBe(false)
})

test('the system mode, and a page with no mds-pref, follow the OS', () => {
  for (const attrs of [{ classes: ['pref-mode-system'] }, { controller: false }]) {
    set(attrs)
    os(true)
    expect(isDark()).toBe(true)
    os(false)
    expect(isDark()).toBe(false)
  }
})

test('a theme locked to one scheme wins over the mode', () => {
  os(true)
  set({ classes: ['pref-mode-dark', 'pref-theme-scheme-light'] })
  expect(isDark()).toBe(false)
  set({ classes: ['pref-mode-light', 'pref-theme-scheme-dark'] })
  expect(isDark()).toBe(true)
})

test('without matchMedia the OS counts as light', () => {
  vi.stubGlobal('matchMedia', undefined)
  set({ classes: ['pref-mode-system'] })
  expect(isDark()).toBe(false)
})
