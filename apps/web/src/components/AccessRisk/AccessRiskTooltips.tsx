import { ChainId } from '@pancakeswap/chains'
import { useTranslation, Trans } from '@pancakeswap/localization'
import { Flex, Link, Text } from '@pancakeswap/uikit'
import { TOKEN_RISK } from 'components/AccessRisk'

interface AccessRiskTooltipsProps {
  riskLevel?: number
  hasResult?: boolean
  tokenAddress?: string
  tokenChain?: ChainId
  riskLevelDescription?: string
}

const AccessRiskTooltips: React.FC<AccessRiskTooltipsProps> = ({
  riskLevel,
  hasResult,
  riskLevelDescription,
  tokenAddress,
  tokenChain,
}) => {
  const { t } = useTranslation()

  if (riskLevel === TOKEN_RISK.UNKNOWN || !hasResult) {
    return (
      <>
        <Text my="8px">
          {t(
            'Risk scanning is still in progress. It may take up to 5 minutes to fully scan a token which is new to the database.',
          )}
        </Text>
        <Trans
          i18nKey="Provided by <0>HashDit</0>"
          components={[<Link style={{ display: 'inline' }} ml="4px" external href="https://www.hashdit.io" />]}
        />
        <Flex mt="4px">
          <Trans
            i18nKey="Learn more about risk rating <0>here.</0>"
            components={[
              <Link ml="4px" external href="https://hashdit.github.io/hashdit/docs/risk-level-description" />,
            ]}
          />
        </Flex>
      </>
    )
  }

  if (hasResult && riskLevel && riskLevel >= TOKEN_RISK.VERY_LOW && tokenAddress) {
    return (
      <>
        <Text my="8px">{riskLevelDescription}</Text>
        <Trans
          i18nKey="Risk scan results are provided by a third party, <0>HashDit</0>"
          components={[<Link style={{ display: 'inline' }} ml="4px" external href="https://www.hashdit.io" />]}
        />
        {tokenChain === ChainId.BSC && (
          <Flex mt="4px">
            <Trans
              i18nKey="Get more details from <0>RedAlarm</0>"
              components={[
                <Link ml="4px" external href={`https://dappbay.bnbchain.org/risk-scanner/${tokenAddress}`} />,
              ]}
            />
          </Flex>
        )}
      </>
    )
  }

  return (
    <>
      <Text my="8px">
        {t(
          'Automatic risk scanning for the selected token. This scanning result is for reference only, and should NOT be taken as investment advice.',
        )}
      </Text>
      <Trans
        i18nKey="Provided by <0>HashDit</0>"
        components={[<Link style={{ display: 'inline' }} ml="4px" external href="https://www.hashdit.io" />]}
      />
      <Link mt="4px" external href="https://hashdit.github.io/hashdit/docs/risk-level-description">
        {t('Learn More')}
      </Link>
    </>
  )
}

export default AccessRiskTooltips
