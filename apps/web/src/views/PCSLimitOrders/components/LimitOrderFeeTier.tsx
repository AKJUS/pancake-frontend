import { useTranslation } from '@pancakeswap/localization'
import {
  Button,
  DottedHelpText,
  Flex,
  FlexGap,
  QuestionHelperV2,
  RowBetween,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { useAtom } from 'jotai'
import styled from 'styled-components'
import { LIMIT_ORDER_FEE_OPTIONS, selectedFeeTierAtom } from '../state/form/feeTierAtom'

const FlexItem = styled(Flex)`
  flex: 1;
  min-width: 0;
`

const FeePillContainer = styled(FlexGap).attrs({ gap: '0px' })`
  background-color: ${({ theme }) => theme.colors.input};
  border: 1px solid ${({ theme }) => theme.colors.inputSecondary};
  border-radius: ${({ theme }) => theme.radii.default};
  box-shadow: ${({ theme }) => theme.shadows.inset2};
  flex: 1;
  justify-content: flex-end;
`

const FeePill = styled(Button).attrs(({ $isSelected }: { $isSelected: boolean }) => ({
  scale: 'xs',
  variant: $isSelected ? 'subtle' : 'light',
}))<{ $isSelected: boolean }>`
  flex: 1;
  height: 44px;
  font-size: 16px;
  padding: 0 12px;
  font-weight: ${({ $isSelected }) => ($isSelected ? 600 : 400)};
  min-width: 60px;
`

const BadgePill = styled(Flex)`
  background-color: ${({ theme }) => theme.colors.primary10};
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 14px;
  gap: 4px;
  align-items: center;
  margin-left: 8px;
`

export const LimitOrderFeeTier = () => {
  const { t } = useTranslation()
  const { isMobile, isTablet } = useMatchBreakpoints()
  const isSmallScreen = isMobile || isTablet
  const [selectedFee, setSelectedFee] = useAtom(selectedFeeTierAtom)

  const options = LIMIT_ORDER_FEE_OPTIONS.map((o) => ({ ...o, badgeText: t(o.badgeText) }))
  const defaultOption = options[0]
  const selectedOption = options.find((o) => o.value === selectedFee) ?? defaultOption

  return (
    <RowBetween>
      <FlexItem alignItems="center" width="50%">
        <QuestionHelperV2
          text={
            <span style={{ whiteSpace: 'pre-line' }}>
              {t(
                'Fee tier = the % you earn when your order fills.\nLower tiers fill faster (at your limit price). Higher tiers earn more, but need the price to move further to execute.',
              )}
            </span>
          }
        >
          <DottedHelpText>{t('Fee Tier')}</DottedHelpText>
        </QuestionHelperV2>
        {!isSmallScreen && (
          <BadgePill>
            <Text fontSize="14px" color="primary60">
              {selectedOption.icon} {selectedOption.badgeText}
            </Text>
          </BadgePill>
        )}
      </FlexItem>

      <FeePillContainer justifyContent="flex-end">
        {options.map((option) => (
          <FeePill
            key={option.value}
            $isSelected={selectedFee === option.value}
            onClick={() => setSelectedFee(option.value)}
          >
            {isSmallScreen ? `${option.icon}${option.label}` : option.label}
          </FeePill>
        ))}
      </FeePillContainer>
    </RowBetween>
  )
}
