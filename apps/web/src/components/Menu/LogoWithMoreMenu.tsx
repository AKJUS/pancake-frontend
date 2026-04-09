import { useCallback, useMemo, useRef, useState } from 'react'

import { styled } from 'styled-components'

import { useTranslation } from '@pancakeswap/localization'
import {
  AtomBox,
  Box,
  Button,
  CakePrice,
  ChevronDownIcon,
  DropdownMenuItems,
  DropdownMenuItemType,
  Flex,
  LogoIcon,
  LogoWithHover,
  LogoWithTextIcon,
  OpenNewIcon,
  Text,
} from '@pancakeswap/uikit'
import { useMenuContext } from '@pancakeswap/uikit/widgets/Menu/context'

const MORE_LINK_ORDER = ['/info/v3', '/voting', '/burn-dashboard']

type Props = {
  homeHref: string
  moreItems?: DropdownMenuItems[]
  buyCakeLabel: string
  buyCakeLink: string
  chainId: number
  cakePriceUsd?: number
  showCakePrice?: boolean
}

const LogoPill = styled(Flex)`
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 8px;
  border-radius: 20px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.tertiary};
  }
`

const MenuPanel = styled(Box)`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1002;
  min-width: 320px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  background: ${({ theme }) => theme.card.background};
  box-shadow: ${({ theme }) => theme.shadows.level1};
`

const FooterRow = styled(Flex)`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.colors.cardBorder};
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const LinksColumn = styled(Box)`
  width: 88px;
`

function sortMoreLinks(items: DropdownMenuItems[]): DropdownMenuItems[] {
  return [...items].sort((a, b) => {
    const ia = MORE_LINK_ORDER.indexOf(a.href ?? '')
    const ib = MORE_LINK_ORDER.indexOf(b.href ?? '')
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

const LogoWithMoreMenu: React.FC<Props> = ({
  homeHref,
  moreItems = [],
  buyCakeLabel,
  buyCakeLink,
  chainId,
  cakePriceUsd,
  showCakePrice = true,
}) => {
  const { t } = useTranslation()
  const { linkComponent: LinkComponent } = useMenuContext()
  const [open, setOpen] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLeave = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  const handleEnter = useCallback(() => {
    clearLeave()
    setOpen(true)
  }, [clearLeave])

  const handleLeave = useCallback(() => {
    clearLeave()
    leaveTimer.current = setTimeout(() => setOpen(false), 120)
  }, [clearLeave])

  const { internalItems, externalItems } = useMemo(() => {
    const dividerIndex = moreItems.findIndex((i) => i.type === DropdownMenuItemType.DIVIDER)
    const before =
      dividerIndex === -1
        ? moreItems.filter((i) => i.type !== DropdownMenuItemType.DIVIDER)
        : moreItems.slice(0, dividerIndex).filter((i) => i.type !== DropdownMenuItemType.DIVIDER)
    const after =
      dividerIndex === -1
        ? []
        : moreItems.slice(dividerIndex + 1).filter((i) => i.type !== DropdownMenuItemType.DIVIDER)

    return {
      internalItems: sortMoreLinks(before),
      externalItems: after,
    }
  }, [moreItems])

  const renderLink = (item: DropdownMenuItems) => {
    const isExternal = item.type === DropdownMenuItemType.EXTERNAL_LINK || item.href?.startsWith('http')
    if (isExternal && item.href) {
      return (
        <Text
          key={item.label?.toString()}
          as="a"
          href={item.href}
          target="_blank"
          rel="noreferrer noopener"
          color="text"
          fontSize="16px"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
        >
          {item.label}
          <OpenNewIcon width="18px" />
        </Text>
      )
    }
    if (item.href) {
      return (
        <Text
          key={item.href}
          as={LinkComponent}
          href={item.href}
          color="text"
          fontSize="16px"
          style={{ display: 'block' }}
        >
          {item.label}
        </Text>
      )
    }
    return null
  }

  return (
    <>
      <AtomBox display={{ xs: 'flex', lg: 'none' }} alignItems="center">
        <LogoWithHover as={LinkComponent} href={homeHref} aria-label={t('Pancake home page')}>
          <LogoIcon width="32px" height="32px" />
        </LogoWithHover>
      </AtomBox>

      <AtomBox
        display={{ xs: 'none', lg: 'flex' }}
        alignItems="center"
        position="relative"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <LogoPill as={LinkComponent} href={homeHref} style={{ textDecoration: 'none', color: 'inherit' }}>
          <LogoWithHover>
            <LogoWithTextIcon width="160px" />
          </LogoWithHover>
          <ChevronDownIcon color="textSubtle" width="18px" />
        </LogoPill>

        {open && (
          <MenuPanel onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            <Flex justifyContent="space-between">
              <Box>
                <Text fontSize="16px" color="textSubtle" mb="8px">
                  {t('More')}
                </Text>
                <Flex flexDirection="column" style={{ gap: 4 }}>
                  {internalItems.map((item) => renderLink(item))}
                </Flex>
              </Box>
              <LinksColumn>
                <Text fontSize="16px" color="textSubtle" mb="8px">
                  {t('Links')}
                </Text>
                <Flex flexDirection="column" style={{ gap: 4 }}>
                  {externalItems.map((item) => renderLink(item))}
                </Flex>
              </LinksColumn>
            </Flex>

            <FooterRow>
              <Flex alignItems="center" style={{ gap: 8 }}>
                {showCakePrice ? (
                  <CakePrice chainId={chainId} cakePriceUsd={cakePriceUsd} color="textSubtle" showSkeleton={false} />
                ) : null}
                {showCakePrice && !cakePriceUsd ? (
                  <Text color="textDisabled" fontSize="14px">
                    —
                  </Text>
                ) : null}
              </Flex>
              <Button as="a" href={buyCakeLink} scale="sm">
                {buyCakeLabel}
              </Button>
            </FooterRow>
          </MenuPanel>
        )}
      </AtomBox>
    </>
  )
}

export default LogoWithMoreMenu
