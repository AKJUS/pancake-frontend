import { atom, useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

const userPancakePicksAtom = atomWithStorage('pcs:user-pancake-picks', false)
const mobileUserPancakePicksAtom = atom(false)

export function useUserPancakePicks(isMobile: boolean) {
  return useAtom(isMobile ? mobileUserPancakePicksAtom : userPancakePicksAtom)
}
