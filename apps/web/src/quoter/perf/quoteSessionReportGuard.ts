const reportedQuoteSessions = new Set<string>()

export function shouldReportQuoteSession(quoteHash?: string): boolean {
  if (!quoteHash) return false
  if (reportedQuoteSessions.has(quoteHash)) return false
  reportedQuoteSessions.add(quoteHash)
  return true
}

export function resetReportedQuoteSessions() {
  reportedQuoteSessions.clear()
}
