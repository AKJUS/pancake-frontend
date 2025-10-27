import { WorkerUrlExtractor as Worker } from './workerUrlExtractor'

async function retryFetch(url, retries = 5, baseDelay = 3000) {
  let attempt = 0
  let lastError

  while (attempt < retries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      // eslint-disable-next-line no-await-in-loop
      const blob = await response.blob()
      return blob
    } catch (err) {
      lastError = err
      attempt++
      if (attempt >= retries) break
      const wait = 2 ** (attempt - 1) * baseDelay
      console.warn(`[WorkerLoader] Retry ${attempt}/${retries} failed — waiting ${wait}ms...`)
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, wait))
    }
  }

  console.error('[WorkerLoader] All retries failed for worker script:', lastError)
  throw lastError
}

// Using alias to allow worker url to be statically analyzable by webpack
// @see https://github.com/webpack/webpack/discussions/14648#discussioncomment-1589272
export function createWorkerScriptLoader() {
  const worker = new Worker(/* webpackChunkName: "quote-worker" */ new URL('../quote-worker.ts', import.meta.url))
  let loadScriptPromise: Promise<string> | undefined

  return async function loadWorkerScript() {
    if (!loadScriptPromise) {
      loadScriptPromise = retryFetch(worker.url)
        .then((b) => {
          const base = typeof window !== 'undefined' ? window.location.href : undefined
          const additionalWorkerSource = `
            const originalImportScripts = self.importScripts;
            self.importScripts = (url) => originalImportScripts.call(self, new URL(url, "${base}").toString());
          `
          return new Blob([additionalWorkerSource, b], { type: 'application/javascript' })
        })
        .then((b) => URL.createObjectURL(b))
    }
    return loadScriptPromise
  }
}
