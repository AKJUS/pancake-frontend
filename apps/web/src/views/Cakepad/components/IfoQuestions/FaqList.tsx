import { Trans, useTranslation } from '@pancakeswap/localization'
import {
  Card,
  CardBody,
  CardHeader,
  Heading,
  Container,
  Link,
  Text,
  Box,
  useMatchBreakpoints,
  ReactMarkdown,
} from '@pancakeswap/uikit'
import { styled } from 'styled-components'
import FoldableText from 'components/FoldableSection/FoldableText'
import { safeGetAddress } from 'utils'
import { AnchorHTMLAttributes, ReactNode, useMemo } from 'react'
import useIfo from '../../hooks/useIfo'
import { IFOFAQs } from '../../ifov2.types'

const StyledCardHeader = styled(CardHeader)`
  background: ${({ theme }) =>
    theme.isDark
      ? 'linear-gradient(112deg, #1a1a2e 0%, #16213e 100%)'
      : 'linear-gradient(112deg, #F2ECF2 0%, #E8F2F6 100%)'};
  padding: 24px;
`

const StyledHeading = styled(Heading)`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: 24px;
  font-weight: 600;
`

const InlineLink = styled(Link)`
  display: inline-block;
`
interface FAQ {
  title: ReactNode
  description: ReactNode
}

const FaqList: React.FC<{ ifoFaqs?: IFOFAQs }> = ({ ifoFaqs }) => {
  const { pools: pools_, config } = useIfo()
  const { isMobile } = useMatchBreakpoints()
  const { t } = useTranslation()

  const pools = useMemo(
    () => (config.contractAddress && safeGetAddress(config.contractAddress) ? pools_ : config.presetData?.pools ?? []),
    [pools_, config.presetData],
  )

  const stakeSymbols = useMemo(
    () => pools?.map((pool) => pool.stakeCurrency?.symbol).filter(Boolean) as string[],
    [pools],
  )

  const symbol =
    stakeSymbols.length === 1
      ? `$${stakeSymbols[0]}`
      : stakeSymbols.length >= 2
      ? `$${stakeSymbols[0]} or $${stakeSymbols[1]}`
      : '$CAKE'

  const defaultFaqs = useMemo(
    () => [
      {
        title: <Trans>What is a CAKE.PAD Event?</Trans>,
        description: (
          <>
            <Trans>Evolved from our IFO (Initial Farm Offering), CAKE.PAD is a platform to launch new tokens.</Trans>
            <p>
              <Trans
                i18nTemplate="Users can buy project tokens using <0>%symbol%</0>, while projects gain liquidity, visibility, and direct access to our community."
                values={{ symbol }}
                components={[<Text as="span" bold key="symbol" />]}
              />
            </p>
            <br />
            <Trans
              components={[
                <InlineLink key="user" external href="https://docs.pancakeswap.finance/earn/cakepad/faq-users" />,
                <InlineLink key="partner" external href="https://docs.pancakeswap.finance/earn/cakepad/faq-partners" />,
              ]}
              i18nTemplate="More details: <br /><0>User FAQ</0> | <1>Partner FAQ</1>"
            />
          </>
        ),
      },
      {
        title: <Trans>What's new in this CAKE.PAD?</Trans>,
        description: (
          <>
            <ul>
              <li>
                <Trans
                  i18nTemplate="<0>Participation only requires %symbol%</0> - no staking or NFT profile needed."
                  values={{ symbol }}
                  components={[<Text as="span" bold key="symbol" />]}
                />
              </li>
              <li>
                <Trans
                  i18nTemplate="<0>Tiered fee structure</0> replaces flat fees - fees only apply if oversubscribed."
                  components={[<Text as="span" bold key="fees" />]}
                />
              </li>
              <li>
                <Text as="span" bold>
                  <Trans>iCAKE / veCAKE not used.</Trans>
                </Text>
              </li>
            </ul>

            <br />
            <Trans
              components={[
                <InlineLink
                  key="tokenomics"
                  external
                  href="https://pancakeswap.finance/voting/proposal/0x79ef496c9737e48d9677a6e291ff2a549dee6729c9996398e453af8ecbf0ceb3"
                />,
                <InlineLink key="guide" external href="https://docs.pancakeswap.finance/earn/cakepad/cakepad-guide" />,
              ]}
              i18nTemplate="Reference: <0>Tokenomics 3.0</0> and <1>User Guide</1>"
            />
          </>
        ),
      },
      {
        title: <Trans>How can I participate?</Trans>,
        description: (
          <>
            <ol>
              <li>
                <Text as="span" bold>
                  <Trans i18nTemplate="Get %symbol%" values={{ symbol }} />
                </Text>
              </li>
              <li>
                <Trans
                  i18nTemplate="<0>Commit %symbol%</0> during the CAKE.PAD event via the CAKE.PAD page."
                  values={{ symbol }}
                  components={[<Text as="span" bold key="symbol" />]}
                />
              </li>
              <li>
                <Trans
                  i18nTemplate="<0>Claim your tokens</0> after the CAKE.PAD event ends."
                  values={{ symbol }}
                  components={[<Text as="span" bold key="symbol" />]}
                />
              </li>
            </ol>

            <Box mt="1rem">
              <Trans
                components={[
                  <InlineLink external href="https://docs.pancakeswap.finance/earn/cakepad/cakepad-guide" />,
                ]}
                i18nTemplate="More info: <0>User Guide</0>"
              />
            </Box>
          </>
        ),
      },
      {
        title: <Trans>Are there participation fees?</Trans>,
        description: (
          <>
            <ul>
              <li>
                <Text as="span" bold>
                  <Trans>Only if the CAKE.PAD is oversubscribed</Trans>
                </Text>
                .
              </li>
              <li>
                <Trans
                  i18nTemplate="Fee is applied to <0>excess %symbol%</0> that didn't contribute to your allocation."
                  values={{ symbol }}
                  components={[<Text as="span" bold key="symbol" />]}
                />
              </li>
              <li>
                <Trans
                  i18nTemplate="Tiered from <0>1% down to 0.05%</0> depending on oversubscription."
                  components={[<Text as="span" bold key="fees" />]}
                />
              </li>
            </ul>

            <Box mt="1rem">
              <Trans
                components={[
                  <InlineLink
                    external
                    href="https://docs.pancakeswap.finance/earn/cakepad/how-cake.pad-taxes-work-in-overflow-sales-with-example"
                  />,
                ]}
                i18nTemplate="Reference: <0>Fee Table</0>"
              />
            </Box>
          </>
        ),
      },
      {
        title: <Trans>Where does the participation fee go?</Trans>,
        description: (
          <>
            <ul>
              <li>
                <Trans
                  i18nTemplate="<0>100% of fees are burned</0> as $CAKE."
                  components={[<Text as="span" bold key="symbol" />]}
                />
              </li>
              <li>
                <Text as="span" bold>
                  <Trans>The CAKE.PAD project receives 100% of the target raise</Trans>
                </Text>
                .
              </li>
            </ul>
          </>
        ),
      },
      {
        title: <Trans>How many tokens will I get?</Trans>,
        description: (
          <>
            <Text as="span" bold>
              <Trans>Allocation Rules:</Trans>{' '}
            </Text>
            <Trans>
              Based on an allocation % based on your committed {symbol} vs total {symbol} committed by all users.
            </Trans>
            <Box mt="1rem">
              <Text as="span" bold>
                <Trans>Overflow Sale:</Trans>
              </Text>
            </Box>
            <ul>
              <li>
                <Trans>Users get proportional allocation.</Trans>
              </li>
              <li>
                <Trans
                  i18nTemplate="Any excess %symbol% is refunded (minus participation tax if oversubscribed)."
                  values={{ symbol }}
                />
              </li>
            </ul>
            <Box mt="1rem">
              <Trans
                components={[
                  <InlineLink
                    external
                    href="https://docs.pancakeswap.finance/earn/cakepad/how-cake.pad-taxes-work-in-overflow-sales-with-example"
                  />,
                ]}
                i18nTemplate="Reference: <0>Overflow & Allocation Example</0>"
              />
            </Box>
          </>
        ),
      },
      {
        title: <Trans>Are there token vesting schedules?</Trans>,
        description: (
          <ul>
            <li>
              <Trans
                i18nTemplate="Supported but <0>current CAKE.PAD events run without lockup.</0>"
                components={[<Text as="span" bold key="symbol" />]}
              />
            </li>
            <li>
              <Trans>If vesting applies, it will be shown on the CAKE.PAD page with a schedule.</Trans>
            </li>
          </ul>
        ),
      },
      {
        title: <Trans>[Partners] How do I apply for an CAKE.PAD Event?</Trans>,
        description: (
          <>
            <Trans
              components={[
                <InlineLink
                  external
                  href="https://docs.google.com/forms/d/e/1FAIpQLScmZu87SG41J_eGfzlbyJ_olFohlGOXfOJer04Dr1yCEJy2NA/viewform"
                />,
              ]}
              i18nTemplate="Fill out the <0>Application Form</0>"
            />
            <br />
            <p>
              <Trans>Steps after application:</Trans>
            </p>
            <ol>
              <li>
                <Trans>PancakeSwap team reviews and may conduct further due diligence.</Trans>
              </li>
              <li>
                <Trans>Align on tokenomics, marketing, and launch timeline.</Trans>
              </li>
              <li>
                <Trans>Marketing and community onboarding begins.</Trans>
              </li>
              <li>
                <Trans>Launch CAKE.PAD Event</Trans>
              </li>
            </ol>
            <Box mt="1rem">
              <Trans
                components={[
                  <InlineLink external href="https://pancakeswap.notion.site/cakepad" />,
                  <InlineLink external href="https://docs.pancakeswap.finance/earn/cakepad/faq-partners" />,
                ]}
                i18nTemplate="For more info: <0>CAKE.PAD Partner Terms</0> | <1>Partner FAQ</1>"
              />
            </Box>
          </>
        ),
      },
    ],
    [symbol],
  )

  const extraFaqs = useMemo(
    () =>
      (ifoFaqs ?? []).map(({ title, description }) => ({
        title: t(title.i18nText),
        description: (
          <ReactMarkdown
            components={{
              a: ExternalLink,
            }}
          >
            {t(description.i18nText)}
          </ReactMarkdown>
        ),
      })),
    [ifoFaqs, t],
  )

  const faqs = useMemo(() => [...defaultFaqs, ...extraFaqs], [defaultFaqs, extraFaqs])

  return (
    <Container>
      <Card mt="24px" style={{ maxWidth: '800px' }} mx="auto">
        <StyledCardHeader>
          <StyledHeading>
            <Trans>FAQ</Trans>
          </StyledHeading>
        </StyledCardHeader>
        <CardBody>
          {faqs.map(({ title, description }, i, { length }) => (
            <FoldableText
              key={i}
              mb={i + 1 === length ? '' : '24px'}
              expandableLabelProps={{ iconSize: '24px' }}
              title={title}
              hideExpandableLabel={isMobile}
            >
              <Text color="textSubtle" as="div">
                {description}
              </Text>
            </FoldableText>
          ))}
        </CardBody>
      </Card>
    </Container>
  )
}

type MarkdownAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }

const ExternalLink = ({ href, children }: MarkdownAnchorProps) => {
  if (!href) {
    return <>{children}</>
  }
  return (
    <Link external href={href}>
      {children}
    </Link>
  )
}

export default FaqList
