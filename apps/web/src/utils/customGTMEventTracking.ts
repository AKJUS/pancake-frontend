import { PoolIds } from '@pancakeswap/ifos'
import { BetPosition } from '@pancakeswap/prediction'
import { BridgeStatus } from 'views/Swap/Bridge/types'
import { getChainFullName } from 'views/universalFarms/utils'

export enum GTMEvent {
  EventTracking = 'eventTracking',
  Swap = 'swap',
  SwapTxSent = 'swapTxSent',
  SwapTxSuccess = 'swapTxSuccess',
  SwapConfirmed = 'swapConfirmed',
  AddLiquidity = 'addLiquidity',
  AddLiquidityConfirmed = 'addLiquidityConfirmed',
  AddLiquidityTxSent = 'addLiquidityTxSent',
  RemoveLiquidity = 'removeLiquidity',
  StakeFarm = 'stakeFarm',
  StakeFarmConfirmed = 'stakeFarmConfirmed',
  StakeFarmTxSent = 'stakeFarmTxSent',
  UnStakeFarm = 'unStakeFarm',
  Web3WalletView = 'Web3WalletView',
  MenuClick = 'menuClick',
  StakePool = 'stakePool',
  LockCake = 'lockCake',
  BuyLotteryTickets = 'buyLotteryTickets',
  FiatOnRampModalOpened = 'fiatOnRampModalOpened',
  PredictionBet = 'predictionBet',
  PredictionBetPlaced = 'predictionBetPlaced',

  // IFO
  IFOGoToCakeStaking = 'ifoGoToCakeStaking',
  IFOCommit = 'ifoCommit',
  IFOCommitTxnSent = 'ifoCommitTxnSent',

  // IFO v2
  IfoDeposit = 'ifoDeposit',
  IfoClaim = 'ifoClaim',
  IfoConnectWallet = 'ifoConnectWallet',

  // IDO
  IdoDeposit = 'idoDeposit',
  IdoClaim = 'idoClaim',
  IdoConnectWallet = 'idoConnectWallet',

  // Quote
  SWAP_QUOTE_START = 'swapQuoteStart',
  SWAP_QUOTE_RECEIVED = 'swapQuoteReceived',
  SWAP_QUOTE_FAILED = 'swapQuoteFailed',

  // Cross Chain
  ORDER_STATUS_START = 'orderStatusStart',
  ORDER_STATUS_SUCCESS = 'orderStatusSuccess',
  ORDER_STATUS_FAILED = 'orderStatusFailed',

  // wallet
  ConnectWallet = 'connectWallet',
  ConnectWalletSelect = 'connectWalletSelect',
  DisconnectWallet = 'disconnectWallet',
  WalletConnected = 'walletConnected',
  WalletConnectFailed = 'walletConnectFailed',
  WalletConnect = 'walletConnect', // deprecated

  // Gift
  GiftEvent = 'giftEvent',
  PancakePicksClickEvent = 'click_PP',
}

export enum GTMCategory {
  TokenHighlight = 'TokenHighlight',
  Swap = 'Swap',
  AddLiquidity = 'AddLiquidity',
  RemoveLiquidity = 'RemoveLiquidity',
  Farm = 'Farm',
  UnStakeFarm = 'unStakeFarm',
  WalletConnect = 'WalletConnect',
  Web3WalletView = 'Web3WalletView',
  Pool = 'Pool',
  CakeStaking = 'CakeStaking',
  Lottery = 'Lottery',
  FiatOnRamp = 'FiatOnRamp',
  Prediction = 'Prediction',
  IFO = 'IFO',
  IDO = 'IDO',
  Gift = 'Gift',
  PancakePicks = 'PancakePicks',
}

export enum GTMAction {
  ClickTradeButton = 'Click Trade Button',
  ClickSwapButton = 'Click Swap Button',
  ClickSwapConfirmButton = 'Click Swap Confirm Button',
  SwapTransactionSent = 'Swap Transaction Sent',
  SwapTransactionSuccess = 'Swap Transaction Success',
  ClickAddLiquidityConfirmButton = 'Click Add Liquidity Confirm Button',
  AddLiquidityTransactionSent = 'Add Liquidity Transaction Sent',
  ClickAddLiquidityButton = 'Click Add Liquidity Button',
  ClickRemoveLiquidityButton = 'Click Remove Liquidity Button',
  ClickStakeFarmButton = 'Click Stake Farm Button',
  ClickStakeFarmConfirmButton = 'Click Stake Farm Confirm Button',
  StakeFarmTransactionSent = 'Stake Farm Transaction Sent',
  ClickUnStakeFarmButton = 'Click UnStake Farm Button',
  Web3WalletView = 'Web3 Wallet Page View',
  ClickStakePoolButton = 'Click Stake Pool Button',
  ClickEnablePoolButton = 'Click Enable Pool Button',
  ClickUnstakePoolButton = 'Click Unstake Pool Button',
  ClickLockCakeButton = 'Click Lock CAKE Button',
  ClickBuyLotteryTicketsButton = 'Click Buy Lottery Tickets Button',
  ClickFiatOnRampModalButton = 'Click Fiat On-Ramp Modal Button',
  ClickBetUpButton = 'Click Bet Up Button',
  ClickBetDownButton = 'Click Bet Down Button',
  PredictionBetPlaced = 'Prediction Bet Placed',

  // IFO
  ClickGoToCakeStakingButton = 'Click Go To Cake Staking Button',
  ClickCommitPublicSale = 'Click Commit Button for Public Sale',
  ClickCommitBasicSale = 'Click Commit Button for Basic Sale',
  CommitTxnSentPublicSale = 'Commit Transaction Sent for Public Sale',
  CommitTxnSentBasicSale = 'Commit Transaction Sent for Basic Sale',

  // IFOV2
  ConfirmIFODeposit = 'Confirm IFO Deposit',
  ConfirmIFOClaim = 'Confirm IFO Claim After TGE',
  IFOConnectWalletPreTGE = 'IFO Connect Wallet Pre TGE',
  IFOConnectWalletDuringTGE = 'IFO Connect Wallet During TGE',

  // IDO
  ConfirmIDODeposit = 'Confirm IDO Deposit',
  ConfirmIDOClaim = 'Confirm IDO Claim After TGE',
  IDOConnectWalletPreTGE = 'IDO Connect Wallet Pre TGE',
  IDOConnectWalletDuringTGE = 'IDO Connect Wallet During TGE',

  // Quote
  QuoterQuery = 'Query price from Quoter',

  // Cross Chain
  UpdateOrderStatus = 'Update Order Status',

  // Wallet
  ClickWalletConnectButton = 'Click Wallet Connect and Connected', // deprecated
  ClickOnWalletBtn = 'click on the connect wallet button',
  ClickOnWalletOption = 'click on wallet option',
  WalletConnectSucc = 'wallet connected successfully',
  WalletConnectFailed = 'wallet connection failed',
  ClickOnDisconnectedBtn = 'click on the disconnected wallet button',

  // Gift
  ToggleSendGift = 'toggle Send Gift',
  GiftPreview = 'click Gift Preview button',
  GiftCreate = 'click Gift Create button',
  GiftCreateSuccess = 'show Gift Create Success',

  PancakePicksClick = 'pancake pick pool click',
}

interface CustomGTMDataLayer {
  event: GTMEvent
  category?: GTMCategory
  action?: GTMAction
  [key: string]: unknown
}

type WindowWithDataLayer = Window & {
  dataLayer: CustomGTMDataLayer[] | undefined
}

declare const window: WindowWithDataLayer

export const customGTMEvent: WindowWithDataLayer['dataLayer'] =
  typeof window !== 'undefined' ? window?.dataLayer : undefined

export const logGTMClickTokenHighLightTradeEvent = (label?: string) => {
  console.info('---TokenHeightLightTrade---')
  window?.dataLayer?.push({
    event: GTMEvent.EventTracking,
    action: GTMAction.ClickTradeButton,
    category: GTMCategory.TokenHighlight,
    label,
  })
}

interface LogGTMClickSwapEventOptions {
  fromChain?: number
  toChain?: number
  fromToken?: string
  toToken?: string
  amount?: string
  amountOut?: string
  priceImpact?: number
}

export const logGTMClickSwapEvent = ({
  fromChain,
  toChain,
  fromToken,
  toToken,
  amount,
  amountOut,
  priceImpact,
}: LogGTMClickSwapEventOptions) => {
  console.info('---Swap---')
  window?.dataLayer?.push({
    event: GTMEvent.Swap,
    action: GTMAction.ClickSwapButton,
    category: GTMCategory.Swap,
    fromChain,
    toChain,
    fromToken,
    toToken,
    amount,
    amountOut,
    priceImpact,
  })
}

export const logGTMClickSwapConfirmEvent = ({
  fromChain,
  toChain,
  fromToken,
  toToken,
  amount,
  amountOut,
  priceImpact,
}: LogGTMClickSwapEventOptions) => {
  console.info('---SwapClickConfirm---')
  window?.dataLayer?.push({
    event: GTMEvent.SwapConfirmed,
    action: GTMAction.ClickSwapConfirmButton,
    category: GTMCategory.Swap,
    fromChain,
    toChain,
    fromToken,
    toToken,
    amount,
    amountOut,
    priceImpact,
  })
}

export const logGTMSwapTxSentEvent = (options?: {
  walletType?: string
  txType?: 'batch' | 'normal' | 'fallback'
  chainId?: number
  symbol?: string
}) => {
  // NOTE: SwapTxSent is called when the confirm wallet is clicked, not when the tx is sent
  // There is no txHash in this event.
  // SwapTxSuccess is called when the txHash is confirmed.
  console.info('---SwapTxSent---')
  window?.dataLayer?.push({
    event: GTMEvent.SwapTxSent,
    action: GTMAction.SwapTransactionSent,
    category: GTMCategory.Swap,
    walletType: options?.walletType,
    txType: options?.txType,
    chainId: options?.chainId,
    symbol: options?.symbol,
  })
}

export const logGTMSwapTxSuccessEvent = ({ txHash }: LogGTMClickSwapEventOptions & { txHash: string }) => {
  console.info('---SwapTxSuccess---', {
    txHash,
  })
  window?.dataLayer?.push({
    event: GTMEvent.SwapTxSuccess,
    action: GTMAction.SwapTransactionSuccess,
    category: GTMCategory.Swap,
    txHash,
  })
}

export const logGTMClickStakeFarmEvent = () => {
  console.info('---Stake---')
  window?.dataLayer?.push({
    event: GTMEvent.StakeFarm,
    action: GTMAction.ClickStakeFarmButton,
    category: GTMCategory.Farm,
  })
}

export const logGTMClickStakeFarmConfirmEvent = () => {
  console.info('---StakeFarmConfirmed---')
  window?.dataLayer?.push({
    event: GTMEvent.StakeFarmConfirmed,
    action: GTMAction.ClickStakeFarmConfirmButton,
    category: GTMCategory.Farm,
  })
}

export const logGTMStakeFarmTxSentEvent = () => {
  console.info('---StakeFarmTxSent---')
  window?.dataLayer?.push({
    event: GTMEvent.StakeFarmTxSent,
    action: GTMAction.StakeFarmTransactionSent,
    category: GTMCategory.Farm,
  })
}

export const logGTMClickUnStakeFarmEvent = () => {
  console.info('---UnStake---')
  window?.dataLayer?.push({
    event: GTMEvent.UnStakeFarm,
    action: GTMAction.ClickUnStakeFarmButton,
    category: GTMCategory.UnStakeFarm,
  })
}

export const logGTMClickAddLiquidityEvent = () => {
  console.info('---AddLiquidity---')
  window?.dataLayer?.push({
    event: GTMEvent.AddLiquidity,
    action: GTMAction.ClickAddLiquidityButton,
    category: GTMCategory.AddLiquidity,
  })
}

export const logGTMClickAddLiquidityConfirmEvent = () => {
  console.info('---AddLiquidityConfirmed---')
  window?.dataLayer?.push({
    event: GTMEvent.AddLiquidityConfirmed,
    action: GTMAction.ClickAddLiquidityConfirmButton,
    category: GTMCategory.AddLiquidity,
  })
}

export const logGTMAddLiquidityTxSentEvent = () => {
  console.info('---AddLiquidityTxSent---')
  window?.dataLayer?.push({
    event: GTMEvent.AddLiquidityTxSent,
    action: GTMAction.AddLiquidityTransactionSent,
    category: GTMCategory.AddLiquidity,
  })
}

export const logGTMClickRemoveLiquidityEvent = () => {
  console.info('---RemoveLiquidity---')
  window?.dataLayer?.push({
    event: GTMEvent.RemoveLiquidity,
    action: GTMAction.ClickRemoveLiquidityButton,
    category: GTMCategory.RemoveLiquidity,
  })
}

export const logGTMConnectWalletEvent = (chainId: number | undefined) => {
  const info = chainId && getChainFullName(chainId)
  console.info('---ConnectWallet---', info)
  window?.dataLayer?.push({
    event: GTMEvent.ConnectWallet,
    action: GTMAction.ClickOnWalletBtn,
    category: GTMCategory.WalletConnect,
    info,
  })
}
export const logGTMConnectWalletSelectEvent = (chainId: number | undefined, walletTitle: string | undefined) => {
  const info = chainId && getChainFullName(chainId)
  console.info('---ConnectWalletSelect---', info, walletTitle)
  window?.dataLayer?.push({
    event: GTMEvent.ConnectWalletSelect,
    action: GTMAction.ClickOnWalletOption,
    category: GTMCategory.WalletConnect,
    label: walletTitle,
    info,
  })
}
export const logGTMWalletConnectedEvent = (
  chainId: number | undefined,
  walletTitle: string | undefined,
  address: string | undefined,
) => {
  const info = chainId && getChainFullName(chainId)
  console.info('---WalletConnected---', info, walletTitle, address)
  window?.dataLayer?.push({
    event: GTMEvent.WalletConnected,
    action: GTMAction.WalletConnectSucc,
    category: GTMCategory.WalletConnect,
    label: walletTitle,
    desc: address,
    info,
  })
}

export const logGTMWalletConnectFailedEvent = (
  chainId: number | undefined,
  walletTitle: string | undefined,
  network: string,
  errorType: string,
  errorMessage?: string,
) => {
  const info = chainId && getChainFullName(chainId)
  console.info('---WalletConnectFailed---', info, walletTitle, network, errorType, errorMessage)
  window?.dataLayer?.push({
    event: GTMEvent.WalletConnectFailed,
    action: GTMAction.WalletConnectFailed,
    category: GTMCategory.WalletConnect,
    label: walletTitle,
    info,
    network,
    error_type: errorType,
    error_message: errorMessage,
  })
}
export const logGTMDisconnectWalletEvent = (
  chainId: number | undefined,
  walletTitle: string | undefined,
  address: string | undefined,
) => {
  const info = chainId && getChainFullName(chainId)
  console.info('---DisconnectWallet---', info, walletTitle, address)
  window?.dataLayer?.push({
    event: GTMEvent.DisconnectWallet,
    action: GTMAction.ClickOnDisconnectedBtn,
    category: GTMCategory.WalletConnect,
    label: walletTitle,
    desc: address,
    info,
  })
}

export const logWeb3WalletViews = () => {
  console.info('---web3WalletView---')
  window?.dataLayer?.push({
    event: GTMEvent.Web3WalletView,
    action: GTMAction.Web3WalletView,
    category: GTMCategory.Web3WalletView,
  })
}

export const logMenuClick = (path: string) => {
  window?.dataLayer?.push({
    event: GTMEvent.MenuClick,
    label: path,
  })
}

export const logGTMClickStakePoolEvent = (poolName?: string) => {
  console.info('---StakePool---')
  window?.dataLayer?.push({
    event: GTMEvent.StakePool,
    action: GTMAction.ClickStakePoolButton,
    category: GTMCategory.Pool,
    label: poolName,
  })
}

export const logGTMClickEnablePoolEvent = (poolName?: string) => {
  console.info('---EnablePool---')
  window?.dataLayer?.push({
    event: GTMEvent.StakePool,
    action: GTMAction.ClickEnablePoolButton,
    category: GTMCategory.Pool,
    label: poolName,
  })
}

export const logGTMClickUnstakePoolEvent = (poolName?: string) => {
  console.info('---UnstakePool---')
  window?.dataLayer?.push({
    event: GTMEvent.StakePool,
    action: GTMAction.ClickUnstakePoolButton,
    category: GTMCategory.Pool,
    label: poolName,
  })
}

export const logGTMClickLockCakeEvent = () => {
  console.info('---LockCake---')
  window?.dataLayer?.push({
    event: GTMEvent.LockCake,
    action: GTMAction.ClickLockCakeButton,
    category: GTMCategory.CakeStaking,
  })
}

export const logGTMBuyLotteryTicketsEvent = (numberOfTickets: string) => {
  console.info('---BuyLotteryTickets---')
  window?.dataLayer?.push({
    event: GTMEvent.BuyLotteryTickets,
    action: GTMAction.ClickBuyLotteryTicketsButton,
    category: GTMCategory.Lottery,
    label: `Number of tickets: ${numberOfTickets}`,
  })
}

export const logGTMFiatOnRampModalEvent = (provider: string | undefined) => {
  console.info('---FiatOnRampModalOpened---')
  window?.dataLayer?.push({
    event: GTMEvent.FiatOnRampModalOpened,
    action: GTMAction.ClickFiatOnRampModalButton,
    category: GTMCategory.FiatOnRamp,
    label: `Provider: ${provider || 'Unknown'}`,
  })
}

export const logGTMPredictionBetEvent = (position: BetPosition, address?: string) => {
  console.info(`---PredictionBet${position}---`, address)
  window?.dataLayer?.push({
    event: GTMEvent.PredictionBet,
    action: position === BetPosition.BULL ? GTMAction.ClickBetUpButton : GTMAction.ClickBetDownButton,
    category: GTMCategory.Prediction,
    desc: address,
  })
}

export const logGTMPredictionBetPlacedEvent = (position: string, address?: string, predictedToken?: string) => {
  console.info('---PredictionBetPlaced---', { address, predictedToken })
  window?.dataLayer?.push({
    event: GTMEvent.PredictionBetPlaced,
    action: GTMAction.PredictionBetPlaced,
    category: GTMCategory.Prediction,
    label: `Position: ${position}`,
    desc: address,
    predictedToken,
  })
}

export const logGTMIfoGoToCakeStakingEvent = () => {
  console.info('---IFOGoToCakeStaking---')
  window?.dataLayer?.push({
    event: GTMEvent.IFOGoToCakeStaking,
    action: GTMAction.ClickGoToCakeStakingButton,
    category: GTMCategory.IFO,
  })
}

export const logGTMIfoCommitEvent = (poolId: PoolIds) => {
  console.info('---IFOCommit---')
  window?.dataLayer?.push({
    event: GTMEvent.IFOCommit,
    action: poolId === PoolIds.poolUnlimited ? GTMAction.ClickCommitPublicSale : GTMAction.ClickCommitBasicSale,
    category: GTMCategory.IFO,
  })
}

export const logGTMIfoCommitTxnSentEvent = (poolId: PoolIds) => {
  console.info('---IFOCommitTxnSent---')
  window?.dataLayer?.push({
    event: GTMEvent.IFOCommitTxnSent,
    action: poolId === PoolIds.poolUnlimited ? GTMAction.CommitTxnSentPublicSale : GTMAction.CommitTxnSentBasicSale,
    category: GTMCategory.IFO,
  })
}

export const logGTMIdoDepositEvent = () => {
  console.info('---IdoDeposit---')
  window?.dataLayer?.push({
    event: GTMEvent.IdoDeposit,
    action: GTMAction.ConfirmIDODeposit,
    category: GTMCategory.IDO,
  })
}

export const logGTMIfoDepositEvent = () => {
  console.info('---IfoDeposit---')
  window?.dataLayer?.push({
    event: GTMEvent.IfoDeposit,
    action: GTMAction.ConfirmIDODeposit,
    category: GTMCategory.IDO,
  })
}

export const logGTMIdoClaimEvent = () => {
  console.info('---IdoClaim---')
  window?.dataLayer?.push({
    event: GTMEvent.IfoClaim,
    action: GTMAction.ConfirmIDOClaim,
    category: GTMCategory.IDO,
  })
}

export const logGTMIfoClaimEvent = () => {
  console.info('---IfoClaim---')
  window?.dataLayer?.push({
    event: GTMEvent.IfoClaim,
    action: GTMAction.ConfirmIFOClaim,
    category: GTMCategory.IFO,
  })
}

export const logGTMIdoConnectWalletEvent = (preTGE: boolean) => {
  console.info('---IdoConnectWallet---')
  window?.dataLayer?.push({
    event: GTMEvent.IdoConnectWallet,
    action: preTGE ? GTMAction.IDOConnectWalletPreTGE : GTMAction.IDOConnectWalletDuringTGE,
    category: GTMCategory.IDO,
  })
}

export const logGTMIfoConnectWalletEvent = (preTGE: boolean) => {
  console.info('---IfoConnectWallet---')
  window?.dataLayer?.push({
    event: GTMEvent.IfoConnectWallet,
    action: preTGE ? GTMAction.IDOConnectWalletPreTGE : GTMAction.IDOConnectWalletDuringTGE,
    category: GTMCategory.IDO,
  })
}

export const logGTMToggleSendGiftEvent = (isSendGiftOn: boolean, chainId?: number) => {
  console.info('---ToggleSendGift---', { isSendGiftOn, chainId })
  window?.dataLayer?.push({
    event: GTMEvent.GiftEvent,
    action: GTMAction.ToggleSendGift,
    category: GTMCategory.Gift,
    label: isSendGiftOn ? 'on' : 'off',
    chainId,
  })
}

export const logGTMGiftPreviewEvent = (chainId?: number) => {
  console.info('---GiftPreview---', { chainId })
  window?.dataLayer?.push({
    event: GTMEvent.GiftEvent,
    action: GTMAction.GiftPreview,
    category: GTMCategory.Gift,
    chainId,
  })
}

export const logGTMGiftCreateEvent = (chainId?: number) => {
  console.info('---GiftCreate---', { chainId })
  window?.dataLayer?.push({
    event: GTMEvent.GiftEvent,
    action: GTMAction.GiftCreate,
    category: GTMCategory.Gift,
    chainId,
  })
}

export const logPancakePicksClickEvent = (poolName?: string) => {
  console.info('---PancakePick---', { poolName })
  window?.dataLayer?.push({
    event: GTMEvent.PancakePicksClickEvent,
    action: GTMAction.PancakePicksClick,
    category: GTMCategory.PancakePicks,
    label: poolName,
  })
}

export const logGTMGiftCreateSuccessEvent = (chainId?: number, amount?: string, giftTokenType?: 'link' | 'qr') => {
  console.info('---GiftCreateSuccess---', { chainId, amount, giftTokenType })
  window?.dataLayer?.push({
    event: GTMEvent.GiftEvent,
    action: GTMAction.GiftCreateSuccess,
    category: GTMCategory.Gift,
    chainId,
    amount,
    giftTokenType,
  })
}

export const logGTMOrderStatusEvent = (status: BridgeStatus) => {
  console.info('---OrderStatus---', status)
  const event = status === BridgeStatus.SUCCESS ? GTMEvent.ORDER_STATUS_SUCCESS : GTMEvent.ORDER_STATUS_FAILED

  window?.dataLayer?.push({
    event: [BridgeStatus.SUCCESS, BridgeStatus.PARTIAL_SUCCESS].includes(status) ? event : GTMEvent.ORDER_STATUS_START,
    action: GTMAction.UpdateOrderStatus,
  })
}

export const logGTMQuoteQueryEvent = (
  type: 'start' | 'succ' | 'fail',
  options: LogGTMClickSwapEventOptions & { errorMessage?: string },
) => {
  const { fromChain, toChain, fromToken, toToken, amount, amountOut } = options

  const event =
    type === 'succ'
      ? GTMEvent.SWAP_QUOTE_RECEIVED
      : type === 'start'
      ? GTMEvent.SWAP_QUOTE_START
      : GTMEvent.SWAP_QUOTE_FAILED

  if (type === 'start') {
    console.info('---QuoteStart---', options)
  } else if (type === 'succ') {
    console.info('---QuoteSuccess---', options, amountOut)
  } else {
    console.info('---QuoteFailed---', options)
  }

  window?.dataLayer?.push({
    event,
    action: GTMAction.QuoterQuery,
    category: GTMCategory.Swap,
    fromChain,
    toChain,
    fromToken,
    toToken,
    amount,
    amountOut,
    type,
  })
}
