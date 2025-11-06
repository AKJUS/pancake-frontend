import { useTranslation } from '@pancakeswap/localization'
import { AutoRow, Button, ChevronDownIcon, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { LightGreyCard } from 'components/Card'
import { Dispatch, ReactNode, SetStateAction } from 'react'
import styled from 'styled-components'

const StyledLightGreyCard = styled(LightGreyCard)`
  padding: 16px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-bottom: 2px solid ${({ theme }) => theme.colors.cardBorder};

  max-height: 100px;
  overflow: hidden;
  transition: max-height 0.5s ease-in-out;

  &.expanded {
    max-height: 1000px;
  }
`

interface HideShowSelectorSectionPropsType {
  noHideButton?: boolean
  showOptions: boolean
  setShowOptions: Dispatch<SetStateAction<boolean>>
  heading: ReactNode
  content: ReactNode
}

export default function HideShowSelectorSection({
  noHideButton,
  showOptions,
  setShowOptions,
  heading,
  content,
}: HideShowSelectorSectionPropsType) {
  const { t } = useTranslation()

  const { isXs } = useMatchBreakpoints()

  return (
    <StyledLightGreyCard className={showOptions ? 'expanded' : ''}>
      <AutoRow justifyContent="space-between" alignItems="center" marginBottom={showOptions ? '8px' : '0px'}>
        {heading ?? <div />}
        {noHideButton || (
          <Button
            scale={isXs ? 'xs' : 'sm'}
            onClick={() => setShowOptions((prev) => !prev)}
            variant="text"
            endIcon={
              <ChevronDownIcon
                style={{
                  marginLeft: '0px',
                  transform: showOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease-in-out',
                }}
                color="primary60"
              />
            }
          >
            <Text color="primary60" fontSize={['12px', '16px']} bold>
              {showOptions ? t('Hide') : t('More')}
            </Text>
          </Button>
        )}
      </AutoRow>
      {showOptions ? content : <></>}
    </StyledLightGreyCard>
  )
}
