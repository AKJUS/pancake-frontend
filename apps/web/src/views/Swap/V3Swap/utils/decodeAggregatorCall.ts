import { aggregatorAbi } from '@pancakeswap/aggregator-sdk'
import { Address, decodeFunctionData, Hex } from 'viem'

// Returns the on-chain `recipient` argument from aggregator router calldata.
// Throws if the calldata targets a function other than swapExactIn / swapWrap —
// whitelist-by-selector so an allowlisted router cannot be abused via sweep() etc.
export function extractAggregatorRecipient(calldata: Hex): Address {
  const decoded = decodeFunctionData({ abi: aggregatorAbi, data: calldata })

  if (decoded.functionName === 'swapExactIn') {
    // (orderId, request, routesAmount, routes, feeConfig, recipient)
    const [, , , , , recipient] = decoded.args
    return recipient
  }

  if (decoded.functionName === 'swapWrap') {
    // (orderId, amount, isWrap, feeConfig, recipient)
    const [, , , , recipient] = decoded.args
    return recipient
  }

  throw new Error(`Unexpected aggregator calldata function: ${decoded.functionName}`)
}
