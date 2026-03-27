import { styled } from "styled-components";

import { getChainName as defaultGetChainName } from "@pancakeswap/chains";
import { UnifiedCurrency } from "@pancakeswap/sdk";
import { Flex, Skeleton, Text } from "@pancakeswap/uikit";

import { ChainLogo, DoubleCurrencyLogo } from "../CurrencyLogo";

const ICON_CHAIN_RATIO = 0.4167;

export interface ITokenInfoProps {
  isReady?: boolean;
  title?: React.ReactNode;
  titleFontSize?: string;
  desc?: React.ReactNode;
  icon?: React.ReactNode;
  customContent?: React.ReactNode;
  token: UnifiedCurrency;
  quoteToken: UnifiedCurrency;
  iconWidth?: string;
  showChainLogo?: boolean;
  getChainName?: (chainId: number) => string | undefined;
  getCurrencySymbol?: (token: UnifiedCurrency) => string | undefined;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconWrapper = styled.div<{ width?: string }>`
  position: relative;
  width: ${({ width }) => width ?? "40px"};
`;

const StyledChainLogo = styled(ChainLogo)`
  position: absolute;
  right: -2px;
  bottom: -6px;
  z-index: 6;

  & > img {
    border-radius: 35%;
  }
`;

const DescWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSubtle};

  & img {
    vertical-align: bottom;
  }
`;

export const TokenOverview: React.FC<ITokenInfoProps> = ({
  isReady,
  title,
  desc,
  icon,
  customContent,
  token,
  quoteToken,
  iconWidth,
  showChainLogo = false,
  titleFontSize = "16px",
  getChainName = defaultGetChainName,
  getCurrencySymbol = (token) => token.symbol, // Default alias function
}) => {
  const iconSize = parseInt(iconWidth ?? "40");

  if (!isReady) {
    return (
      <Container>
        <Skeleton mr="8px" width={32} height={32} variant="circle" />
        <div>
          <Skeleton width={40} height={10} mb="4px" />
          <Skeleton width={60} height={24} />
        </div>
      </Container>
    );
  }
  return (
    <Container>
      <IconWrapper width={iconWidth}>
        {icon ?? <DoubleCurrencyLogo currency0={token} currency1={quoteToken} />}
        {showChainLogo && token.chainId && (
          <StyledChainLogo
            chainId={token.chainId}
            width={iconSize * ICON_CHAIN_RATIO}
            height={iconSize * ICON_CHAIN_RATIO}
          />
        )}
      </IconWrapper>
      {customContent ?? (
        <Flex flexDirection="column">
          <Text bold fontSize={titleFontSize}>
            {title ?? `${getCurrencySymbol(token)} / ${getCurrencySymbol(quoteToken)}`}
          </Text>
          <DescWrapper>
            {desc ?? (
              <>
                <ChainLogo width={16} height={16} chainId={token.chainId} imageStyles={{ borderRadius: "50%" }} />
                {getChainName(token.chainId)?.toUpperCase()}
              </>
            )}
          </DescWrapper>
        </Flex>
      )}
    </Container>
  );
};
