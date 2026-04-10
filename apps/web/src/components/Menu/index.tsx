import { useTranslation } from '@pancakeswap/localization'
import {
  DropdownMenuItemType,
  FlexGap,
  LogoIcon,
  LogoWithTextIcon,
  Menu as UikitMenu,
  MoreIcon,
  footerLinks,
  useModal,
} from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import USCitizenConfirmModal from 'components/Modal/USCitizenConfirmModal'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCakePrice } from 'hooks/useCakePrice'
import { usePerpUrl } from 'hooks/usePerpUrl'
import useTheme from 'hooks/useTheme'
import { IdType, useUserNotUsCitizenAcknowledgement } from 'hooks/useUserIsUsCitizenAcknowledgement'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { styled } from 'styled-components'
import { useCakepadBaseExperience } from 'views/Cakepad/hooks/useCakepadBaseExperience'
import GlobalSettings from './GlobalSettings'
import LogoWithMoreMenu from './LogoWithMoreMenu'
import { NavbarSearch } from '../NavbarSearch'
import UserMenu from './UserMenu'
import { WalletPanelProvider } from './WalletPanelContext'
import { UseMenuItemsParams, useMenuItems } from './hooks/useMenuItems'
import { getActiveMenuItem, getActiveSubMenuChildItem, getActiveSubMenuItem } from './utils'

const LinkComponent = (linkProps) => {
  const { href, type, ...props } = linkProps
  // Check if it's an external link by type property first, then fallback to URL pattern
  const isExternalLink =
    type === DropdownMenuItemType.EXTERNAL_LINK || href?.startsWith('http://') || href?.startsWith('https://')

  if (isExternalLink) {
    return <NextLinkFromReactRouter to={href} target="_blank" rel="noreferrer noopener" {...props} />
  }

  return <NextLinkFromReactRouter to={href} {...props} prefetch={false} />
}

const EMPTY_ARRAY = []

const Menu = (props) => {
  const { chainId } = useActiveChainId()
  const { isDark, setTheme } = useTheme()
  const cakePrice = useCakePrice()
  const { currentLanguage, t } = useTranslation()
  const router = useRouter()
  const { pathname } = router
  const perpUrl = usePerpUrl({ chainId, isDark, languageCode: currentLanguage.code })
  const [perpConfirmed] = useUserNotUsCitizenAcknowledgement(IdType.PERPETUALS)
  const isCakepadBaseRoute = useCakepadBaseExperience()

  const [onPerpConfirmModalPresent] = useModal(
    <USCitizenConfirmModal title={t('PancakeSwap Perpetuals')} id={IdType.PERPETUALS} href={perpUrl} />,
    true,
    false,
    'perpConfirmModal',
  )
  const onSubMenuClick = useCallback<NonNullable<UseMenuItemsParams['onClick']>>(
    (e, item) => {
      if (item.confirmModalId === 'perpConfirmModal' && !perpConfirmed) {
        e.preventDefault()
        e.stopPropagation()
        onPerpConfirmModalPresent()
      }
    },
    [perpConfirmed, onPerpConfirmModalPresent],
  )

  const menuItems = useMenuItems({
    onClick: onSubMenuClick,
  })

  const activeMenuItem = useMemo(() => getActiveMenuItem({ menuConfig: menuItems, pathname }), [menuItems, pathname])
  const activeSubMenuItem = useMemo(
    () => getActiveSubMenuItem({ menuItem: activeMenuItem, pathname }),
    [pathname, activeMenuItem],
  )
  const activeSubChildMenuItem = useMemo(
    () => getActiveSubMenuChildItem({ menuItem: activeMenuItem, pathname }),
    [activeMenuItem, pathname],
  )

  const toggleTheme = useMemo(() => {
    return () => setTheme(isDark ? 'light' : 'dark')
  }, [setTheme, isDark])

  const getFooterLinks = useMemo(() => {
    return footerLinks(t)
  }, [t])

  const filteredLinks = useMemo(() => filterItemsProps(menuItems), [menuItems])

  const moreMenuItem = useMemo(
    () => menuItems.find((item) => item.icon === MoreIcon && item.href === '/info'),
    [menuItems],
  )

  const linksForNav = useMemo(
    () => filteredLinks.filter((item) => !(item.icon === MoreIcon && item.href === '/info')),
    [filteredLinks],
  )

  const cakePriceNumber = useMemo(
    () => (cakePrice.eq(BIG_ZERO) ? undefined : parseFloat(cakePrice.toFixed(4))),
    [cakePrice],
  )

  const rightSide = isCakepadBaseRoute ? (
    <UserMenu />
  ) : (
    <FlexGap alignItems="center" flexShrink={0} gap="6px" style={{ minWidth: 0 }}>
      <NavbarSearch />
      <GlobalSettings />
      <UserMenu />
    </FlexGap>
  )

  const logoComponent = isCakepadBaseRoute ? (
    <StaticLogo />
  ) : (
    <LogoWithMoreMenu
      homeHref="/home"
      moreItems={moreMenuItem?.items}
      buyCakeLabel={t('Buy CAKE')}
      buyCakeLink="/swap?outputCurrency=0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82&chainId=56"
      chainId={chainId}
      cakePriceUsd={cakePriceNumber}
    />
  )

  return (
    <WalletPanelProvider>
      <UikitMenu
        linkComponent={LinkComponent}
        rightSide={rightSide}
        chainId={chainId}
        banner={null}
        isDark={isDark}
        toggleTheme={toggleTheme}
        showLangSelector={false}
        cakePriceUsd={cakePrice.eq(BIG_ZERO) ? undefined : cakePriceNumber}
        links={filteredLinks}
        desktopNavLinks={linksForNav}
        subLinks={
          activeSubMenuItem?.overrideSubNavItems ??
          activeMenuItem?.overrideSubNavItems ??
          (activeMenuItem?.hideSubNav || activeSubMenuItem?.hideSubNav
            ? EMPTY_ARRAY
            : activeSubMenuItem?.items ?? activeMenuItem?.items)
        }
        footerLinks={getFooterLinks}
        showFooter={!isCakepadBaseRoute}
        showBottomNav={!isCakepadBaseRoute}
        activeItem={activeMenuItem?.href}
        activeSubItem={activeSubMenuItem?.href}
        activeSubItemChildItem={activeSubChildMenuItem?.href}
        buyCakeLabel={t('Buy CAKE')}
        buyCakeLink="/swap?outputCurrency=0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82&chainId=56"
        logoComponent={logoComponent}
        {...props}
      />
    </WalletPanelProvider>
  )
}

function filterItemsProps(items: ReturnType<typeof useMenuItems>) {
  return items.map((item) => {
    return {
      ...item,
      items: item.items?.map((subItem) => {
        const { matchHrefs: _matchHrefs, overrideSubNavItems: _overrideSubNavItems, ...rest } = subItem
        return rest
      }),
    }
  })
}

export default Menu

const SharedComponentWithOutMenuWrapper = styled.div`
  display: none;
`

const StaticLogoWrapper = styled.div`
  display: flex;
  align-items: center;
  cursor: default;

  .mobile-icon {
    width: 32px;
    ${({ theme }) => theme.mediaQueries.xl} {
      display: none;
    }
  }

  .desktop-icon {
    width: 160px;
    display: none;
    ${({ theme }) => theme.mediaQueries.xl} {
      display: block;
    }
  }
`

const StaticLogo: React.FC = () => (
  <StaticLogoWrapper aria-label="Pancake logo">
    <LogoIcon className="mobile-icon" />
    <LogoWithTextIcon className="desktop-icon" />
  </StaticLogoWrapper>
)

export const SharedComponentWithOutMenu: React.FC<React.PropsWithChildren> = ({ children }) => {
  const isCakepadBaseRoute = useCakepadBaseExperience()
  return (
    <>
      <SharedComponentWithOutMenuWrapper>
        {!isCakepadBaseRoute && (
          <>
            <GlobalSettings />
          </>
        )}
        <UserMenu />
      </SharedComponentWithOutMenuWrapper>
      {children}
    </>
  )
}
