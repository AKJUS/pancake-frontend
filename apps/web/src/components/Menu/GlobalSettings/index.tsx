import { useCallback, useEffect, useRef, useState } from 'react'

import { styled } from 'styled-components'

import {
  Box,
  ButtonProps,
  CogIcon,
  Flex,
  IconButton,
  ModalV2,
  useMatchBreakpoints,
  useModalV2,
} from '@pancakeswap/uikit'

import GlobalSettingsContent from './GlobalSettings'
import GlobalSettingsModal from './SettingsModal'

type Props = {
  color?: string
  mr?: string
  overrideButton?: (onClick: () => void) => React.ReactNode
} & ButtonProps

const SettingsHoverPanel = styled(Box)`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1002;
  width: min(400px, calc(100vw - 32px));
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  background: ${({ theme }) => theme.card.background};
  box-shadow: ${({ theme }) => theme.shadows.level1};
`

const GlobalSettings = ({ color, mr = '8px', overrideButton, ...rest }: Props) => {
  const { isMobile } = useMatchBreakpoints()
  const { isOpen, setIsOpen, onDismiss } = useModalV2()
  const [hoverOpen, setHoverOpen] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLeave = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  const handleEnter = useCallback(() => {
    if (isMobile) return
    clearLeave()
    setHoverOpen(true)
  }, [isMobile, clearLeave])

  const handleLeave = useCallback(() => {
    if (isMobile) return
    clearLeave()
    leaveTimer.current = setTimeout(() => setHoverOpen(false), 120)
  }, [isMobile, clearLeave])

  useEffect(() => clearLeave, [clearLeave])

  const openModal = () => setIsOpen(true)

  return (
    <Flex position="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {overrideButton?.(openModal) || (
        <IconButton
          onClick={isMobile ? openModal : undefined}
          variant="text"
          scale="sm"
          mr={mr}
          id="open-settings-dialog-button"
          {...rest}
        >
          <CogIcon height={24} width={24} color={color || 'textSubtle'} />
        </IconButton>
      )}

      {!isMobile && hoverOpen && (
        <SettingsHoverPanel onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <GlobalSettingsContent layoutVariant="navbarPanel" />
        </SettingsHoverPanel>
      )}

      {isMobile && (
        <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
          <GlobalSettingsModal onDismiss={onDismiss} />
        </ModalV2>
      )}
    </Flex>
  )
}

export default GlobalSettings
