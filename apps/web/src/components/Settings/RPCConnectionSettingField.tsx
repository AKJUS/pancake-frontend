import { useState, KeyboardEvent, useEffect, useCallback } from 'react'
import { Button, Flex, FlexGap, Input, QuestionHelper, Spinner, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useAtom, useAtomValue } from 'jotai'
import { isValidUrl, isCustomRpcAtom, rpcUrlAtom, validateRpcEndpoint, rpcs } from '@pancakeswap/utils/user'

export function RPCConnectionSettingField() {
  const { t } = useTranslation()
  const isCurrentCustom = useAtomValue(isCustomRpcAtom)
  const [rpcNodeUrl, setRpcNodeUrl] = useAtom(rpcUrlAtom)
  const [isLoading, setLoading] = useState(false)
  const [isCustom, setCustom] = useState(false)
  const [customUrl, setCustomUrl] = useState(isCurrentCustom ? rpcNodeUrl || 'https://' : 'https://')

  useEffect(() => {
    if (isCurrentCustom) {
      setCustom(true)
      setCustomUrl(rpcNodeUrl)
    }
  }, [isCurrentCustom, rpcNodeUrl])

  const handleSwitchRpc = useCallback(
    (customUrl: string) => {
      if (!isValidUrl(customUrl)) return
      setLoading(true)
      setRpcNodeUrl(customUrl)
      validateRpcEndpoint(customUrl)
      setLoading(false)
    },
    [setRpcNodeUrl],
  )

  return (
    <Flex flexDirection="column">
      <Flex mb="12px">
        <Text>{t('RPC Connection')}</Text>
        <QuestionHelper text={t('Select preferred RPC endpoint')} placement="top" ml="4px" />
      </Flex>
      <FlexGap flexWrap="wrap" gap="16px">
        {rpcs.map((rpc) => (
          <Button
            key={rpc.name}
            variant={rpcNodeUrl === rpc.url && !isCustom ? 'primary' : 'tertiary'}
            scale="sm"
            onClick={() => {
              setCustom(false)
              if (rpcNodeUrl !== rpc.url) handleSwitchRpc(rpc.url)
            }}
          >
            {rpc.name}
          </Button>
        ))}
        <Button
          key="Custom"
          variant={isCurrentCustom || isCustom ? 'primary' : 'tertiary'}
          scale="sm"
          onClick={() => {
            setCustom(true)
            handleSwitchRpc(customUrl)
          }}
        >
          {t('Custom')}
        </Button>
      </FlexGap>
      <Flex mt="16px">
        <Input
          width="full"
          placeholder="https://"
          py="4px"
          px="12px"
          title={!isCustom ? rpcNodeUrl : undefined}
          disabled={!isCustom || isLoading}
          value={!isCustom ? rpcNodeUrl : customUrl}
          onBlur={() => handleSwitchRpc(customUrl)}
          onChange={({ currentTarget: { value } }) => {
            const customUrl = value.replace(/^(https?:\/\/)?(https?:\/\/)/, '$2')
            setCustomUrl(customUrl)
          }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            const { key } = event
            if (key === 'Enter') handleSwitchRpc(customUrl)
          }}
        />
        {isLoading ? <Spinner /> : null}
      </Flex>
    </Flex>
  )
}
