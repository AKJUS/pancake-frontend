import { useRouter } from 'next/router'
import { usePreviousValue, useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import {
  Box,
  BoxProps,
  ButtonMenu,
  ButtonMenuItem,
  Card,
  Text,
  FlexGap,
  PreTitle,
  QuestionHelper,
  useMatchBreakpoints,
  DropdownMenu,
  Flex,
  ArrowDropDownIcon,
} from '@pancakeswap/uikit'
import styled from 'styled-components'
import MenuItem from '@pancakeswap/uikit/components/MenuItem/MenuItem'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeeLevelQueryState } from 'state/infinity/create'
import { useActiveChainId } from 'hooks/useAccountActiveChain'
import { isSolana, NonEVMChainId } from '@pancakeswap/chains'
import { useSolanaClmmFeeTiers } from 'hooks/solana/useSolanaClmmFeeTiers'
import { useSolanaExistingFeeTiers } from 'hooks/solana/useSolanaExistingFeeTiers'
import { UnifiedCurrency } from '@pancakeswap/swap-sdk-core'

import { PRESET_FEE_LEVELS_V3 } from '../../constants'

export type FieldFeeLevelProps = Omit<BoxProps, 'onSelect'> & {
  baseCurrency?: UnifiedCurrency
  quoteCurrency?: UnifiedCurrency
  feeAmount?: number
  onSelect?: (index: number, option: number) => void
}

const parseFeeAsReadable = (fee: number) => {
  return `${fee / 1e4}%`
}

const decimals = 4

const ScrollableDropdown = styled(DropdownMenu)`
  & > div[data-popper-placement] {
    max-height: 320px;
    overflow-y: auto;
  }
`

export const FieldFeeLevel: React.FC<FieldFeeLevelProps> = ({
  baseCurrency,
  quoteCurrency,
  feeAmount,
  onSelect,
  ...boxProps
}) => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const { theme } = useTheme()
  const [feeLevel, setFeeLevel] = useFeeLevelQueryState()
  const [inputValue, setInputValue] = useState<string | null>(null)
  const { chainId } = useActiveChainId()
  const isSolanaChain = isSolana(chainId)
  const solanaFeeTiers = useSolanaClmmFeeTiers()
  const router = useRouter()

  // Fetch existing Solana pools for the selected pair to disable used fee tiers
  const existingSolanaFeeTiers = useSolanaExistingFeeTiers(
    baseCurrency?.wrapped.address,
    quoteCurrency?.wrapped.address,
    isSolanaChain,
  )

  // Build dynamic options depending on chain
  const options = useMemo(() => {
    if (isSolanaChain) {
      return solanaFeeTiers
    }
    return PRESET_FEE_LEVELS_V3
  }, [isSolanaChain, solanaFeeTiers])

  const handleQuickSelect = useCallback(
    (presetFeeLevel: number) => {
      setFeeLevel(presetFeeLevel)
      setInputValue(presetFeeLevel.toString())
    },
    [setFeeLevel],
  )

  const handleMenuItemClick = useCallback(
    (index: number) => {
      if (index < options.length) {
        handleQuickSelect(options[index])
        onSelect?.(index, options[index])
      }
    },
    [handleQuickSelect, options, onSelect],
  )

  const renderItems = useMemo(
    () =>
      options.map((o, idx) => ({
        key: o.toString(),
        label: (
          <FlexGap gap="8px" alignItems="center">
            <Text bold fontSize="16px" color="textSubtle">
              {parseFeeAsReadable(o)}
            </Text>
            {!existingSolanaFeeTiers.has(o) && (
              <Text fontSize="12px" color="textSubtle">
                {t('Not Created')}
              </Text>
            )}
          </FlexGap>
        ),
        value: o,
        onClick: (e) => {
          e.preventDefault()
          handleMenuItemClick(idx)
        },
      })),
    [existingSolanaFeeTiers, t, options, handleMenuItemClick],
  )

  const activeIndex = useMemo(() => {
    const presetIndex = options.findIndex((preset) => preset === feeLevel)
    return presetIndex
  }, [feeLevel, options])

  const prevFeeLevel = usePreviousValue(feeLevel)

  const updateFee = useCallback(() => {
    const firstAvailable = options[0]
    if (firstAvailable !== undefined) {
      setFeeLevel(firstAvailable)
      setInputValue(firstAvailable.toString())
      onSelect?.(0, firstAvailable)
    }
    router.events.off('routeChangeComplete', updateFee)
  }, [router.events, onSelect, options, setFeeLevel])

  useEffect(() => {
    if (inputValue === null && feeLevel !== null) {
      setInputValue(parseFloat(feeLevel.toFixed(decimals)).toString())
    }
  }, [feeLevel, inputValue])

  useEffect(() => {
    if (prevFeeLevel !== null && feeLevel === null) {
      setInputValue(null)
    }
  }, [feeLevel, prevFeeLevel])

  // Auto-select a default Solana fee tier when none selected
  useEffect(() => {
    if (!isSolanaChain || feeLevel || feeAmount || !options.length) return
    if (!router.isReady) {
      router.events.on('routeChangeComplete', updateFee)
      return
    }
    updateFee()

    // eslint-disable-next-line consistent-return
    return () => {
      router.events.off('routeChangeComplete', updateFee)
    }
  }, [router.events, feeAmount, router.isReady, updateFee, isSolanaChain, feeLevel, options.length])

  useEffect(() => {
    if (!isSolanaChain || !feeLevel || !solanaFeeTiers.length) return
    if (solanaFeeTiers.find((f) => f === feeLevel)) return
    if (solanaFeeTiers.find((f) => f === feeLevel * 1e4)) {
      setFeeLevel(feeLevel * 1e4)
    } else {
      updateFee()
    }
  }, [feeLevel, isSolanaChain, setFeeLevel, solanaFeeTiers, updateFee])

  useEffect(() => {
    if (feeAmount && feeAmount !== feeLevel) {
      setFeeLevel(feeAmount)
    }
  }, [feeLevel, setFeeLevel, feeAmount])

  const renderSolanaDropdown = () => {
    return (
      <Card>
        <Flex p="16px" flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text>{t('Pick a fee tier')}</Text>
          <ScrollableDropdown trigger="click" items={renderItems}>
            <MenuItem>
              <Flex
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                width="148px"
                borderRadius="8px"
                border={`1px solid ${theme.colors.cardBorder}`}
                p="8px"
              >
                <Text lineHeight="1.2">{feeLevel ? parseFeeAsReadable(feeLevel) : ''}</Text>
                <ArrowDropDownIcon color="text" />
              </Flex>
            </MenuItem>
          </ScrollableDropdown>
        </Flex>
      </Card>
    )
  }

  return (
    <Box {...boxProps}>
      <FlexGap gap="4px">
        <PreTitle mb="8px">{t('Fee Level')}</PreTitle>
        <QuestionHelper
          placement="auto"
          mb="8px"
          color="secondary"
          text={t('Common range: 0.01% to 0.3%, Ideal range <1%')}
        />
      </FlexGap>

      {chainId === NonEVMChainId.SOLANA ? (
        renderSolanaDropdown()
      ) : (
        <ButtonMenu
          activeIndex={activeIndex}
          onItemClick={handleMenuItemClick}
          variant="subtle"
          fullWidth={!isMobile}
          scale={isMobile ? 'sm' : 'md'}
        >
          {options.map((opt) => (
            <ButtonMenuItem key={opt} padding={isMobile ? '0 8px' : '0 16px'}>
              {opt}%
            </ButtonMenuItem>
          ))}
        </ButtonMenu>
      )}
    </Box>
  )
}
