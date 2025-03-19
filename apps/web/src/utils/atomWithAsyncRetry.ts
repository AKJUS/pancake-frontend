import { atom } from 'jotai'

export function atomWithAsyncRetry<T>({
  asyncFn,
  maxRetries = 3,
  delayMs = 1000,
  fallbackValue = undefined,
}: {
  asyncFn: () => Promise<T>
  maxRetries?: number
  delayMs?: number
  fallbackValue?: T
}) {
  const triggerAtom = atom(0) // triggers re-fetching when incremented

  const retryableAsyncAtom = atom(async (get) => {
    get(triggerAtom) // re-run this async when triggerAtom changes
    let attempt = 0
    while (attempt < maxRetries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await asyncFn()
      } catch (error) {
        attempt++
        if (attempt >= maxRetries) {
          if (fallbackValue) {
            return fallbackValue
          }
          throw error
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    throw new Error('Retries exhausted')
  })

  const retryAtom = atom(
    (get) => get(retryableAsyncAtom),
    (_get, set) => set(triggerAtom, (c) => c + 1),
  )

  return retryAtom
}
