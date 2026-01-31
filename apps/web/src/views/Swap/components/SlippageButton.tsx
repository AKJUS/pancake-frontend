import { isSolana } from '@pancakeswap/chains'
import { useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import {
  Button,
  Flex,
  ModalV2,
  MotionModal,
  PencilIcon,
  RiskAlertIcon,
  useMatchBreakpoints,
  useModalV2,
  useTooltip,
  WarningIcon,
  QuestionHelper,
} from '@pancakeswap/uikit'
import { useSolanaUserSlippage, useUserSlippage } from '@pancakeswap/utils/user'
import {
  SolanaSlippageSetting,
  EVMSlippageSetting,
  EVMLiquiditySlippageSetting,
} from 'components/Settings/SlippageTabs'
import useAccountActiveChain from 'hooks/useAccountActiveChain'

import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import styled from 'styled-components'
import { basisPointsToPercent } from 'utils/exchange'

export const TertiaryButton = styled(Button).attrs({ variant: 'tertiary' })<{ $color: string }>`
  height: unset;
  padding: 7px 8px;
  font-size: 14px;
  border-radius: 12px;
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
  color: ${({ $color }) => $color};
`

interface SlippageButtonProps {
  enableAutoSlippage?: boolean
}

const ToleranceView = ({ tolerance }) => {
  return typeof tolerance === 'number' ? `${basisPointsToPercent(tolerance).toFixed(2)}%` : tolerance
}

const SlippageButtonView = ({
  tolerance,
  buttonText,
  slippageModalContent,
}: {
  tolerance: number
  buttonText?: string
  slippageModalContent: React.ReactNode
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { isOpen, onOpen, onDismiss } = useModalV2()

  const isRiskyLow = tolerance < 50
  const isRiskyHigh = tolerance > 100
  const isRiskyVeryHigh = tolerance > 2000

  const color = isRiskyVeryHigh
    ? theme.colors.failure
    : isRiskyLow || isRiskyHigh
    ? theme.colors.yellow
    : theme.colors.primary60

  const { isMobile } = useMatchBreakpoints()
  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    isRiskyLow
      ? t('Your transaction may fail. Reset settings to avoid potential loss')
      : isRiskyHigh
      ? t('Your transaction may be frontrun. Reset settings to avoid potential loss')
      : '',
    { placement: 'top', avoidToStopPropagation: isMobile },
  )
  return (
    <>
      <div style={{ textAlign: 'center' }}>
        <div ref={targetRef}>
          <TertiaryButton
            $color={color}
            startIcon={
              isRiskyVeryHigh ? (
                <RiskAlertIcon color={color} width={16} />
              ) : isRiskyLow || isRiskyHigh ? (
                <WarningIcon color={color} width={16} />
              ) : undefined
            }
            endIcon={<PencilIcon color={color} width={12} />}
            onClick={onOpen}
          >
            {buttonText}
            <ToleranceView tolerance={tolerance} />
          </TertiaryButton>
        </div>

        {!isMobile && (isRiskyLow || isRiskyHigh) && tooltipVisible && tooltip}
      </div>
      <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
        <MotionModal
          title={
            <Flex justifyContent="center">
              {t('Slippage Setting')}
              <QuestionHelper
                text={t(
                  'Setting a high slippage tolerance can help transactions succeed, but you may not get such a good price. Use with caution.',
                )}
                ml="4px"
                placement="top-start"
              />
            </Flex>
          }
          onDismiss={onDismiss}
          minHeight="100px"
        >
          {slippageModalContent}
        </MotionModal>
      </ModalV2>
    </>
  )
}

export const SolanaSlippageButton = () => {
  const [solanaSlippageTolerance] = useSolanaUserSlippage()

  return <SlippageButtonView tolerance={solanaSlippageTolerance} slippageModalContent={<SolanaSlippageSetting />} />
}

export const EVMSlippageButton = ({ enableAutoSlippage_ = false }: { enableAutoSlippage_?: boolean }) => {
  const { t } = useTranslation()
  const { slippageTolerance: autoSlippageTolerance, isAuto } = useAutoSlippageWithFallback()
  const [userSlippageTolerance] = useUserSlippage()

  return (
    <SlippageButtonView
      tolerance={enableAutoSlippage_ ? autoSlippageTolerance : userSlippageTolerance}
      slippageModalContent={<EVMSlippageSetting />}
      buttonText={isAuto ? `${t('Auto')}: ` : ''}
    />
  )
}

export const SlippageButton = ({ enableAutoSlippage: enableAutoSlippage_ = false }: SlippageButtonProps) => {
  const { chainId } = useAccountActiveChain()

  // TODO: add "Advanced Settings" text button to open GlobalSettings
  return isSolana(chainId) ? <SolanaSlippageButton /> : <EVMSlippageButton enableAutoSlippage_={enableAutoSlippage_} />
}

export const LiquiditySlippageButton = () => {
  const [userSlippageTolerance] = useUserSlippage()

  return <SlippageButtonView tolerance={userSlippageTolerance} slippageModalContent={<EVMLiquiditySlippageSetting />} />
}

export const SolanaLiquiditySlippageButton = () => {
  const [solanaSlippageTolerance] = useSolanaUserSlippage()

  return <SlippageButtonView tolerance={solanaSlippageTolerance} slippageModalContent={<SolanaSlippageSetting />} />
}
