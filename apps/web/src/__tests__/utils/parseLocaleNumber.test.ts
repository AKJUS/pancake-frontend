import { parseLocaleNumber } from 'utils/parseLocaleNumber'

describe('parseLocaleNumber', () => {
  it.each([
    ['1,23', 'de-DE', 1.23],
    ['1.234,56', 'de-DE', 1234.56],
    ['€1.234,56', 'de-DE', 1234.56],
    ['1\u00A0234,56', 'fr-FR', 1234.56],
    ['1\u202F234,56', 'fr-FR', 1234.56],
    ['1,234.56', 'en-US', 1234.56],
    ['1,23', 'en-US', 1.23],
    ['1,234', 'en-US', 1234],
    ['.5', 'en-US', 0.5],
  ])('parses "%s" in %s', (value, locale, expected) => {
    expect(parseLocaleNumber(value, locale)).toBe(expected)
  })

  it.each(['', '   ', '-', '+', 'abc', '$'])('returns undefined for "%s"', (value) => {
    expect(parseLocaleNumber(value, 'en-US')).toBeUndefined()
  })
})
