import { atom, useAtomValue } from 'jotai'
import { AdPicks } from '../Ads/AdPicks'
import { AdSlide, PicksConfig } from '../ads.types'

const picksConfigAtom = atom(async () => {
  const time = Math.floor((Date.now() / 1000) * 60 * 5) // Cache 5min

  const urlPreview = `https://proofs.pancakeswap.com/picks/today-preview.json?t=${time}`
  const showPreviewVersion = process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production'
  const url = showPreviewVersion ? urlPreview : `https://proofs.pancakeswap.com/picks/today.json?t=${time}`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const json = await response.json()
    if (!json || !Array.isArray(json.configs)) return null
    return json as PicksConfig
  } catch (ex) {
    return null
  }
})
export const usePicksConfig = () => {
  const picksConfig = useAtomValue(picksConfigAtom)

  if (!picksConfig) {
    return []
  }

  const adList: AdSlide[] = picksConfig.configs.map((config, i) => {
    return {
      id: `pick-${config.poolId}`,
      component: <AdPicks config={config} index={i} />,
    }
  })
  return adList
}
