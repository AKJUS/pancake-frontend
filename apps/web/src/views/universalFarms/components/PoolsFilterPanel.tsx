import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { Flex, Input, InputGroup, QuestionHelper, SearchIcon } from '@pancakeswap/uikit'
import { INetworkProps, IProtocolMenuProps, NetworkFilter, ProtocolMenu } from '@pancakeswap/widgets-internal'
import { useActiveChainId } from 'hooks/useActiveChainId'
import debounce from 'lodash/debounce'
import isEmpty from 'lodash/isEmpty'
import isUndefined from 'lodash/isUndefined'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UpdaterByChainId } from 'state/lists/updater'
import styled from 'styled-components'
import { usePoolProtocols } from '../hooks'
import { MAINNET_CHAINS, useAllChainsOpts } from '../hooks/useMultiChains'

const PoolsFilterContainer = styled(Flex)<{ $childrenCount: number }>`
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 16px;
  & > div {
    flex: 1;
  }

  & > div:nth-child(1),
  & > div:nth-child(2) {
    width: calc(${({ $childrenCount: $childCount }) => `${100 / $childCount}%`} - 16px);
  }

  @media (min-width: 1200px) {
    & {
      flex-wrap: nowrap;
    }
  }

  @media (max-width: 967px) {
    & > div:nth-child(3),
    & > div:nth-child(4) {
      flex: 0 0 100%;
      max-width: 100%;
    }
  }

  @media (max-width: 575px) {
    gap: 8px;
    & > div {
      flex: 0 0 100%;
      max-width: 100%;
    }
  }
`

export const useSelectedProtocols = (selectedIndex: number): Protocol[] => {
  const allProtocols = usePoolProtocols()
  return useMemo(() => {
    const { value } = allProtocols[selectedIndex]
    if (value === null || selectedIndex === 0 || selectedIndex > allProtocols.length - 1) {
      return allProtocols.filter((t) => t.value !== null).flatMap((t) => t.value) as NonNullable<Protocol[]>
    }
    return Array.isArray(value) ? value : [value]
  }, [selectedIndex, allProtocols])
}

export interface IPoolsFilterPanelProps {
  value: {
    selectedProtocolIndex?: IProtocolMenuProps['activeIndex']
    selectedNetwork?: INetworkProps['value']
    search?: string
  }
  onChange: (value: Partial<IPoolsFilterPanelProps['value']>) => void
  showNetworkFilter?: boolean
  showProtocolMenu?: boolean
  includeSolana?: boolean
}
export const PoolsFilterPanel: React.FC<React.PropsWithChildren<IPoolsFilterPanelProps>> = ({
  value,
  children,
  onChange,
  showNetworkFilter = true,
  showProtocolMenu = true,
  includeSolana = true,
}) => {
  const { chainId: activeChainId } = useActiveChainId()
  const { selectedNetwork, selectedProtocolIndex: selectedType } = value
  const { t } = useTranslation()
  const allChainsOpts = useAllChainsOpts({ includeSolana })

  const handleProtocolIndexChange: IProtocolMenuProps['onChange'] = useCallback(
    (index) => {
      onChange({ selectedProtocolIndex: index })
    },
    [onChange],
  )

  const handleNetworkChange: INetworkProps['onChange'] = useCallback(
    (network, e) => {
      if (isEmpty(e.value)) {
        e.preventDefault()
        onChange({ selectedNetwork: [activeChainId] })
      } else {
        onChange({ selectedNetwork: network })
      }
    },
    [onChange, activeChainId],
  )

  const [searchText, setSearchText] = useState(value.search ?? '')
  const focusRef = useRef<boolean>(false)

  const onChangeRef = useRef(onChange)

  const debouncedOnChange = useRef(
    debounce((val: string) => {
      onChangeRef.current({ search: val })
    }, 1000),
  )

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    focusRef.current = true
    setSearchText(newValue)
    debouncedOnChange.current(newValue)
  }, [])

  useEffect(() => {
    if (value.search === searchText || focusRef.current) return
    setSearchText(value.search ?? '')
  }, [value.search, searchText])

  // Update onChangeRef when onChange changes - but DON'T cancel debounce!
  // The old pattern was canceling debounce whenever onChange changed, which caused
  // search to never execute if the callback was recreated frequently.
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Only cancel debounce on unmount
  useEffect(() => {
    const debounced = debouncedOnChange.current
    return () => {
      debounced.cancel()
    }
  }, [])

  const protocols = usePoolProtocols()
  const childrenCount = useMemo(() => 2 + React.Children.count(children), [children])

  return (
    <>
      {MAINNET_CHAINS.map((c) => (
        <UpdaterByChainId key={c.id} chainId={c.id} />
      ))}
      <PoolsFilterContainer $childrenCount={childrenCount}>
        {showNetworkFilter && !isUndefined(selectedNetwork) && (
          <NetworkFilter data={allChainsOpts} value={selectedNetwork} onChange={handleNetworkChange} />
        )}
        <Flex alignItems="center">
          <InputGroup startIcon={<SearchIcon color="textSubtle" />}>
            <Input
              placeholder="Search"
              value={searchText}
              onBlur={() => {
                focusRef.current = false
              }}
              onChange={handleSearchChange}
            />
          </InputGroup>
          <QuestionHelper
            text={t(
              "Search by token name/address, pool type (e.g. clamm, lbamm), features (e.g. dynamic fees), or pool address. Example: 'bnb usdt infinity clamm'",
            )}
            placement="bottom-start"
            ml="4px"
          />
        </Flex>
        {showProtocolMenu && !isUndefined(selectedType) && (
          <Flex alignSelf="flex-start">
            <ProtocolMenu data={protocols} activeIndex={selectedType} onChange={handleProtocolIndexChange} />
          </Flex>
        )}
        {children}
      </PoolsFilterContainer>
    </>
  )
}
