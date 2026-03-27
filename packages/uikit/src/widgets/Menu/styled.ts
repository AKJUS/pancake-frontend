import styled from "styled-components";

import { Box } from "../../components/Box";
import { MENU_HEIGHT } from "./config";

export const Wrapper = styled.div`
  position: relative;
  width: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
`;

export const StyledNav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-width: 320px;
  height: ${MENU_HEIGHT}px;
  background-color: ${({ theme }) => theme.nav.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
  transform: translate3d(0, 0, 0);

  padding-left: 8px;
  padding-right: 8px;
  ${({ theme }) => theme.mediaQueries.sm} {
    padding-left: 16px;
    padding-right: 16px;
  }
`;

export const FixedContainer = styled("div").withConfig({
  shouldForwardProp: (props) => !["showMenu"].includes(props),
})<{ showMenu: boolean; $height: number }>`
  position: fixed;
  top: ${({ showMenu, $height }) => (showMenu ? 0 : `-${$height}px`)};
  left: 0;
  transition: top 0.2s;
  height: ${({ $height }) => `${$height}px`};
  width: 100%;
  z-index: 20;
`;

export const TopBannerContainer = styled.div<{ height: number }>`
  height: ${({ height }) => `${height}px`};
  min-height: ${({ height }) => `${height}px`};
  max-height: ${({ height }) => `${height}px`};
  width: 100%;
`;

export const BodyWrapper = styled(Box)`
  position: relative;
  display: flex;
  max-width: 100vw;
`;

export const Inner = styled.div`
  flex-grow: 1;
  transition: margin-top 0.2s, margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translate3d(0, 0, 0);
  max-width: 100%;
`;
