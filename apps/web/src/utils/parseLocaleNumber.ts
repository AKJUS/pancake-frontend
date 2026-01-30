type Separators = { group: string; decimal: string }

const separatorsCache = new Map<string, Separators>()

function getSeparators(locale: string | undefined): Separators {
  const cacheKey = locale ?? '__default__'
  const cached = separatorsCache.get(cacheKey)
  if (cached) return cached

  // Use a value guaranteed to include both group and decimal parts.
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
  const group = parts.find((p) => p.type === 'group')?.value ?? ','
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'

  const seps = { group, decimal }
  separatorsCache.set(cacheKey, seps)
  return seps
}

function removeAllButLast(haystack: string, needle: string): string {
  const lastIndex = haystack.lastIndexOf(needle)
  if (lastIndex === -1) return haystack
  const before = haystack.slice(0, lastIndex).split(needle).join('')
  const after = haystack
    .slice(lastIndex + needle.length)
    .split(needle)
    .join('')
  return `${before}${needle}${after}`
}

function normalizeToAsciiNumberString(input: string, locale: string | undefined): string | undefined {
  let value = input.trim()
  if (!value) return undefined

  // Remove common whitespace group separators.
  value = value.replace(/[\s\u00A0\u202F]/g, '')

  // Normalize different minus characters to ASCII "-".
  value = value.replace(/[−‒–—]/g, '-')

  const { group, decimal } = getSeparators(locale)
  const allowedSeparators = new Set(['.', ',', group, decimal])

  // Keep digits, a single leading sign, and known separators; drop currency symbols/letters.
  value = value
    .split('')
    .filter((ch, index) => {
      if (ch >= '0' && ch <= '9') return true
      if ((ch === '+' || ch === '-') && index === 0) return true
      if (allowedSeparators.has(ch)) return true
      return false
    })
    .join('')

  if (!value || value === '+' || value === '-') return undefined

  // Decide decimal separator. Prefer the locale decimal if present; otherwise fall back to heuristics.
  let decimalSep: string | undefined
  if (decimal && value.includes(decimal)) {
    decimalSep = decimal
  } else if (value.includes('.') && value.includes(',')) {
    decimalSep = value.lastIndexOf('.') > value.lastIndexOf(',') ? '.' : ','
  } else if (value.includes('.')) {
    decimalSep = '.'
  } else if (value.includes(',')) {
    // In locales where "," is the group separator, treat a single "," with 1–2 trailing digits as decimal.
    if (group === ',' && value.split(',').length === 2) {
      const trailing = value.split(',')[1] ?? ''
      decimalSep = trailing.length > 0 && trailing.length <= 2 ? ',' : undefined
    } else {
      decimalSep = ','
    }
  } else if (decimal && value.includes(decimal)) {
    decimalSep = decimal
  }

  const separatorsToStrip = new Set<string>([group, '.', ',', decimal])
  if (decimalSep) separatorsToStrip.delete(decimalSep)

  let normalized = value
  for (const sep of separatorsToStrip) {
    if (!sep) continue
    normalized = normalized.split(sep).join('')
  }

  if (decimalSep) {
    normalized = removeAllButLast(normalized, decimalSep)
    const lastIndex = normalized.lastIndexOf(decimalSep)
    if (lastIndex !== -1) {
      normalized = `${normalized.slice(0, lastIndex)}.${normalized.slice(lastIndex + decimalSep.length)}`
    }
  }

  if (normalized.startsWith('.')) normalized = `0${normalized}`
  if (normalized === '' || normalized === '+' || normalized === '-' || normalized === '+.' || normalized === '-.')
    return undefined

  return normalized
}

export function parseLocaleNumber(input: string, locale?: string): number | undefined {
  const normalized = normalizeToAsciiNumberString(input, locale)
  if (normalized === undefined) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}
