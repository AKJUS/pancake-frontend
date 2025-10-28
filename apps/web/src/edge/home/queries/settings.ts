export const HOME_PAGE_CACHE_TTL = 600 * 1000 // 10 minutes for update
export const HOME_PAGE_CACHE_MAX_AGE = 60 * 60 * 1000 // 1 hour

export const getHomeCacheSettings = (name: string) => {
  return {
    ttl: HOME_PAGE_CACHE_TTL,
    maxAge: HOME_PAGE_CACHE_MAX_AGE,
    cacheNextEpochOnHalfTTS: true,
  }
}
