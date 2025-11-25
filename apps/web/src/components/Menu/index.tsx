import { useTranslation } from '@pancakeswap/localization'
import { Menu as UikitMenu, footerLinks, useModal } from '@pancakeswap/uikit'
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
import GlobalSettings from './GlobalSettings'
import UserMenu from './UserMenu'
import { UseMenuItemsParams, useMenuItems } from './hooks/useMenuItems'
import { getActiveMenuItem, getActiveSubMenuChildItem, getActiveSubMenuItem } from './utils'

const Notifications = lazy(() => import('views/Notifications'))

const LinkComponent = (linkProps) => {
  return <NextLinkFromReactRouter to={linkProps.href} {...linkProps} prefetch={false} />
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

  return (
    <UikitMenu
      linkComponent={LinkComponent}
      rightSide={
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
      }
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
      activeItem={activeMenuItem?.href}
      activeSubItem={activeSubMenuItem?.href}
      activeSubItemChildItem={activeSubChildMenuItem?.href}
      buyCakeLabel={t('Buy CAKE')}
      buyCakeLink="/swap?outputCurrency=0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82&chainId=56"
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

export const SharedComponentWithOutMenu: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { enabled } = useWebNotifications()
  return (
    <>
      <SharedComponentWithOutMenuWrapper>
        <GlobalSettings />
        {enabled && (
          <Suspense fallback={null}>
            <Notifications />
          </Suspense>
        )}
        <NetworkSwitcher />
        <UserMenu />
      </SharedComponentWithOutMenuWrapper>
      {children}
    </>
  )
}
