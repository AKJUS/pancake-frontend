import { atom } from 'jotai'

export const POSTHOG_FLAGS = {
  AGGREGATOR_V1: 'aggregator-v1',
} as const

export const posthogFlagsAtom = atom<Record<string, boolean>>({})
