import { useTranslation } from '@pancakeswap/localization'
import {
  DropdownMenuItemType,
  LogoIcon,
  LogoWithTextIcon,
  Menu as UikitMenu,
  footerLinks,
  useModal,
} from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import USCitizenConfirmModal from 'components/Modal/USCitizenConfirmModal'
import { NetworkSwitcher } from 'components/NetworkSwitcher'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCakePrice } from 'hooks/useCakePrice'
import { usePerpUrl } from 'hooks/usePerpUrl'
import useTheme from 'hooks/useTheme'
import { IdType, useUserNotUsCitizenAcknowledgement } from 'hooks/useUserIsUsCitizenAcknowledgement'
import { useWebNotifications } from 'hooks/useWebNotifications'
import { useRouter } from 'next/router'
import { Suspense, lazy, useCallback, useMemo } from 'react'
import { styled } from 'styled-components'
import { CAKEPAD_BASE_URL } from 'views/Cakepad/config/routes'
import GlobalSettings from './GlobalSettings'
import UserMenu from './UserMenu'
import { UseMenuItemsParams, useMenuItems } from './hooks/useMenuItems'
import { getActiveMenuItem, getActiveSubMenuChildItem, getActiveSubMenuItem } from './utils'

const Notifications = lazy(() => import('views/Notifications'))

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
  const { enabled } = useWebNotifications()
  const { chainId } = useActiveChainId()
  const { isDark, setTheme } = useTheme()
  const cakePrice = useCakePrice()
  const { currentLanguage, t } = useTranslation()
  const { pathname } = useRouter()
  const perpUrl = usePerpUrl({ chainId, isDark, languageCode: currentLanguage.code })
  const [perpConfirmed] = useUserNotUsCitizenAcknowledgement(IdType.PERPETUALS)
  const isCakepadBaseRoute = pathname.startsWith(CAKEPAD_BASE_URL)

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

  const rightSide = isCakepadBaseRoute ? (
    <UserMenu />
  ) : (
    <>
      <GlobalSettings />
      {enabled && (
        <Suspense fallback={null}>
          <Notifications />
        </Suspense>
      )}
      <NetworkSwitcher />
      <UserMenu />
    </>
  )

  const logoComponent = isCakepadBaseRoute ? <StaticLogo /> : undefined

  return (
    <UikitMenu
      linkComponent={LinkComponent}
      rightSide={rightSide}
      chainId={chainId}
      banner={null}
      isDark={isDark}
      toggleTheme={toggleTheme}
      showLangSelector={false}
      cakePriceUsd={cakePrice.eq(BIG_ZERO) ? undefined : cakePrice}
      links={filteredLinks}
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
  )
}

function filterItemsProps(items: ReturnType<typeof useMenuItems>) {
  return items.map((item) => {
    return {
      ...item,
      items: item.items?.map((subItem) => {
        const { matchHrefs, overrideSubNavItems, ...rest } = subItem
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
  const { enabled } = useWebNotifications()
  const { pathname } = useRouter()
  const isCakepadBaseRoute = pathname.startsWith(CAKEPAD_BASE_URL)
  return (
    <>
      <SharedComponentWithOutMenuWrapper>
        {!isCakepadBaseRoute && (
          <>
            <GlobalSettings />
            {enabled && (
              <Suspense fallback={null}>
                <Notifications />
              </Suspense>
            )}
            <NetworkSwitcher />
          </>
        )}
        <UserMenu />
      </SharedComponentWithOutMenuWrapper>
      {children}
    </>
  )
}
