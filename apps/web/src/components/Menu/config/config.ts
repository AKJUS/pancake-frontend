import { ChainId } from '@pancakeswap/chains'
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
  overrideSubNavItems?: DropdownMenuItems['items']
  matchHrefs?: string[]
}
export type ConfigMenuItemsType = Omit<MenuItemsType, 'items'> & {
  hideSubNav?: boolean
  image?: string
  items?: ConfigMenuDropDownItemsType[]
  overrideSubNavItems?: ConfigMenuDropDownItemsType[]
}

export const addMenuItemSupported = (item, chainId: number | undefined) => {
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

const config: (
  t: ContextApi['t'],
  isDark: boolean,
  languageCode?: string,
  chainId?: number,
) => ConfigMenuItemsType[] = (t, isDark, languageCode, chainId) =>
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
      ].map((item) => addMenuItemSupported(item, chainId)),
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
      hideSubNav: true,
      type: DropdownMenuItemType.EXTERNAL_LINK,
      confirmModalId: 'perpConfirmModal',
      showItemsOnMobile: false,
    },
    {
      label: t('Earn.verb'),
      href: '/liquidity/pools',
      icon: EarnIcon,
      fillIcon: EarnFillIcon,
      image: '/images/decorations/pe2.png',
      supportChainIds: SUPPORT_FARMS,
      overrideSubNavItems: [
        {
          label: t('Farm / Liquidity'),
          href: '/liquidity/pools',
          supportChainIds: SUPPORT_FARMS,
        },
        {
          label: t('veCake Redeem'),
          href: '/cake-staking/redeem',
          supportChainIds: POOL_SUPPORTED_CHAINS,
        },
        {
          label: t('Syrup Pools'),
          href: '/pools',
          supportChainIds: POOL_SUPPORTED_CHAINS,
        },
      ].map((item) => addMenuItemSupported(item, chainId)),
      items: [
        {
          label: t('Farm / Liquidity'),
          href: '/liquidity/pools',
          matchHrefs: ['/liquidity/positions', '/farms'],
          supportChainIds: SUPPORT_FARMS,
        },
        {
          label: t('Staking'),
          items: [
            {
              label: t('veCake Redeem'),
              href: '/cake-staking/redeem',
              supportChainIds: POOL_SUPPORTED_CHAINS,
            },
            {
              label: t('Syrup Pools'),
              href: '/pools',
              supportChainIds: POOL_SUPPORTED_CHAINS,
            },
          ].map((item) => addMenuItemSupported(item, chainId)),
        },
      ].map((item) => addMenuItemSupported(item, chainId)),
    },
    {
      label: t('CAKE.PAD'),
      icon: RocketIcon,
      href: '/cakepad',
      image: '/images/ifos/ifo-bunny.png',
      overrideSubNavItems: [
        {
          label: t('Latest'),
          href: '/cakepad',
        },
        {
          label: t('Finished'),
          href: '/cakepad/history',
        },
      ],
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
      ].map((item) => addMenuItemSupported(item, chainId)),
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
      ].map((item) => addMenuItemSupported(item, chainId)),
    },
  ].map((item) => addMenuItemSupported(item, chainId))

export default config
