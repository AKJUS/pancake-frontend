// Canonical PancakeSwap LP tokens: V2 pair "Cake-LP" (name "Pancake LPs")
// and StableSwap "Stable-LP" (name "Pancake StableSwap LPs"). Name check is
// anchored to "pancake" so unrelated tokens containing "LP" don't match.
const LP_SYMBOLS = new Set(['cake-lp', 'stable-lp'])
const LP_NAME_REGEX = /^pancake.*\blps?\b/i

const isPancakeLpToken = (token: { symbol?: string | null; name?: string | null }): boolean => {
  if (LP_SYMBOLS.has(token.symbol?.toLowerCase() ?? '')) return true
  return LP_NAME_REGEX.test(token.name ?? '')
}

export default isPancakeLpToken
