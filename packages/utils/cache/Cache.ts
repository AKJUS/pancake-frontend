export type CacheOptions = {
  ttl: number
  cleanupInterval?: number
}

type CacheEntry<V> = {
  value: V
  expiresAt: number
}

/**
 * Minimal in-memory cache that stores entries with TTL-enforced expiration.
 */
export class Cache<K, V> {
  private readonly ttl: number

  private readonly store = new Map<K, CacheEntry<V>>()

  private cleanupTimer?: NodeJS.Timeout

  constructor(options: CacheOptions) {
    if (options.ttl <= 0) {
      throw new Error('Cache ttl must be greater than 0')
    }

    this.ttl = options.ttl

    if (options.cleanupInterval && options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanupExpired(), options.cleanupInterval)

      if (typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref()
      }
    }
  }

  set(key: K, value: V, ttl?: number) {
    const expiresAt = Date.now() + (ttl ?? this.ttl)
    this.store.set(key, { value, expiresAt })
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key)

    if (!entry) {
      return undefined
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  delete(key: K) {
    return this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }

  dispose() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    this.clear()
  }

  private cleanupExpired() {
    const now = Date.now()

    this.store.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        this.store.delete(key)
      }
    })
  }
}
