import { TOKEN_RISK } from 'components/AccessRisk'
import AccessRiskTooltips from 'components/AccessRisk/AccessRiskTooltips'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useTheme from 'hooks/useTheme'
import { useSubgraphHealthIndicatorManager, useUserUsernameVisibility } from 'state/user/hooks'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'
import { useUserTokenRisk } from 'state/user/hooks/useUserTokenRisk'
import { ChainId } from '@pancakeswap/chains'
import { languageList, useTranslation } from '@pancakeswap/localization'
import { Flex, LangSelectorV2, QuestionHelper, Text, ThemeSwitcher, Toggle } from '@pancakeswap/uikit'

type GlobalSettingsTabProps = {
  /** Tighter spacing for navbar hover panel */
  compact?: boolean
}

export const GlobalSettingsTab: React.FC<GlobalSettingsTabProps> = ({ compact }) => {
  const { currentLanguage, setLanguage, t } = useTranslation()

  const { isDark, setTheme } = useTheme()
  const { chainId } = useActiveChainId()
  const rowMb = compact ? '16px' : '24px'

  // Global-specific state
  const [subgraphHealth, setSubgraphHealth] = useSubgraphHealthIndicatorManager()
  const [userUsernameVisibility, setUserUsernameVisibility] = useUserUsernameVisibility()
  const [showTestnet, setShowTestnet] = useUserShowTestnet()
  const [tokenRisk, setTokenRisk] = useUserTokenRisk()

  const labelProps = compact ? { fontSize: '14px' as const, bold: true as const } : {}

  return (
    <Flex pb={compact ? '8px' : '24px'} flexDirection="column">
      <Flex justifyContent="space-between" mb={rowMb} alignItems="center">
        <Text {...labelProps}>{t('Language')}</Text>
        <LangSelectorV2 currentLang={currentLanguage.code} langs={languageList} setLang={setLanguage} />
      </Flex>

      <Flex justifyContent="space-between" mb={rowMb} alignItems="center">
        <Text {...labelProps}>{t('Dark mode')}</Text>
        <ThemeSwitcher isDark={isDark} toggleTheme={() => setTheme(isDark ? 'light' : 'dark')} />
      </Flex>

      <Flex justifyContent="space-between" alignItems="center" mb={rowMb}>
        <Flex alignItems="center">
          <Text {...labelProps}>{t('Show username')}</Text>
          <QuestionHelper text={t('Shows username of wallet instead of bunnies')} placement="top" ml="4px" />
        </Flex>
        <Toggle
          id="toggle-username-visibility"
          checked={userUsernameVisibility}
          scale="md"
          onChange={() => {
            setUserUsernameVisibility(!userUsernameVisibility)
          }}
        />
      </Flex>

      <Flex justifyContent="space-between" alignItems="center" mb={rowMb}>
        <Flex alignItems="center">
          <Text {...labelProps}>{t('Show testnet')}</Text>
        </Flex>
        <Toggle
          id="toggle-show-testnet"
          checked={showTestnet}
          scale="md"
          onChange={() => {
            setShowTestnet((s) => !s)
          }}
        />
      </Flex>

      <Flex justifyContent="space-between" alignItems="center" mb={rowMb}>
        <Flex alignItems="center">
          <Text {...labelProps}>{t('Subgraph Health Indicator')}</Text>
          <QuestionHelper
            text={t(
              'Turn on subgraph health indicator all the time. Default is to show the indicator only when the network is delayed',
            )}
            placement="top"
            ml="4px"
          />
        </Flex>
        <Toggle
          id="toggle-subgraph-health-button"
          checked={subgraphHealth}
          scale="md"
          onChange={() => {
            setSubgraphHealth(!subgraphHealth)
          }}
        />
      </Flex>

      {chainId === ChainId.BSC && (
        <>
          <Flex justifyContent="space-between" alignItems="center" mb={rowMb}>
            <Flex alignItems="center">
              <Text {...labelProps}>{t('Token Risk Scanning')}</Text>
              <QuestionHelper
                text={
                  <AccessRiskTooltips
                    hasResult
                    riskLevel={TOKEN_RISK.SOME_RISK}
                    riskLevelDescription={t(
                      'Automatic risk scanning for the selected token. This scanning result is for reference only, and should NOT be taken as investment advice.',
                    )}
                  />
                }
                placement="top"
                ml="4px"
              />
            </Flex>
            <Toggle
              id="toggle-token-risk"
              checked={tokenRisk}
              scale="md"
              onChange={() => {
                setTokenRisk(!tokenRisk)
              }}
            />
          </Flex>
        </>
      )}
    </Flex>
  )
}
