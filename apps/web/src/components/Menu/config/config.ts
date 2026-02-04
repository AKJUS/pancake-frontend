import { ChainId, UnifiedChainId } from '@pancakeswap/chains'
import { ContextApi } from '@pancakeswap/localization'
import { SUPPORTED_CHAIN_IDS as POOL_SUPPORTED_CHAINS } from '@pancakeswap/pools'
import { SUPPORTED_CHAIN_IDS as PREDICTION_SUPPORTED_CHAINS } from '@pancakeswap/prediction'
import {
  DropdownMenuItems,
  DropdownMenuItemType,
  EarnFillIcon,
  EarnIcon,
  GameIcon,
  MenuItemsType,
  MoreIcon,
  RocketIcon,
  SwapFillIcon,
  SwapIcon,
  TradeFilledIcon,
  TradeIcon,
} from '@pancakeswap/uikit'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { SUPPORT_FARMS, SUPPORT_ONLY_BSC } from 'config/constants/supportChains'
import { getPerpetualUrl } from 'utils/getPerpetualUrl'
import { EVM_CHAIN_IDS } from 'utils/wagmi'

export type ConfigMenuDropDownItemsType = DropdownMenuItems & {
  hideSubNav?: boolean
  overrideSubNavItems?: ConfigMenuDropDownItemsType[]
  matchHrefs?: string[]
  isHot?: boolean
  supportChainIds?: readonly UnifiedChainId[]
}

export type ConfigMenuItemsType = Omit<MenuItemsType, 'items'> & {
  hideSubNav?: boolean
  image?: string
  items?: ConfigMenuDropDownItemsType[]
  overrideSubNavItems?: ConfigMenuDropDownItemsType[]
  type?: DropdownMenuItemType
  isHot?: boolean
  confirmModalId?: string
  supportChainIds?: readonly UnifiedChainId[]
}

const addMenuItemSupported = <T extends ConfigMenuItemsType | ConfigMenuDropDownItemsType>(
  item: T,
  chainId?: UnifiedChainId,
): T => {
  if (!chainId || !item.supportChainIds) {
    return item
  }
  if (item.supportChainIds?.includes(chainId)) {
    return item
  }
  // if unsupported chain, redirect to bsc
  if (item?.href) {
    return {
      ...item,
      href: `${item.href}?chain=${CHAIN_QUERY_NAME[ChainId.BSC]}`,
    }
  }
  return item
}

const normalizeMenuByChain = <T extends ConfigMenuItemsType | ConfigMenuDropDownItemsType>(
  items: T[],
  chainId: number | undefined,
): T[] =>
  items.map((item) => {
    const next = addMenuItemSupported(item, chainId)

    if (!next.items && !next.overrideSubNavItems) {
      return next
    }

    return {
      ...next,
      items: next.items ? normalizeMenuByChain(next.items, chainId) : undefined,
      overrideSubNavItems: next.overrideSubNavItems
        ? normalizeMenuByChain(next.overrideSubNavItems, chainId)
        : undefined,
    }
  })

const config: (
  t: ContextApi['t'],
  isDark: boolean,
  languageCode?: string,
  chainId?: number,
) => ConfigMenuItemsType[] = (t, isDark, languageCode, chainId) =>
  normalizeMenuByChain(
    [
      {
        label: t('Trade'),
        icon: SwapIcon,
        fillIcon: SwapFillIcon,
        href: '/swap',
        hideSubNav: true,
        items: [
          {
            label: t('Swap'),
            href: '/swap',
          },
          {
            label: t('TWAP'),
            href: '/swap/twap',
            display: false,
          },
          {
            label: t('Limit Orders'),
            href: '/swap/limit',
            display: false,
          },
          {
            label: t('Buy Crypto'),
            href: '/buy-crypto',
            supportChainIds: EVM_CHAIN_IDS,
          },
        ],
      },
      {
        label: t('Perps'),
        icon: TradeIcon,
        fillIcon: TradeFilledIcon,
        href: getPerpetualUrl({
          chainId,
          languageCode,
          isDark,
        }),
        type: DropdownMenuItemType.EXTERNAL_LINK,
        confirmModalId: 'perpConfirmModal',
      },
      {
        label: t('Earn.verb'),
        href: '/liquidity/pools',
        icon: EarnIcon,
        fillIcon: EarnFillIcon,
        image: '/images/decorations/pe2.png',
        supportChainIds: SUPPORT_FARMS,
        items: [
          {
            label: t('Farm / Liquidity'),
            href: '/liquidity/pools',
            matchHrefs: ['/liquidity/positions', '/farms'],
            supportChainIds: SUPPORT_FARMS,
          },
          {
            label: t('Syrup Pools'),
            href: '/pools',
            supportChainIds: POOL_SUPPORTED_CHAINS,
          },
        ],
      },
      {
        label: t('Prob'),
        icon: RocketIcon,
        href: 'https://probable.markets',
        isHot: true,
      },
      {
        label: t('Play'),
        icon: GameIcon,
        href: '/prediction',
        overrideSubNavItems: [
          {
            label: t('Prediction'),
            href: '/prediction',
          },
          {
            label: t('Lottery'),
            href: '/lottery',
          },
        ],
        items: [
          {
            label: t('Springboard'),
            href: 'https://springboard.pancakeswap.finance',
            type: DropdownMenuItemType.EXTERNAL_LINK,
          },
          {
            label: t('Prediction'),
            href: '/prediction',
            image: '/images/decorations/prediction.png',
            supportChainIds: PREDICTION_SUPPORTED_CHAINS,
          },
          {
            label: t('Lottery'),
            href: '/lottery',
            image: '/images/decorations/lottery.png',
          },
          {
            label: t('CAKE.PAD'),
            href:
              typeof window !== 'undefined' && window.location.pathname.startsWith('/cakepad-base')
                ? '/cakepad-base'
                : '/cakepad',
            image: '/images/ifos/ifo-bunny.png',
            overrideSubNavItems: [
              {
                label: t('Latest'),
                href:
                  typeof window !== 'undefined' && window.location.pathname.startsWith('/cakepad-base')
                    ? '/cakepad-base'
                    : '/cakepad',
                matchHrefs:
                  typeof window !== 'undefined' && window.location.pathname.startsWith('/cakepad-base')
                    ? ['/cakepad-base/deposit']
                    : ['/cakepad/deposit'],
              },
              {
                label: t('Finished'),
                href:
                  typeof window !== 'undefined' && window.location.pathname.startsWith('/cakepad-base')
                    ? '/cakepad-base/history'
                    : '/cakepad/history',
              },
            ],
          },
        ],
      },
      {
        label: '',
        href: '/info',
        icon: MoreIcon,
        hideSubNav: true,
        items: [
          {
            label: t('Info.section_title'),
            href: '/info/v3',
          },
          {
            label: t('Burn Dashboard'),
            href: '/burn-dashboard',
          },
          {
            label: t('Voting'),
            image: '/images/voting/voting-bunny.png',
            href: '/voting',
            supportChainIds: SUPPORT_ONLY_BSC,
          },
          {
            type: DropdownMenuItemType.DIVIDER,
          },
          {
            label: t('Blog'),
            href: 'https://blog.pancakeswap.finance',
            type: DropdownMenuItemType.EXTERNAL_LINK,
          },
          {
            label: t('Docs'),
            href: 'https://docs.pancakeswap.finance',
            type: DropdownMenuItemType.EXTERNAL_LINK,
          },
        ],
      },
    ],
    chainId,
  )

export default config
