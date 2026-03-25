import { atomFamily } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import { atomWithLoadable } from 'quoter/atom/atomWithLoadable'
import { AdSlide, RemoteAds } from '../ads.types'
import { JsonAds } from '../Ads/JsonAds'

export const jsonAdsConfigAtom = atomFamily((url: string) => {
  return atomWithLoadable<RemoteAds[]>(async () => {
    if (!url) return []
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    if (!Array.isArray(json)) return []
    return json.filter((item): item is RemoteAds => item !== null && typeof item === 'object')
  })
})

export const useJsonAdsConfig = (url: string): AdSlide[] => {
  const loadable = useAtomValue(jsonAdsConfigAtom(url))
  const jsonAds = loadable.unwrapOr([])

  const now = Date.now()

  return jsonAds
    .filter((config) => {
      if (config.startTime && config.endTime) {
        const start = Date.parse(config.startTime)
        const end = Date.parse(config.endTime)

        if (!Number.isNaN(start)) {
          if (now < start) return false
        }
        if (!Number.isNaN(end)) {
          if (now > end) return false
        }
      }

      return true
    })
    .map((config) => ({
      id: config.id,
      component: <JsonAds ad={config} />,
      priority: config.priority,
    }))
}

export default useJsonAdsConfig
