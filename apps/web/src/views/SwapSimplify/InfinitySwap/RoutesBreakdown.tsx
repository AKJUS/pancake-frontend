import { useDebounce, useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Route } from '@pancakeswap/smart-router'
import { Box, ModalV2, PoolTypeIcon, QuestionHelperV2, SkeletonV2, Text, useModalV2 } from '@pancakeswap/uikit'
import { memo } from 'react'
import { styled } from 'styled-components'

import { RowBetween, RowFixed } from 'components/Layout/Row'
import SwapRoute from 'views/Swap/components/SwapRoute'
import { RoutingSettingsModalContent } from 'components/Menu/GlobalSettings/SettingsModalV2'
import { TertiaryButton } from 'views/Swap/components/SlippageButton'
import { isSolana } from '@pancakeswap/chains'
import {
  RouteDisplayEssentials,
  RouteDisplayModal,
  RoutesDisplayButtonView,
} from '../../Swap/V3Swap/components/RouteDisplayModal'
import { useWallchainStatus } from '../../Swap/V3Swap/hooks/useWallchain'

interface Props {
  routes?: RouteDisplayEssentials[]
  wrapperStyle?: React.CSSProperties
  loading?: boolean
}

const RouteInfoContainer = styled(RowBetween)`
  padding: 4px 24px 0;
`

export const RoutesBreakdown = memo(function RoutesBreakdown({ routes = [], wrapperStyle, loading }: Props) {
  const [wallchainStatus] = useWallchainStatus()
  const { t } = useTranslation()
  const { theme } = useTheme()
  const routeDisplayModal = useModalV2()
  const routingSettingsModal = useModalV2()
  const deferWallchainStatus = useDebounce(wallchainStatus, 500)

  if (!routes.length) {
    return null
  }

  const count = routes.length

  return (
    <>
      <RouteInfoContainer style={wrapperStyle}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <QuestionHelperV2
            text={
              deferWallchainStatus === 'found'
                ? t(
                    'A Bonus route provided by API is automatically selected for your trade to achieve the best price for your trade.',
                  )
                : t(
                    'Route is automatically calculated based on your routing preference to achieve the best price for your trade.',
                  )
            }
            placement="top-start"
          >
            <Text fontSize="14px" color="textSubtle" style={{ textDecoration: 'underline dotted' }}>
              {deferWallchainStatus === 'found' ? t('Bonus Route') : t('Route')}
            </Text>
          </QuestionHelperV2>
        </span>
        <RowFixed gap="4px">
          <SkeletonV2 width="120px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={!loading}>
            <RoutesDisplayButtonView onClick={routeDisplayModal.onOpen}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {count > 1 ? (
                  <Text fontSize="14px">{t('%count% Separate Routes', { count })}</Text>
                ) : (
                  <RouteComp route={routes[0]} />
                )}
              </span>
            </RoutesDisplayButtonView>
          </SkeletonV2>
          {!isSolana(routes[0]?.inputAmount?.currency?.chainId) &&
          !isSolana(routes[0]?.outputAmount?.currency?.chainId) ? (
            <TertiaryButton
              role="button"
              $color={theme.colors.primary60}
              onClick={routingSettingsModal.onOpen}
              style={{ padding: '7px 8px', height: 'unset' }}
            >
              <PoolTypeIcon color={theme.colors.primary60} width={20} />
            </TertiaryButton>
          ) : null}
        </RowFixed>
        <RouteDisplayModal {...routeDisplayModal} routes={routes} />
        <ModalV2 isOpen={routingSettingsModal.isOpen} onDismiss={routingSettingsModal.onDismiss} closeOnOverlayClick>
          <RoutingSettingsModalContent />
        </ModalV2>
      </RouteInfoContainer>
    </>
  )
})

export const XRoutesBreakdown = memo(function XRoutesBreakdown({ wrapperStyle, loading }: Props) {
  const { t } = useTranslation()
  const { isOpen, setIsOpen, onDismiss } = useModalV2()

  const { theme } = useTheme()

  return (
    <>
      <RouteInfoContainer style={wrapperStyle}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <QuestionHelperV2
            text={t(
              'Route is automatically calculated based on your routing preference to achieve the best price for your trade.',
            )}
            placement="top-start"
          >
            <Text fontSize="14px" color="textSubtle" style={{ textDecoration: 'underline dotted' }}>
              {t('Route')}
            </Text>
          </QuestionHelperV2>
        </span>
        <Box>
          <SkeletonV2 width="120px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={!loading}>
            <RoutesDisplayButtonView
              onClick={() => setIsOpen(true)}
              endIcon={<PoolTypeIcon color={theme.colors.primary60} width={20} ml="2px" />}
            >
              <Text fontSize="14px">PancakeSwap X</Text>
            </RoutesDisplayButtonView>
            <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
              <RoutingSettingsModalContent />
            </ModalV2>
          </SkeletonV2>
        </Box>
      </RouteInfoContainer>
    </>
  )
})

interface RouteProps {
  route: Pick<Route, 'path' | 'type'>
}

function RouteComp({ route }: RouteProps) {
  const { path, type } = route

  return (
    <RowBetween>
      <SwapRoute path={path} type={type} />
    </RowBetween>
  )
}
