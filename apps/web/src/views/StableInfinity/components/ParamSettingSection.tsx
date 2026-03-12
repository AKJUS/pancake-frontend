import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import {
  ArrowDropDownIcon,
  AutoColumn,
  Box,
  Button,
  Checkbox,
  DropDownContainer,
  DropDownHeader,
  Flex,
  InfoIcon,
  Input,
  Message,
  MessageText,
  Modal,
  ModalV2,
  PreTitle,
  Text,
  Toggle,
  useMatchBreakpoints,
  useTooltip,
} from '@pancakeswap/uikit'
import { LightGreyCard } from 'components/Card'
import { useCurrencies } from 'views/CreateLiquidityPool/hooks/useCurrencies'
import { useAccountActiveChain } from 'hooks/useAccountActiveChain'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { ApprovalState, useApproveCallbackFromAmount } from 'hooks/useApproveCallback'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { Percent } from '@pancakeswap/swap-sdk-core'
import { type ERC20Token } from '@pancakeswap/sdk'
import { useCurrencyBalances } from 'state/wallet/hooks'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { useRouter } from 'next/router'

import { isEvm } from '@pancakeswap/chains'
import {
  type PoolPreset,
  TokenType,
  ADDRESS_ZERO,
  NULL_METHOD_ID,
  InfinityStablePoolFactory,
} from '@pancakeswap/infinity-stable-sdk'
import { useTokenConfig } from '../contexts/TokenConfigContext'

type PresetType = PoolPreset

const UI_PRESET_DEFAULTS: Record<
  PresetType,
  {
    swapFee: string
    amplificationParam: string
    offpegFeeMultiplier: string
    movingAverageTime: string
    offpegMax: number
  }
> = {
  fiat: {
    swapFee: '0.01',
    amplificationParam: '1000',
    offpegFeeMultiplier: '10',
    movingAverageTime: '600',
    offpegMax: 50,
  },
  crypto: {
    swapFee: '0.04',
    amplificationParam: '100',
    offpegFeeMultiplier: '12.5',
    movingAverageTime: '600',
    offpegMax: 12.5,
  },
  lrt: {
    swapFee: '0.01',
    amplificationParam: '500',
    offpegFeeMultiplier: '10',
    movingAverageTime: '600',
    offpegMax: 50,
  },
}

interface PresetModalProps {
  isOpen: boolean
  onDismiss: () => void
  selectedPreset?: PresetType
  onSelectPreset: (preset: PresetType) => void
}

const PresetModal: React.FC<PresetModalProps> = ({ isOpen, onDismiss, selectedPreset, onSelectPreset }) => {
  const { t } = useTranslation()

  const { isTablet } = useMatchBreakpoints()

  const presets = useMemo(
    () => [
      {
        id: 'fiat' as PresetType,
        title: t('Fiat redeemable stablecoins'),
        description: t('Suitable for stablecoins that are fiat redeemable'),
      },
      {
        id: 'crypto' as PresetType,
        title: t('Crypto collateralized stablecoins'),
        description: t('Suitable for stablecoins that are crypto-backed'),
      },
      {
        id: 'lrt' as PresetType,
        title: t('Liquid restaking tokens'),
        description: t('Suitable for LRTS'),
      },
    ],
    [t],
  )

  const handleSelectPreset = useCallback(
    (preset: PresetType) => {
      onSelectPreset(preset)
      onDismiss()
    },
    [onSelectPreset, onDismiss],
  )

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <Modal title="Select Preset" onDismiss={onDismiss} maxWidth={isTablet ? '100%' : '480px'}>
        <AutoColumn gap="16px">
          {presets.map((preset) => (
            <LightGreyCard key={preset.id} style={{ cursor: 'pointer' }} onClick={() => handleSelectPreset(preset.id)}>
              <Flex alignItems="center">
                <Box style={{ flex: 1 }}>
                  <PreTitle fontSize="16px" textTransform="capitalize">
                    {preset.title}
                  </PreTitle>
                  <Text fontSize="14px">{preset.description}</Text>
                </Box>
                {selectedPreset === preset.id ? (
                  <Checkbox checked scale="sm" style={{ flex: 'none' }} readOnly />
                ) : (
                  <Checkbox checked={false} scale="sm" style={{ flex: 'none' }} readOnly />
                )}
              </Flex>
            </LightGreyCard>
          ))}
        </AutoColumn>
      </Modal>
    </ModalV2>
  )
}

interface ParamSettingSectionProps {
  onPreviewPool: (params: {
    selectedPreset?: string
    swapFee: string
    isAdvancedEnabled: boolean
    amplificationParam: string
    offpegFeeMultiplier: string
    movingAverageTime: string
    depositAmountA: string
    depositAmountB: string
  }) => void
  attemptingTxn: boolean
}

export const ParamSettingSection: React.FC<ParamSettingSectionProps> = ({ onPreviewPool, attemptingTxn }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<PresetType>()
  const [isAdvancedEnabled, setIsAdvancedEnabled] = useState(false)
  const [swapFee, setSwapFee] = useState(UI_PRESET_DEFAULTS.fiat.swapFee)
  const [amplificationParam, setAmplificationParam] = useState(UI_PRESET_DEFAULTS.fiat.amplificationParam)
  const [offpegFeeMultiplier, setOffpegFeeMultiplier] = useState(UI_PRESET_DEFAULTS.fiat.offpegFeeMultiplier)
  const [movingAverageTime, setMovingAverageTime] = useState(UI_PRESET_DEFAULTS.fiat.movingAverageTime)
  const [depositAmountA, setDepositAmountA] = useState('')
  const [depositAmountB, setDepositAmountB] = useState('')
  const { baseCurrency, quoteCurrency } = useCurrencies()
  const { tokenAConfig, tokenBConfig } = useTokenConfig()

  const { account, chainId } = useAccountActiveChain()

  // Get dynamic offpeg max based on selected preset
  const offpegMax = selectedPreset ? UI_PRESET_DEFAULTS[selectedPreset].offpegMax : UI_PRESET_DEFAULTS.fiat.offpegMax

  const getPresetLabel = (preset: PresetType | undefined) => {
    switch (preset) {
      case 'fiat':
        return t('Fiat redeemable stablecoins')
      case 'crypto':
        return t('Crypto collateralized stablecoins')
      case 'lrt':
        return t('Liquid restaking tokens')
      default:
        return t('Select preset')
    }
  }

  // Validate preset is required
  const validatePreset = () => {
    if (!selectedPreset) {
      return t('Please select a pool parameters preset')
    }
    return null
  }

  // Validate oracle configurations
  const validateOracleConfig = (config: typeof tokenAConfig, tokenName: string) => {
    if (config.type === TokenType.ORACLE) {
      if (config.oracleAddress === ADDRESS_ZERO || !config.oracleAddress) {
        return t('Please provide oracle address for Token %token%', { token: tokenName })
      }
      if (config.methodId === NULL_METHOD_ID || !config.methodId) {
        return t('Please provide valid function name for Token %token%', { token: tokenName })
      }
    }
    return null
  }

  // Validate advanced parameters
  const validateAdvancedParams = useCallback(() => {
    if (!isAdvancedEnabled) return null

    if (amplificationParam) {
      const a = parseInt(amplificationParam.replace(/,/g, ''), 10)
      if (Number.isNaN(a) || a < 1 || a > 20000) {
        return t('A parameter must be between 1 and 20000')
      }
    }

    if (offpegFeeMultiplier) {
      const multiplier = parseFloat(offpegFeeMultiplier)
      if (Number.isNaN(multiplier) || multiplier < 0 || multiplier > offpegMax) {
        return t('Offpeg fee multiplier must be between 0 and %max%', { max: offpegMax })
      }
    }

    if (movingAverageTime) {
      const time = parseInt(movingAverageTime, 10)
      if (Number.isNaN(time) || time < 60 || time > 3600) {
        return t('Moving average time must be between 60 and 3600 seconds')
      }
    }

    return null
  }, [isAdvancedEnabled, amplificationParam, offpegFeeMultiplier, movingAverageTime, offpegMax, t])

  // Parse deposit amounts
  const parsedAmountA = useMemo(() => tryParseAmount(depositAmountA, baseCurrency), [depositAmountA, baseCurrency])
  const parsedAmountB = useMemo(() => tryParseAmount(depositAmountB, quoteCurrency), [depositAmountB, quoteCurrency])

  // Get user balances
  const [balanceA, balanceB] = useCurrencyBalances(account, [baseCurrency, quoteCurrency])

  // Calculate max amounts
  const maxAmountA = useMemo(() => maxAmountSpend(balanceA), [balanceA])
  const maxAmountB = useMemo(() => maxAmountSpend(balanceB), [balanceB])

  // Get factory address for approvals
  const factoryAddress = useMemo(() => {
    if (!chainId || !isEvm(chainId)) return undefined
    try {
      return InfinityStablePoolFactory.getFactoryAddress(chainId)
    } catch {
      router.push('/liquidity/select/')
      return undefined
    }
  }, [chainId, router])

  // Approval hooks for both tokens
  const { approvalState: approvalA, approveCallback: approveACallback } = useApproveCallbackFromAmount({
    token: (baseCurrency?.isToken && isEvm(baseCurrency.chainId) ? baseCurrency : undefined) as ERC20Token | undefined,
    minAmount: parsedAmountA?.quotient,
    spender: factoryAddress,
  })

  const { approvalState: approvalB, approveCallback: approveBCallback } = useApproveCallbackFromAmount({
    token: (quoteCurrency?.isToken && isEvm(quoteCurrency.chainId) ? quoteCurrency : undefined) as
      | ERC20Token
      | undefined,
    minAmount: parsedAmountB?.quotient,
    spender: factoryAddress,
  })

  // Determine if approvals are needed
  const showFieldAApproval = [ApprovalState.NOT_APPROVED, ApprovalState.PENDING].includes(approvalA) && !!parsedAmountA
  const showFieldBApproval = [ApprovalState.NOT_APPROVED, ApprovalState.PENDING].includes(approvalB) && !!parsedAmountB
  const shouldShowApprovalGroup = showFieldAApproval || showFieldBApproval

  // Validate deposit amounts
  const validateDepositAmounts = () => {
    if (!depositAmountA || !depositAmountB) {
      return t('Please enter both deposit amounts')
    }
    if (!parsedAmountA || !parsedAmountB) {
      return t('Invalid deposit amounts')
    }
    if (parsedAmountA.quotient === 0n || parsedAmountB.quotient === 0n) {
      return t('Deposit amounts must be greater than 0')
    }
    return null
  }

  // Validate sufficient balance
  const validateSufficientBalance = () => {
    if (parsedAmountA && balanceA && parsedAmountA.greaterThan(balanceA)) {
      return t('Insufficient %symbol% balance', { symbol: baseCurrency?.symbol ?? '' })
    }
    if (parsedAmountB && balanceB && parsedAmountB.greaterThan(balanceB)) {
      return t('Insufficient %symbol% balance', { symbol: quoteCurrency?.symbol ?? '' })
    }
    return null
  }

  const presetValidationError = validatePreset()
  const oracleValidationError = validateOracleConfig(tokenAConfig, 'A') || validateOracleConfig(tokenBConfig, 'B')
  const advancedValidationError = validateAdvancedParams()
  const depositAmountsValidationError = validateDepositAmounts()
  const insufficientBalanceError = validateSufficientBalance()

  // Handle number-only input with optional decimal place limit
  const handleNumberInput = useCallback((value: string, allowDecimal = false, maxDecimals?: number) => {
    // Allow empty string
    if (value === '') return ''

    // Only allow numbers and optionally decimal point
    const regex = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/
    if (!regex.test(value)) {
      return null // Invalid input, don't update
    }

    // Check decimal places if maxDecimals is specified
    if (allowDecimal && maxDecimals !== undefined && value.includes('.')) {
      const decimalPlaces = value.split('.')[1]?.length || 0
      if (decimalPlaces > maxDecimals) {
        return null // Too many decimal places, don't update
      }
    }

    return value
  }, [])

  // Auto-correct value to min/max range on blur
  const handleRangeCorrection = useCallback((value: string, min: number, max: number, maxDecimals?: number): string => {
    if (value === '') {
      // Format min value to avoid scientific notation if maxDecimals is specified
      if (maxDecimals !== undefined) {
        return min.toFixed(maxDecimals).replace(/\.?0+$/, '')
      }
      return String(min)
    }

    const numValue = parseFloat(value)
    if (Number.isNaN(numValue)) {
      // Format min value to avoid scientific notation if maxDecimals is specified
      if (maxDecimals !== undefined) {
        return min.toFixed(maxDecimals).replace(/\.?0+$/, '')
      }
      return String(min)
    }

    let corrected = numValue
    if (corrected < min) corrected = min
    if (corrected > max) corrected = max

    // Round to maxDecimals if specified and format to avoid scientific notation
    if (maxDecimals !== undefined) {
      const factor = 10 ** maxDecimals
      corrected = Math.round(corrected * factor) / factor
      // Use toFixed to avoid scientific notation, then remove trailing zeros
      return corrected.toFixed(maxDecimals).replace(/\.?0+$/, '')
    }

    return String(corrected)
  }, [])

  // Handlers for A parameter
  const handleAmplificationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = handleNumberInput(e.target.value)
      if (newValue !== null) {
        setAmplificationParam(newValue)
      }
    },
    [handleNumberInput],
  )

  const handleAmplificationBlur = useCallback(() => {
    const corrected = handleRangeCorrection(amplificationParam, 1, 20000)
    setAmplificationParam(corrected)
  }, [amplificationParam, handleRangeCorrection])

  // Handlers for offpeg fee multiplier
  const handleOffpegChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = handleNumberInput(e.target.value, true) // Allow decimal
      if (newValue !== null) {
        setOffpegFeeMultiplier(newValue)
      }
    },
    [handleNumberInput],
  )

  const handleOffpegBlur = useCallback(() => {
    const corrected = handleRangeCorrection(offpegFeeMultiplier, 0, offpegMax)
    setOffpegFeeMultiplier(corrected)
  }, [handleRangeCorrection, offpegFeeMultiplier, offpegMax])

  // Handlers for moving average time
  const handleMovingAverageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = handleNumberInput(e.target.value)
      if (newValue !== null) {
        setMovingAverageTime(newValue)
      }
    },
    [handleNumberInput],
  )

  const handleMovingAverageBlur = useCallback(() => {
    const corrected = handleRangeCorrection(movingAverageTime, 60, 3600)
    setMovingAverageTime(corrected)
  }, [movingAverageTime, handleRangeCorrection])

  // Handlers for swap fee (0% to 1%, max 8 decimal places)
  const handleSwapFeeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = handleNumberInput(e.target.value, true, 8) // Allow decimal, max 8 decimals

      if (newValue !== null) {
        setSwapFee(newValue)
      }
    },
    [handleNumberInput],
  )

  const handleSwapFeeBlur = useCallback(() => {
    const corrected = handleRangeCorrection(swapFee, 0, 1, 8) // Max 8 decimal places
    setSwapFee(corrected)
  }, [swapFee, handleRangeCorrection])

  // Handler to sync both deposit amounts (enforces 1:1 ratio)
  const handleDepositAmountChange = useCallback((value: string) => {
    setDepositAmountA(value)
    setDepositAmountB(value)
  }, [])

  // Handler for preset selection
  const handleSelectPreset = useCallback((preset: PresetType) => {
    setSelectedPreset(preset)
    const defaults = UI_PRESET_DEFAULTS[preset]
    if (defaults) {
      setSwapFee(defaults.swapFee)
      setAmplificationParam(defaults.amplificationParam)
      setOffpegFeeMultiplier(defaults.offpegFeeMultiplier)
      setMovingAverageTime(defaults.movingAverageTime)
    }
  }, [])

  const {
    targetRef: maTimeTargetRef,
    tooltip: maTimeTooltip,
    tooltipVisible: maTimeTooltipVisible,
  } = useTooltip(
    t(
      "Contract interprets time at a different scale: so, 600 seconds is 600 / log(2), which is 866 when the contract's ma_exp_time method is queried.",
    ),
    { placement: 'bottom' },
  )

  // Handler to reset fees to preset defaults
  const handleResetFees = useCallback(() => {
    if (selectedPreset) {
      setSwapFee(UI_PRESET_DEFAULTS[selectedPreset].swapFee)
    }
  }, [selectedPreset])

  return (
    <Box>
      {/* Pool Parameters Presets */}
      <Box mb="24px">
        <PreTitle textTransform="uppercase" mb="8px">
          {t('Pool Parameters Presets')}
        </PreTitle>
        <DropDownContainer p={0} onClick={() => setIsPresetModalOpen(true)}>
          <DropDownHeader justifyContent="space-between">
            <Text id="preset" color={selectedPreset ? 'text' : 'textSubtle'}>
              {getPresetLabel(selectedPreset)}
            </Text>
            <ArrowDropDownIcon color="text" className="down-icon" />
          </DropDownHeader>
        </DropDownContainer>
      </Box>
      {/* Fees */}
      <Box mb="24px">
        <Flex justifyContent="space-between" alignItems="center" mb="8px">
          <Text bold fontSize="16px">
            {t('Fees')}
          </Text>
          {selectedPreset && (
            <Button variant="text" scale="sm" onClick={handleResetFees} style={{ height: 'auto', padding: 0 }}>
              <Text fontSize="12px" color="primary" textTransform="uppercase">
                {t('Reset Fees')}
              </Text>
            </Button>
          )}
        </Flex>
        <PreTitle textTransform="uppercase" mb="8px">
          {t('Swap Fee (0% - 1%)')}
        </PreTitle>
        <Input type="text" value={swapFee} onChange={handleSwapFeeChange} onBlur={handleSwapFeeBlur} />
      </Box>
      {/* Advanced Settings */}
      <LightGreyCard mb="24px">
        <Flex justifyContent="space-between" alignItems="center" mb={isAdvancedEnabled ? '16px' : '0px'}>
          <Text bold fontSize="16px">
            {t('Advanced')}
          </Text>
          <Toggle checked={isAdvancedEnabled} onChange={() => setIsAdvancedEnabled(!isAdvancedEnabled)} scale="sm" />
        </Flex>

        {isAdvancedEnabled && (
          <AutoColumn gap="16px">
            {/* Amplification Parameter (A) */}
            <Box>
              <PreTitle textTransform="uppercase" mb="8px">
                {t('A (1-20000)')}
              </PreTitle>
              <Input
                type="text"
                value={amplificationParam}
                onChange={handleAmplificationChange}
                onBlur={handleAmplificationBlur}
              />
            </Box>

            {/* Offpeg Fee Multiplier */}
            <Box>
              <PreTitle textTransform="uppercase" mb="8px">
                {t('Offpeg fee multiplier (0-%max%)', { max: offpegMax })}
              </PreTitle>
              <Input type="text" value={offpegFeeMultiplier} onChange={handleOffpegChange} onBlur={handleOffpegBlur} />
            </Box>

            {/* Moving Average Time */}
            <Box>
              <Flex alignItems="center" mb="8px">
                <PreTitle textTransform="uppercase" mr="4px">
                  {t('moving average time (60-3600) seconds')}
                </PreTitle>
                <Box ref={maTimeTargetRef} style={{ cursor: 'pointer' }}>
                  <InfoIcon width="16px" color="textSubtle" />
                  {maTimeTooltipVisible && maTimeTooltip}
                </Box>
              </Flex>
              <Input
                type="text"
                value={movingAverageTime}
                onChange={handleMovingAverageChange}
                onBlur={handleMovingAverageBlur}
              />
            </Box>
          </AutoColumn>
        )}
      </LightGreyCard>
      {/* Deposit Amount Section */}
      <Box mb="24px">
        <CurrencyInputPanelSimplify
          title={<PreTitle>{t('Deposit Amount')}</PreTitle>}
          showUSDPrice
          maxAmount={maxAmountA}
          onMax={() => {
            const amount = maxAmountA?.toExact() ?? ''
            setDepositAmountA(amount)
            setDepositAmountB(amount)
          }}
          onPercentInput={(percent) => {
            if (maxAmountA) {
              const amount = maxAmountA?.multiply(new Percent(percent, 100)).toExact() ?? ''
              setDepositAmountA(amount)
              setDepositAmountB(amount)
            }
          }}
          disableCurrencySelect
          defaultValue={depositAmountA}
          onUserInput={handleDepositAmountChange}
          showQuickInputButton
          showMaxButton
          currency={baseCurrency}
          id="stable-create-pool-input-tokena"
        />
        <Box my="8px" />
        <CurrencyInputPanelSimplify
          title={<>&nbsp;</>}
          showUSDPrice
          disableCurrencySelect
          maxAmount={maxAmountB}
          onPercentInput={(percent) => {
            if (maxAmountB) {
              const amount = maxAmountB?.multiply(new Percent(percent, 100)).toExact() ?? ''
              setDepositAmountA(amount)
              setDepositAmountB(amount)
            }
          }}
          onMax={() => {
            const amount = maxAmountB?.toExact() ?? ''
            setDepositAmountA(amount)
            setDepositAmountB(amount)
          }}
          defaultValue={depositAmountB}
          onUserInput={handleDepositAmountChange}
          showQuickInputButton
          showMaxButton
          currency={quoteCurrency}
          id="stable-create-pool-input-tokenb"
        />
        {depositAmountA && baseCurrency && quoteCurrency && (
          <Message variant="warning" mt="8px">
            <MessageText>
              {t('To create this pool, add %amountA% %symbolA% and %amountA% %symbolB%. Amounts must be the same.', {
                amountA: depositAmountA,
                symbolA: baseCurrency.symbol ?? '',
                symbolB: quoteCurrency.symbol ?? '',
              })}
            </MessageText>
          </Message>
        )}
      </Box>
      {/* Approval Buttons */}
      {shouldShowApprovalGroup && (
        <Box mb="16px">
          {showFieldAApproval && (
            <Button
              width="100%"
              onClick={approveACallback}
              disabled={approvalA === ApprovalState.PENDING}
              mb={showFieldBApproval ? '8px' : '0px'}
            >
              {approvalA === ApprovalState.PENDING
                ? t('Enabling %symbol%', { symbol: baseCurrency?.symbol })
                : t('Enable %symbol%', { symbol: baseCurrency?.symbol })}
            </Button>
          )}
          {showFieldBApproval && (
            <Button width="100%" onClick={approveBCallback} disabled={approvalB === ApprovalState.PENDING}>
              {approvalB === ApprovalState.PENDING
                ? t('Enabling %symbol%', { symbol: quoteCurrency?.symbol })
                : t('Enable %symbol%', { symbol: quoteCurrency?.symbol })}
            </Button>
          )}
        </Box>
      )}
      {account ? (
        <Button
          width="100%"
          onClick={() =>
            onPreviewPool({
              selectedPreset,
              swapFee,
              isAdvancedEnabled,
              amplificationParam,
              offpegFeeMultiplier,
              movingAverageTime,
              depositAmountA,
              depositAmountB,
            })
          }
          disabled={
            !baseCurrency ||
            !quoteCurrency ||
            attemptingTxn ||
            !!presetValidationError ||
            !!oracleValidationError ||
            !!advancedValidationError ||
            !!depositAmountsValidationError ||
            !!insufficientBalanceError ||
            approvalA === ApprovalState.PENDING ||
            approvalB === ApprovalState.PENDING ||
            showFieldAApproval ||
            showFieldBApproval
          }
          isLoading={attemptingTxn}
        >
          {attemptingTxn
            ? t('Creating Pool...')
            : presetValidationError ||
              oracleValidationError ||
              advancedValidationError ||
              depositAmountsValidationError ||
              insufficientBalanceError ||
              t('Preview Pool')}
        </Button>
      ) : (
        <ConnectWalletButton width="100%" />
      )}
      <PresetModal
        isOpen={isPresetModalOpen}
        onDismiss={() => setIsPresetModalOpen(false)}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
      />
    </Box>
  )
}
