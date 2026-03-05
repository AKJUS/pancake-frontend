import menuConfig from 'components/Menu/config/config'
import { getActiveMenuItem, getActiveSubMenuItem } from 'components/Menu/utils'

const mockT = (key) => key

describe('getActiveMenuItem', () => {
  it('should return an active item', () => {
    // Given
    const pathname = '/swap'

    // When
    const result = getActiveMenuItem({ pathname, menuConfig: menuConfig(mockT, false, undefined) })

    // Then
    expect(result).toEqual(menuConfig(mockT, false, undefined)[0])
  })

  it('should return an active item if pathname found in subitems', () => {
    // Given
    const pathname = '/liquidity/pools'

    // When
    const result = getActiveMenuItem({ pathname, menuConfig: menuConfig(mockT, false, undefined) })

    // Then
    expect(result).toEqual(menuConfig(mockT, false, undefined)[2])
  })

  it('should not return an item that only includes pathname but not starts with', () => {
    // Given
    const pathname = '/info/pairs'

    // When
    const result = getActiveMenuItem({ pathname, menuConfig: menuConfig(mockT, false, undefined) })

    // Then
    expect(result).toBeUndefined()
  })

  it('should return undefined if item is not found', () => {
    // Given
    const pathname = '/corgi'

    // When
    const result = getActiveMenuItem({ pathname, menuConfig: menuConfig(mockT, false, undefined) })

    // Then
    expect(result).toEqual(undefined)
  })
})

describe('getActiveSubMenuItem', () => {
  it('should return undefined', () => {
    // Given
    const pathname = '/'

    // When
    const result = getActiveSubMenuItem({ pathname, menuItem: menuConfig(mockT, false, undefined)[2] })

    // Then
    expect(result).toEqual(undefined)
  })

  it('should return an active sub item', () => {
    // Given
    const pathname = '/liquidity/pools'

    // When
    const result = getActiveSubMenuItem({ pathname, menuItem: menuConfig(mockT, false, undefined)[2] })

    // Then
    expect(result).toEqual(menuConfig(mockT, false, undefined)[2].items?.[0])
  })

  it('should return undefined if item is not found', () => {
    // Given
    const pathname = '/corgi'

    // When
    const result = getActiveSubMenuItem({ pathname, menuItem: menuConfig(mockT, false, undefined)[2] })

    // Then
    expect(result).toEqual(undefined)
  })

  it.todo('should return items with supportChainId')
})
