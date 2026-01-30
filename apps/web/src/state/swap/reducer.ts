import { createReducer } from '@reduxjs/toolkit'
import { atomWithReducer } from 'jotai/utils'
import { Field, replaceSwapState, selectCurrency, setRecipient, switchCurrencies, typeInput } from './actions'

export interface SwapState {
  readonly independentField: Field
  readonly typedValue: string
  readonly [Field.INPUT]: {
    readonly currencyId: string | undefined
    readonly chainId: number | undefined
  }
  readonly [Field.OUTPUT]: {
    readonly currencyId: string | undefined
    readonly chainId: number | undefined
  }
  // the typed recipient address or ENS name, or null if swap should go to sender
  readonly recipient: string | null
}

const initialState: SwapState = {
  independentField: Field.INPUT,
  typedValue: '',
  [Field.INPUT]: {
    currencyId: '',
    chainId: undefined,
  },
  [Field.OUTPUT]: {
    currencyId: '',
    chainId: undefined,
  },
  recipient: null,
}

const reducer = createReducer<SwapState>(initialState, (builder) =>
  builder
    .addCase(
      replaceSwapState,
      (
        state,
        { payload: { typedValue, recipient, field, inputCurrencyId, outputCurrencyId, inputChainId, outputChainId } },
      ) => {
        return {
          [Field.INPUT]: {
            currencyId: inputCurrencyId,
            chainId: inputChainId,
          },
          [Field.OUTPUT]: {
            currencyId: outputCurrencyId,
            chainId: outputChainId,
          },
          independentField: field,
          typedValue,
          recipient,
        }
      },
    )
    .addCase(selectCurrency, (state, { payload: { currencyId, chainId, field } }) => {
      const otherField = field === Field.INPUT ? Field.OUTPUT : Field.INPUT

      if (currencyId === state[otherField].currencyId && chainId === state[otherField].chainId) {
        // the case where we have to swap the order
        return {
          ...state,
          independentField: state.independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT,
          [field]: { currencyId, chainId },
          [otherField]: { currencyId: state[field].currencyId, chainId: state[field].chainId },
        }
      }
      // the normal case
      return {
        ...state,
        [field]: { currencyId, chainId },
      }
    })
    .addCase(switchCurrencies, (state) => {
      return {
        ...state,
        independentField: state.independentField === Field.INPUT ? Field.OUTPUT : Field.INPUT,
        [Field.INPUT]: { currencyId: state[Field.OUTPUT].currencyId, chainId: state[Field.OUTPUT].chainId },
        [Field.OUTPUT]: { currencyId: state[Field.INPUT].currencyId, chainId: state[Field.INPUT].chainId },
      }
    })
    .addCase(typeInput, (state, { payload: { field, typedValue } }) => {
      return {
        ...state,
        independentField: field,
        typedValue,
      }
    })
    .addCase(setRecipient, (state, { payload: { recipient } }) => {
      state.recipient = recipient
    }),
)

export const swapReducerAtom = atomWithReducer(initialState, reducer)
