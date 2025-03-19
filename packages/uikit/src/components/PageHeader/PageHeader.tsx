import { styled } from "styled-components";
import { Box, BoxProps } from "../Box";
import Container from "../Layouts/Container";
import { PageHeaderProps } from "./types";

const Outer = styled(Box)<{ background?: string }>`
  padding-top: 32px;
  padding-bottom: 32px;
  background: ${({ theme, background }) => background || theme.colors.gradientBubblegum};
`;

const Inner = styled(Container)`
  position: relative;
`;

const PageHeader: React.FC<React.PropsWithChildren<PageHeaderProps & { innerProps?: BoxProps }>> = ({
  background,
  children,
  innerProps,
  ...props
}) => (
  <Outer background={background} {...props}>
    <Inner {...innerProps}>{children}</Inner>
  </Outer>
);

export default PageHeader;
