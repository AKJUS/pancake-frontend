import { Attribution } from 'ox/erc8021'
import type { Hex } from 'viem'

const BUILDER_CODE_MIN_LENGTH = 1
const BUILDER_CODE_MAX_LENGTH = 32
const ASCII_PRINTABLE_NO_SPACE = /^[\x21-\x7E]+$/

export function buildBuilderCodeDataSuffix(builderCode: string): Hex {
  if (builderCode.length < BUILDER_CODE_MIN_LENGTH || builderCode.length > BUILDER_CODE_MAX_LENGTH) {
    throw new Error(`Builder code must be ${BUILDER_CODE_MIN_LENGTH}-${BUILDER_CODE_MAX_LENGTH} characters`)
  }

  if (!ASCII_PRINTABLE_NO_SPACE.test(builderCode)) {
    throw new Error('Builder code must be printable ASCII without spaces')
  }

  return Attribution.toDataSuffix({ codes: [builderCode] }) as Hex
}

export function appendDataSuffix(calldata: Hex, suffix: Hex): Hex {
  if (!suffix || suffix === '0x') {
    return calldata
  }

  return `${calldata}${suffix.slice(2)}` as Hex
}
