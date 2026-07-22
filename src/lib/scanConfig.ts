/**
 * Scan configuration, stored only on this device (localStorage).
 *
 * Scanning is free-first: on-device OCR (Tesseract.js) always runs and needs
 * no key or account. AI is an *optional* backup checker the user turns on — it
 * re-reads the same photo to fill gaps and correct OCR mistakes. When enabled
 * they pick a provider and supply that provider's own key:
 *   - Gemini  → Google's free tier ($0 for personal use)
 *   - Anthropic → Claude, pay-per-scan (the original behavior)
 *
 * Keys live only in this browser and are sent nowhere but the chosen provider.
 */

export type ScanProvider = 'gemini' | 'anthropic'

export interface ScanConfig {
  /** Whether the optional AI backup check runs after OCR */
  aiEnabled: boolean
  provider: ScanProvider
  geminiKey: string
  anthropicKey: string
}

const STORAGE_KEY = 'clearwater.scanConfig'
/** Pre-refactor key location, migrated on first read. */
const LEGACY_ANTHROPIC_KEY = 'clearwater.anthropicApiKey'

const DEFAULTS: ScanConfig = {
  aiEnabled: false,
  provider: 'gemini',
  geminiKey: '',
  anthropicKey: '',
}

function readRaw(): ScanConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ScanConfig>
      return {
        aiEnabled: !!parsed.aiEnabled,
        provider: parsed.provider === 'anthropic' ? 'anthropic' : 'gemini',
        geminiKey: typeof parsed.geminiKey === 'string' ? parsed.geminiKey : '',
        anthropicKey: typeof parsed.anthropicKey === 'string' ? parsed.anthropicKey : '',
      }
    }
  } catch {
    // fall through to migration / defaults
  }

  // One-time migration: an earlier build stored a bare Anthropic key. Preserve
  // it and turn AI on so existing users keep working after the update.
  const legacy = localStorage.getItem(LEGACY_ANTHROPIC_KEY)
  if (legacy && legacy.trim()) {
    const migrated: ScanConfig = {
      ...DEFAULTS,
      aiEnabled: true,
      provider: 'anthropic',
      anthropicKey: legacy.trim(),
    }
    writeRaw(migrated)
    localStorage.removeItem(LEGACY_ANTHROPIC_KEY)
    return migrated
  }

  return { ...DEFAULTS }
}

function writeRaw(config: ScanConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function getScanConfig(): ScanConfig {
  return readRaw()
}

export function setScanConfig(patch: Partial<ScanConfig>): ScanConfig {
  const next: ScanConfig = { ...readRaw(), ...patch }
  next.geminiKey = next.geminiKey.trim()
  next.anthropicKey = next.anthropicKey.trim()
  writeRaw(next)
  return next
}

/** The key for the currently selected provider (empty string if unset). */
export function activeProviderKey(config: ScanConfig = readRaw()): string {
  return config.provider === 'anthropic' ? config.anthropicKey : config.geminiKey
}

/**
 * True when the AI backup check is turned on AND a key exists for the chosen
 * provider — i.e. the AI pass will actually run.
 */
export function aiScanReady(config: ScanConfig = readRaw()): boolean {
  return config.aiEnabled && activeProviderKey(config).length > 0
}
