import { ChainId } from "@pancakeswap/chains";
import { useHttpLocations } from "@pancakeswap/hooks";
import { BinanceIcon, TokenLogo } from "@pancakeswap/uikit";
import { useMemo } from "react";
import { styled } from "styled-components";
import { SpaceProps, space } from "styled-system";

import { ASSET_CDN } from "../../utils/endpoints";
import { ChainLogo } from "./ChainLogo";
import { CurrencyInfo } from "./types";
import { getCurrencyLogoUrlsByInfo } from "./utils";

const StyledLogo = styled(TokenLogo)<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  min-width: ${({ size }) => size};
  min-height: ${({ size }) => size};
  border-radius: 50%;
  ${space}
`;

const LogoContainer = styled.div`
  position: relative;
`;

const StyledChainLogo = styled(ChainLogo)<{ height: number }>`
  position: absolute;
  right: 0;
  bottom: 0;
  height: ${({ height }) => height}px;

  & > img {
    background-color: ${({ theme }) => theme.colors.invertedContrast};
    border: 0px solid ${({ theme }) => theme.colors.invertedContrast};
    border-radius: 35%;
  }
`;

// the ratio of the chain logo to the token logo.
// if token logo is 24px, chain logo is 10px, if
// token logo is 40px, chain logo is 16px
// 40 * x = 16
// 24 * x = 10
// x = 0.4
const TOKEN_CHAIN_RATIO = 0.4167;

export function CurrencyLogo({
  currency,
  size = "24px",
  style,
  useTrustWalletUrl,
  imageRef,
  showChainLogo = false,
  containerStyle,
  crossOrigin,
  ...props
}: {
  crossOrigin?: "anonymous" | "use-credentials";
  currency?: Omit<CurrencyInfo, "address"> & {
    address?: string;
    logoURI?: string | undefined;
  };
  size?: string;
  style?: React.CSSProperties;
  useTrustWalletUrl?: boolean;
  showChainLogo?: boolean;
  imageRef?: React.RefObject<HTMLImageElement>;
  containerStyle?: React.CSSProperties;
} & SpaceProps) {
  const uriLocations = useHttpLocations(currency?.logoURI);
  const sizeInNumber = parseInt(size);

  const srcs: string[] = useMemo(() => {
    if (currency?.isNative) return [];

    if (currency?.isToken) {
      const logoUrls = getCurrencyLogoUrlsByInfo(currency, { useTrustWallet: useTrustWalletUrl });

      if (currency?.logoURI) {
        return [...uriLocations, ...logoUrls];
      }
      return [...logoUrls];
    }
    return [];
  }, [currency, uriLocations, useTrustWalletUrl]);

  const renderLogo = () => {
    if (currency?.isNative) {
      if (currency.chainId === ChainId.BSC) {
        return <BinanceIcon style={style} imageRef={imageRef} width={size} height={size} {...props} />;
      }
      return (
        <StyledLogo
          size={size}
          srcs={[`${ASSET_CDN}/web/native/${currency.chainId}.png`]}
          width={size}
          height={size}
          imageRef={imageRef}
          style={style}
          {...props}
        />
      );
    }

    const crossOriginProp = crossOrigin ? { crossOrigin } : {};

    return (
      <StyledLogo
        imageRef={imageRef}
        size={size}
        srcs={srcs}
        alt={`${currency?.symbol ?? "token"} logo`}
        style={style}
        {...crossOriginProp}
        {...props}
      />
    );
  };

  return (
    <LogoContainer style={containerStyle}>
      {renderLogo()}
      {showChainLogo && currency?.chainId && (
        <StyledChainLogo
          chainId={currency.chainId}
          width={sizeInNumber * TOKEN_CHAIN_RATIO}
          height={sizeInNumber * TOKEN_CHAIN_RATIO}
        />
      )}
    </LogoContainer>
  );
}
