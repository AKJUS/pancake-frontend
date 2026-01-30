export type QueueWithWindowOptions = {
  timeWindow: number
}

type QueueItem<Input, Output> = {
  inputs: Input[]
  resolve: (value: Output[]) => void
  reject: (reason?: unknown) => void
}

/**
 * Collects array-based async calls and runs them in batches within a time window.
 * The wrapped function must accept and return arrays of the same length.
 */
export const queueWithWindow = <Input, Output>(
  fn: (inputs: Input[]) => Promise<Output[]>,
  options: QueueWithWindowOptions,
) => {
  let queue: Array<QueueItem<Input, Output>> = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = async () => {
    const currentBatch = queue
    queue = []
    timer = null

    if (!currentBatch.length) {
      return
    }

    const combinedInputs = currentBatch.flatMap((item) => item.inputs)

    try {
      const combinedOutputs = await fn(combinedInputs)

      if (combinedOutputs.length !== combinedInputs.length) {
        throw new Error('queueWithWindow: output length mismatch')
      }

      let offset = 0
      currentBatch.forEach((item) => {
        const slice = combinedOutputs.slice(offset, offset + item.inputs.length)
        offset += item.inputs.length
        item.resolve(slice)
      })
    } catch (error) {
      currentBatch.forEach((item) => item.reject(error))
    }
  }

  return (inputs: Input[]) => {
    if (!Array.isArray(inputs)) {
      return Promise.reject(new Error('queueWithWindow expects array inputs'))
    }

    if (inputs.length === 0) {
      return Promise.resolve([] as Output[])
    }

    return new Promise<Output[]>((resolve, reject) => {
      queue.push({ inputs, resolve, reject })

      if (!timer) {
        timer = setTimeout(flush, options.timeWindow)
      }
    })
  }
}
