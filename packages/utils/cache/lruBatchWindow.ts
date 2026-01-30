import type { LruBatchOptions } from './batchResolve'
import { lruBatch } from './batchResolve'
import type { QueueWithWindowOptions } from './queueWithWindow'
import { queueWithWindow } from './queueWithWindow'

type LruBatchWindowOptions<TInput> = LruBatchOptions<TInput> & QueueWithWindowOptions

/**
 * Wraps a resolver with both LRU caching and time-windowed batching.
 */
export const lruBatchWindow = <Input, Output>(
  resolver: (inputs: Input[]) => Promise<Output[]>,
  options: LruBatchWindowOptions<Input>,
) => {
  const { timeWindow, ...lruOptions } = options
  const cachedResolver = lruBatch<Input, Output>(resolver, lruOptions)
  return queueWithWindow<Input, Output>(cachedResolver, { timeWindow })
}
