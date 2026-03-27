import { NonEVMChainId } from '@pancakeswap/chains'
import { useDebounce } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Percent } from '@pancakeswap/sdk'
import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import {
  AutoRenewIcon,
  Box,
  Button,
  CloseIcon,
  Flex,
  FlexGap,
  IconButton,
  Input,
  LazyAnimatePresence,
  Text,
  domAnimation,
  useToast,
} from '@pancakeswap/uikit'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { SwapUIV2 } from '@pancakeswap/widgets-internal'
import CurrencyLogo from 'components/Logo/CurrencyLogo'
import { ToastDescriptionWithTx, SolanaDescriptionWithTx } from 'components/Toast'
import { ASSET_CDN } from 'config/constants/endpoints'
import { BalanceData } from 'hooks/useAddressBalance'
import useCatchTxError from 'hooks/useCatchTxError'

import { useERC20 } from 'hooks/useContract'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useSolanaTokenPrice } from 'hooks/solana/useSolanaTokenPrice'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { logGTMGiftPreviewEvent } from 'utils/customGTMEventTracking'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { checksumAddress, formatUnits, isAddress, zeroAddress } from 'viem'
import { CreateGiftView } from 'views/Gift/components/CreateGiftView'
import { SendGiftToggle } from 'views/Gift/components/SendGiftToggle'
import { CHAINS_WITH_GIFT_CLAIM } from 'views/Gift/constants'
import { SendGiftContext, useSendGiftContext } from 'views/Gift/providers/SendGiftProvider'
import { useUserInsufficientBalanceLight } from 'views/SwapSimplify/hooks/useUserInsufficientBalance'
import { useAccount, usePublicClient, useSendTransaction } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js'
import {
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token'
import { useSolanaConnectionWithRpcAtom } from 'hooks/solana/useSolanaConnectionWithRpcAtom'
import { ActionButton } from './ActionButton'
import SendTransactionFlow from './SendTransactionFlow'
import { ViewState } from './type'
import { estimateSimpleSolanaFee, getQuickSolanaFeeEstimate } from './utils/solanaTxFeeEstimation'
import { useEnhancedTokenLogo } from './hooks/useEnhancedTokenLogo'
import useSolanaTxError from './hooks/useSolanaTxError'
import { useSolanaPriorityFee } from './hooks/useSolanaPriorityFee'
import { SolanaPriorityFeeModal } from './SolanaPriorityFeeModal'
import { createSolanaSendTransaction, detectWalletTransactionSupport } from './utils/solanaSendTransaction'
import { sendTransactionSafely } from './utils/solanaSafeTransaction'
import { getChainDisplayName } from './utils/getChainDisplayName'

const FormContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const AssetContainer = styled(Box)`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
`

const ChainIconWrapper = styled(Box)`
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: ${({ theme }) => theme.colors.background};
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1;
`

// No longer need these styled components since we're using CurrencyInputPanelSimplify

const AddressInputWrapper = styled(Box)`
  margin-bottom: 4px;
`

const ClearButton = styled(IconButton)`
  width: 20px;
  height: 20px;
`

const CurrencyInputContainer = styled(Box)`
  display: flex;
  align-items: center;
  gap: 16px;
  height: 80px;
  padding: 0 16px;
  background-color: ${({ theme }) => theme.colors.input};
  border: 1px solid ${({ theme }) => theme.colors.inputSecondary};
  border-radius: 24px;
  box-shadow: ${({ theme }) => theme.shadows.inset};
`

const AmountStyledInput = styled.input`
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 24px;
  font-weight: 600;
  text-align: right;
  color: ${({ theme }) => theme.colors.text};
  font-family: inherit;

  ::placeholder {
    color: ${({ theme }) => theme.colors.textSubtle};
  }

  &:focus {
    outline: none;
  }
`

const ErrorMessage = styled(Text)`
  color: ${({ theme }) => theme.colors.failure};
  font-size: 14px;
`

export interface SendAssetFormProps {
  asset: BalanceData
  onViewStateChange: (viewState: ViewState) => void
  viewState: ViewState
}

export const SendAssetForm: React.FC<SendAssetFormProps> = ({ asset, onViewStateChange, viewState }) => {
  const { isSendGift } = useContext(SendGiftContext)
  const isGiftSupported = useMemo(() => CHAINS_WITH_GIFT_CLAIM.includes(asset.chainId), [asset.chainId])
  const isSendGiftSupported = isSendGift && isGiftSupported

  const { t } = useTranslation()
  const [address, setAddress] = useState<string | null>(null)
  const debouncedAddress = useDebounce(address, 300)
  const [amount, setAmount] = useState('')
  const [addressError, setAddressError] = useState('')
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null)
  const [estimatedFeeUsd, setEstimatedFeeUsd] = useState<string | null>(null)
  const [isInputFocus, setIsInputFocus] = useState(false)

  const [txHash, setTxHash] = useState<string | undefined>(undefined)
  const { address: accountAddress } = useAccount()
  const publicClient = usePublicClient({ chainId: asset.chainId })
  const { toastSuccess } = useToast()
  const { fetchWithCatchTxError, loading: attemptingTxn } = useCatchTxError()
  const { executeSolanaTransaction, loading: solanaTxLoading } = useSolanaTxError()
  const { includeStarterGas, nativeAmount, isUserInsufficientBalance } = useSendGiftContext()
  const { getEnhancedLogoURI } = useEnhancedTokenLogo()
  const { computeBudgetConfig, currentFee } = useSolanaPriorityFee()

  // Priority Fee Modal state
  const [showPriorityFeeModal, setShowPriorityFeeModal] = useState(false)

  // Get native currency for fee calculation
  const nativeCurrency = useNativeCurrency(asset.chainId)
  const { data: evmNativeCurrencyPrice } = useCurrencyUsdPrice(nativeCurrency)
  const isSolanaChain = asset.chainId === NonEVMChainId.SOLANA

  // For Solana, use the specialized hook to get SOL price
  const solNativeMint = 'So11111111111111111111111111111111111111112' // Native SOL mint
  const { data: solPrice } = useSolanaTokenPrice({
    mint: isSolanaChain ? solNativeMint : undefined,
    enabled: isSolanaChain,
  })

  // Use the appropriate price based on the chain
  const nativeCurrencyPrice = isSolanaChain ? solPrice : evmNativeCurrencyPrice
  const currency = useMemo(
    () =>
      asset.token.address === zeroAddress
        ? nativeCurrency
        : new WrappedTokenInfo({
            name: asset.token.name,
            symbol: asset.token.symbol,
            decimals: asset.token.decimals,
            address: checksumAddress(asset.token.address as `0x${string}`),
            chainId: asset.chainId,
            logoURI: asset.token.logoURI,
          }),
    [asset, nativeCurrency],
  )

  const tokenBalance = tryParseAmount(asset.quantity, currency)

  const maxAmountInput = useMemo(() => maxAmountSpend(tokenBalance), [tokenBalance])

  // Solana wallet support
  const walletContext = useWallet()
  const { publicKey: solanaPublicKey, wallet } = walletContext
  const connection = useSolanaConnectionWithRpcAtom()

  const isNativeToken = useMemo(() => {
    return isSolanaChain ? asset.token.symbol === 'SOL' : asset.token.address === zeroAddress
  }, [isSolanaChain, asset.token.symbol, asset.token.address])
  const erc20Contract = useERC20(asset.token.address as `0x${string}`, { chainId: asset.chainId })
  const { sendTransactionAsync } = useSendTransaction()

  const estimateTransactionFee = useCallback(async () => {
    if (!address || !amount) return

    try {
      if (isSolanaChain) {
        if (!solanaPublicKey) return

        try {
          // Use new simplified estimation system
          const priorityFeeLamports = Math.floor(currentFee * 1_000_000_000) // Convert SOL to lamports

          const feeBreakdown = await estimateSimpleSolanaFee({
            connection,
            solanaPublicKey,
            recipientAddress: address,
            isNativeToken,
            tokenInfo: isNativeToken
              ? undefined
              : {
                  address: asset.token.address,
                  decimals: asset.token.decimals,
                },
            priorityFeeLamports,
          })

          setEstimatedFee(feeBreakdown.formattedFee)

          if (nativeCurrencyPrice) {
            const feeUsd = parseFloat(feeBreakdown.formattedFee) * nativeCurrencyPrice
            setEstimatedFeeUsd(feeUsd.toFixed(6))
          } else {
            setEstimatedFeeUsd(null)
          }
        } catch (error) {
          console.error('Error estimating Solana fee:', error)

          // Use quick fallback estimation
          const priorityFeeLamports = Math.floor(currentFee * 1_000_000_000)
          const formattedFee = getQuickSolanaFeeEstimate(priorityFeeLamports, !isNativeToken)
          setEstimatedFee(formattedFee)

          if (nativeCurrencyPrice) {
            const feeUsd = parseFloat(formattedFee) * nativeCurrencyPrice
            setEstimatedFeeUsd(feeUsd.toFixed(2))
          } else {
            setEstimatedFeeUsd(null)
          }
        }
      } else {
        // EVM fee estimation (original logic)
        if (!publicClient || !accountAddress) return

        let gasEstimate: bigint = 0n

        if (isNativeToken) {
          // For native token, estimate gas for a simple transfer
          gasEstimate =
            (await publicClient.estimateGas({
              account: accountAddress,
              to: address as `0x${string}`,
              value: tryParseAmount(amount, currency)?.quotient ?? 0n,
            })) ?? 0n
        } else {
          // For ERC20 tokens, estimate gas for a transfer call
          const transferData = {
            to: address as `0x${string}`,
            amount: tryParseAmount(amount, currency)?.quotient ?? 0n,
          }
          gasEstimate =
            (await erc20Contract?.estimateGas?.transfer([transferData.to, transferData.amount], {
              account: erc20Contract.account!,
            })) ?? 0n
        }

        // Get gas price
        const gasPrice = await publicClient.getGasPrice()

        // Calculate fee
        const fee = gasEstimate * gasPrice

        // Convert to readable format (in native token units)
        const formattedFee = formatUnits(fee, 18)

        setEstimatedFee(formattedFee)

        // Calculate USD value if price is available
        if (nativeCurrencyPrice) {
          const feeUsd = parseFloat(formattedFee) * nativeCurrencyPrice
          setEstimatedFeeUsd(feeUsd.toFixed(2))
        } else {
          setEstimatedFeeUsd(null)
        }
      }
    } catch (error) {
      console.error('Error estimating fee:', error)
      setEstimatedFee(null)
      setEstimatedFeeUsd(null)
    }
  }, [
    address,
    amount,
    publicClient,
    accountAddress,
    isNativeToken,
    currency,
    nativeCurrencyPrice,
    erc20Contract,
    isSolanaChain,
    solanaPublicKey,
    asset.token.address,
    asset.token.decimals,
    connection,
    currentFee,
  ])

  // Separate function for EVM asset transfer
  const sendEVMAsset = useCallback(async () => {
    const amounts = tryParseAmount(amount, currency)

    const receipt = await fetchWithCatchTxError(async () => {
      if (isNativeToken) {
        return sendTransactionAsync({
          to: address as `0x${string}`,
          value: amounts?.quotient ?? 0n,
          chainId: asset.chainId,
        })
      }
      return erc20Contract?.write?.transfer([address as `0x${string}`, amounts?.quotient ?? 0n], {
        account: erc20Contract.account!,
        chain: erc20Contract.chain!,
      })
    })

    if (receipt?.status) {
      setTxHash(receipt.transactionHash)
      toastSuccess(
        `${t('Transaction Submitted')}!`,
        <ToastDescriptionWithTx txHash={receipt.transactionHash}>
          {t('Your %symbol% has been sent to %address%', {
            symbol: currency?.symbol,
            address: `${address?.slice(0, 8)}...${address?.slice(-8)}`,
          })}
        </ToastDescriptionWithTx>,
      )
      setAmount('')
      setAddress('')
    }

    return receipt
  }, [
    address,
    amount,
    currency,
    isNativeToken,
    sendTransactionAsync,
    asset.chainId,
    erc20Contract,
    fetchWithCatchTxError,
    t,
    toastSuccess,
  ])

  // Separate function for Solana asset transfer
  const sendSolanaAsset = useCallback(async () => {
    if (!solanaPublicKey || !address) return undefined

    const recipientPubkey = new PublicKey(address)

    const receipt = await executeSolanaTransaction(async () => {
      // Check balance before sending
      const balance = await connection.getBalance(solanaPublicKey)
      const requiredAmount = isNativeToken
        ? Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL) + 5000 // amount + transaction fee
        : 5000 // just transaction fee for token transfers

      if (balance < requiredAmount) {
        throw new Error(t('Insufficient SOL balance to complete transaction'))
      }
      // Detect wallet transaction support
      const walletSupportsV0 = detectWalletTransactionSupport(wallet)

      let signature: string

      if (isNativeToken) {
        // Create transaction using helper
        const transaction = await createSolanaSendTransaction({
          connection,
          fromPubkey: solanaPublicKey,
          toPubkey: recipientPubkey,
          amount: parseFloat(amount),
          isNativeToken: true,
          computeBudgetConfig,
          walletSupportsV0,
        })

        signature = await sendTransactionSafely(transaction, connection, walletContext)
      } else {
        const tokenMintAddress = new PublicKey(asset.token.address)
        const amountInTokenUnits = Math.floor(parseFloat(amount) * 10 ** asset.token.decimals)

        // First, detect which token program this mint uses
        let tokenProgramId = TOKEN_PROGRAM_ID
        try {
          const mintInfo = await connection.getAccountInfo(tokenMintAddress)
          if (mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
            tokenProgramId = TOKEN_2022_PROGRAM_ID
          }
        } catch (error) {
          console.error('Failed to detect token program, using default:', error)
        }

        const senderTokenAccount = await getAssociatedTokenAddress(
          tokenMintAddress,
          solanaPublicKey,
          false,
          tokenProgramId,
        )
        const recipientTokenAccount = await getAssociatedTokenAddress(
          tokenMintAddress,
          recipientPubkey,
          false,
          tokenProgramId,
        )

        const transaction = new Transaction()

        // Get recent blockhash for legacy transaction
        const { blockhash } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = solanaPublicKey

        // Add Compute Budget instructions (Priority Fee)
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: computeBudgetConfig.units }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computeBudgetConfig.microLamports }),
        )

        // Check if recipient's associated token account exists
        try {
          await getAccount(connection, recipientTokenAccount, 'confirmed', tokenProgramId)
        } catch (error: any) {
          if (error.name === 'TokenAccountNotFoundError') {
            // Create associated token account for recipient
            transaction.add(
              createAssociatedTokenAccountInstruction(
                solanaPublicKey, // payer
                recipientTokenAccount, // associated token account
                recipientPubkey, // owner
                tokenMintAddress, // mint
                tokenProgramId, // token program ID
              ),
            )
          } else {
            throw error
          }
        }

        // Add transfer instruction using the appropriate program
        if (tokenProgramId.equals(TOKEN_2022_PROGRAM_ID)) {
          transaction.add(
            createTransferCheckedInstruction(
              senderTokenAccount,
              tokenMintAddress,
              recipientTokenAccount,
              solanaPublicKey,
              amountInTokenUnits,
              asset.token.decimals,
              [],
              tokenProgramId,
            ),
          )
        } else {
          transaction.add(
            createTransferInstruction(
              senderTokenAccount,
              recipientTokenAccount,
              solanaPublicKey,
              amountInTokenUnits,
              [],
              tokenProgramId,
            ),
          )
        }

        signature = await sendTransactionSafely(transaction, connection, walletContext)
      }

      // Wait for transaction confirmation using the modern approach
      try {
        const latestBlockhash = await connection.getLatestBlockhash()
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed',
        )

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`)
        }
      } catch (confirmError) {
        console.error('Transaction confirmation failed:', confirmError)
        throw new Error(`Transaction confirmation failed: ${confirmError}`)
      }

      // Update UI state on success
      setTxHash(signature)

      // Show success confirmation toast with token details
      toastSuccess(
        `${t('Transaction Confirmed')}!`,
        <SolanaDescriptionWithTx txHash={signature}>
          {t('Your %symbol% has been sent to %address%', {
            symbol: asset.token.symbol,
            address: `${address?.slice(0, 8)}...${address?.slice(-8)}`,
          })}
        </SolanaDescriptionWithTx>,
      )

      setAmount('')
      setAddress('')

      // Return transaction result for executeSolanaTransaction
      return { hash: signature, status: 1 }
    })

    return receipt
  }, [
    solanaPublicKey,
    address,
    amount,
    isNativeToken,
    asset.token,
    walletContext,
    connection,
    computeBudgetConfig,
    executeSolanaTransaction,
    toastSuccess,
    t,
    wallet,
  ])

  // Main sendAsset function that routes to appropriate handler
  const sendAsset = useCallback(
    async (asset: BalanceData) => {
      if (asset.chainId === NonEVMChainId.SOLANA) {
        return sendSolanaAsset()
      }
      return sendEVMAsset()
    },
    [sendSolanaAsset, sendEVMAsset],
  )

  const isLikelyWalletAddress = (input: string) => {
    try {
      const pk = new PublicKey(input)
      if (pk.toBase58() !== input) return { ok: false, reason: 'Base58 format inconsistent' }
      if (!PublicKey.isOnCurve(pk.toBytes())) {
        return { ok: false, reason: 'This looks like a PDA/program address (off-curve)' }
      }
      return { ok: true, pubkey: pk }
    } catch {
      return { ok: false, reason: 'Invalid Solana public key' }
    }
  }

  const isEOASystemAccount = async (connection: Connection, pk: PublicKey) => {
    const info = await connection.getAccountInfo(pk)
    if (!info) return { ok: true }
    if (!info.owner.equals(SystemProgram.programId)) {
      return { ok: false, reason: 'This address is a program account (not a System account)' }
    }
    return { ok: true }
  }

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    setAddress(value)
  }

  // Frontend immediate validation (no RPC): check non-base58, wrong key length, off-curve (PDA)
  // Optional RPC enhancement: existing accounts must be SystemProgram to be considered regular wallets
  useEffect(() => {
    console.info('Address validation triggered:', { debouncedAddress, isSolanaChain })

    const validateAddress = async () => {
      if (!debouncedAddress) {
        setAddressError('')
        return
      }

      if (isSolanaChain) {
        const frontendCheck = isLikelyWalletAddress(debouncedAddress)
        if (!frontendCheck.ok) {
          setAddressError(t('Invalid wallet address') || 'Invalid Solana wallet address')
          return
        }

        try {
          const rpcCheck = await isEOASystemAccount(connection, frontendCheck.pubkey!)
          if (!rpcCheck.ok) {
            setAddressError(t('Invalid wallet address') || 'Invalid Solana wallet address')
            return
          }
        } catch (error) {
          console.error('RPC validation error (continuing):', error)
        }

        setAddressError('')
      } else if (!isAddress(debouncedAddress)) {
        // Validate EVM address
        setAddressError(t('Invalid wallet address'))
      } else {
        setAddressError('')
      }
    }

    validateAddress()
  }, [debouncedAddress, t, isSolanaChain, connection])

  const handleClearAddress = () => {
    setAddress('')
    setAddressError('')
  }

  const handleAmountChange = useCallback((value: string) => {
    setAmount(value)
  }, [])

  const handleUserInputBlur = useCallback(() => {
    setTimeout(() => setIsInputFocus(false), 300)
  }, [])

  const handlePercentInput = useCallback(
    (percent: number) => {
      if (maxAmountInput) {
        handleAmountChange(maxAmountInput.multiply(new Percent(percent, 100)).toExact())
      }
    },
    [maxAmountInput, handleAmountChange],
  )

  const handleMaxInput = useCallback(() => {
    handlePercentInput(100)
  }, [handlePercentInput])

  const isInsufficientBalance = useUserInsufficientBalanceLight(currency, tokenBalance, amount)

  const chainName = getChainDisplayName(asset.chainId)
  const price = asset.price?.usd ?? 0
  const tokenAmount = tryParseAmount(amount, currency)

  // if gift, tokenAmount must be greater than $1
  const isGiftTokenAmountValid = useMemo(() => {
    if (isSendGiftSupported && amount && !isInsufficientBalance) {
      const valueInUsd = parseFloat(amount) * price
      // NOTE: user can only send gift with amount greater than $1
      const LIMIT_AMOUNT_USD = 1

      // if value is 0, user is not inputting any amount, so make it valid
      // avoid showing error message when user is not inputting any amount
      return valueInUsd === 0 || valueInUsd >= LIMIT_AMOUNT_USD
    }

    return true
  }, [isSendGiftSupported, amount, isInsufficientBalance, price])

  // Effect to estimate fee when address and amount are valid
  useEffect(() => {
    if (address && amount && !addressError) {
      estimateTransactionFee()
    } else {
      setEstimatedFee(null)
    }
  }, [address, amount, addressError, estimateTransactionFee, currentFee])

  const isValidAddress = useMemo(() => {
    // send gift doesn't need to check address
    return isSendGiftSupported ? true : address && !addressError
  }, [address, addressError, isSendGiftSupported])

  const isValidGasSponsor = useMemo(() => {
    // For Solana, gas sponsoring might not be applicable
    if (isSolanaChain) {
      return true
    }
    return includeStarterGas && isSendGiftSupported ? nativeAmount?.greaterThan(0) && !isUserInsufficientBalance : true
  }, [includeStarterGas, isSendGiftSupported, nativeAmount, isUserInsufficientBalance, isSolanaChain])

  if (viewState === ViewState.CONFIRM_TRANSACTION && isSendGiftSupported) {
    return <CreateGiftView key={viewState} tokenAmount={tokenAmount} />
  }

  if (viewState >= ViewState.CONFIRM_TRANSACTION) {
    return (
      <SendTransactionFlow
        asset={asset}
        amount={amount}
        recipient={address as string}
        onDismiss={() => {
          onViewStateChange(ViewState.SEND_ASSETS)
          setTxHash(undefined)
        }}
        attemptingTxn={isSolanaChain ? solanaTxLoading : attemptingTxn}
        txHash={txHash}
        chainId={asset.chainId}
        estimatedFee={estimatedFee}
        estimatedFeeUsd={estimatedFeeUsd}
        onConfirm={async () => {
          try {
            // Submit the transaction using the improved error handling
            const receipt = await sendAsset(asset)
            if (receipt?.status) {
              onViewStateChange(ViewState.SEND_ASSETS)
            }
          } catch (error: any) {
            console.error('Transaction failed:', error)
            // Error handling is done by the executeSolanaTransaction hook
          }
        }}
      />
    )
  }
  return (
    <FormContainer>
      <SendGiftToggle isNativeToken={isNativeToken} tokenChainId={asset.chainId}>
        {(isSendGiftOn) => (
          <>
            {isSendGiftOn ? null : (
              <Box>
                <AddressInputWrapper>
                  <Box position="relative">
                    <Input
                      value={address ?? ''}
                      onChange={handleAddressChange}
                      placeholder="Recipient address"
                      style={{ height: '64px' }}
                      isError={Boolean(addressError)}
                    />
                    {address && (
                      <ClearButton
                        scale="sm"
                        onClick={handleClearAddress}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}
                        variant="tertiary"
                      >
                        <CloseIcon color="textSubtle" />
                      </ClearButton>
                    )}
                  </Box>
                </AddressInputWrapper>
                {addressError && <ErrorMessage>{addressError}</ErrorMessage>}
              </Box>
            )}

            <Box>
              <Flex justifyContent="flex-end" position="relative" height="18px" mb="8px">
                <LazyAnimatePresence mode="wait" features={domAnimation}>
                  {tokenBalance ? (
                    !isInputFocus ? (
                      <SwapUIV2.WalletAssetDisplay
                        isUserInsufficientBalance={isInsufficientBalance}
                        balance={tokenBalance.toSignificant(6)}
                        onMax={handleMaxInput}
                      />
                    ) : (
                      <SwapUIV2.AssetSettingButtonList onPercentInput={handlePercentInput} />
                    )
                  ) : null}
                </LazyAnimatePresence>
              </Flex>

              <CurrencyInputContainer>
                <FlexGap alignItems="center" gap="8px" flexShrink={0} pl="4px">
                  <AssetContainer>
                    <CurrencyLogo
                      currency={currency}
                      size="40px"
                      src={getEnhancedLogoURI(asset.token.address, asset.chainId, asset.token.logoURI)}
                    />
                    <ChainIconWrapper>
                      <img
                        src={`${ASSET_CDN}/web/chains/${asset.chainId}.png`}
                        alt={`${chainName}-logo`}
                        width="12px"
                        height="12px"
                      />
                    </ChainIconWrapper>
                  </AssetContainer>
                  <FlexGap flexDirection="column">
                    <Text fontWeight="bold" fontSize="20px" lineHeight="1.2">
                      {asset.token.symbol}
                    </Text>
                    <Text color="textSubtle" fontSize="12px" lineHeight="1.2">
                      {chainName}
                    </Text>
                  </FlexGap>
                </FlexGap>
                <AmountStyledInput
                  pattern={`^[0-9]*[.,]?[0-9]{0,${currency?.decimals ?? 18}}$`}
                  inputMode="decimal"
                  min="0"
                  value={amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.currentTarget.validity.valid) {
                      handleAmountChange(e.currentTarget.value.replace(/,/g, '.'))
                    }
                  }}
                  onFocus={() => setIsInputFocus(true)}
                  onBlur={handleUserInputBlur}
                  placeholder="0.0"
                />
              </CurrencyInputContainer>

              {amount && parseFloat(amount) > 0 && (
                <Text fontSize="12px" textAlign="right" color="textSubtle" mt="4px">
                  {`~${(parseFloat(amount) * price).toFixed(2)} USD`}
                </Text>
              )}
              {isInsufficientBalance && amount && (
                <Text color="failure" fontSize="14px" mt="8px">
                  {t('Insufficient balance')}
                </Text>
              )}

              {!isGiftTokenAmountValid && (
                <Text color="failure" fontSize="14px" mt="8px">
                  {t('Gift amount must be greater than $1')}
                </Text>
              )}
            </Box>
          </>
        )}
      </SendGiftToggle>

      <FlexGap gap="16px" mt="16px">
        <ActionButton onClick={() => onViewStateChange(ViewState.SEND_ASSETS)} variant="tertiary">
          {t('Close')}
        </ActionButton>
        <Button
          id="send-gift-confirm-button"
          width="100%"
          onClick={() => {
            if (isSendGiftSupported) {
              logGTMGiftPreviewEvent(asset.chainId)
            }
            onViewStateChange(ViewState.CONFIRM_TRANSACTION)
          }}
          disabled={
            !isValidAddress ||
            !amount ||
            parseFloat(amount) === 0 ||
            isInsufficientBalance ||
            attemptingTxn ||
            !isValidGasSponsor ||
            !isGiftTokenAmountValid
          }
          isLoading={attemptingTxn}
          endIcon={attemptingTxn ? <AutoRenewIcon spin color="currentColor" /> : undefined}
        >
          {attemptingTxn ? t('Confirming') : t('Next.step')}
        </Button>
      </FlexGap>

      {/* Priority Fee Modal */}
      <SolanaPriorityFeeModal
        isOpen={showPriorityFeeModal}
        onDismiss={() => setShowPriorityFeeModal(false)}
        onSave={(_fee) => {
          // Fee updates will automatically trigger estimateTransactionFee re-estimation
        }}
      />
    </FormContainer>
  )
}
