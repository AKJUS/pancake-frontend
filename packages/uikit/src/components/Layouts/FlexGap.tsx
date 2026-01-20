import { styled } from "styled-components";
import { Flex, FlexProps, MotionFlex } from "../Box";

export interface FlexGapProps extends FlexProps {
  gap?: string;
  rowGap?: string;
  columnGap?: string;
}

const FlexGap = styled(Flex)<FlexGapProps>`
  ${({ gap }) => gap && `gap: ${gap};`}
  ${({ rowGap }) => rowGap && `row-gap: ${rowGap};`}
  ${({ columnGap }) => columnGap && `column-gap: ${columnGap};`}
`;

export const MotionFlexGap = styled(MotionFlex)<FlexGapProps>`
  ${({ gap }) => gap && `gap: ${gap};`}
  ${({ rowGap }) => rowGap && `row-gap: ${rowGap};`}
  ${({ columnGap }) => columnGap && `column-gap: ${columnGap};`}
`;

export default FlexGap;
