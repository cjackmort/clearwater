/**
 * The user's Anthropic API key, stored only on this device (localStorage).
 * Used by the scanner service to call the Claude API directly from the
 * browser — there is no ClearWater backend.
 */

const STORAGE_KEY = 'clearwater.anthropicApiKey'

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}
