import { Cache } from './Cache'

type LruOptions<Fn extends (...args: any[]) => unknown> = {
  key: (...args: Parameters<Fn>) => string
  ttl: number
}

type CacheEntry<Fn extends (...args: any[]) => unknown> = {
  value: ReturnType<Fn>
}

const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as Promise<unknown>).then === 'function' &&
    'catch' in value &&
    typeof (value as Promise<unknown>).catch === 'function'
  )
}

/**
 * Returns an LRU cached version of the provided function. Cache entries are identified
 * via the supplied key function and respect the provided TTL.
 */
export const lruV2 = <Fn extends (...args: any[]) => Promise<unknown> | unknown>(
  fn: Fn,
  options: LruOptions<Fn>,
): Fn => {
  const cache = new Cache<string, CacheEntry<Fn>>({
    ttl: options.ttl,
  })

  const wrapped = ((...args: Parameters<Fn>) => {
    const cacheKey = options.key(...args)
    const cached = cache.get(cacheKey)

    if (cached !== undefined) {
      return cached.value
    }

    const result = fn(...args) as ReturnType<Fn>
    cache.set(cacheKey, { value: result })

    if (isPromiseLike(result)) {
      result.catch(() => {
        cache.delete(cacheKey)
      })
    }

    return result
  }) as Fn

  return wrapped
}
