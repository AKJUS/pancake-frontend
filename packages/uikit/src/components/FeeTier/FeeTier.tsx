import { smartRoundNumber } from "@pancakeswap/utils/formatFractions";
import BigNumber from "bignumber.js";
import { forwardRef, useMemo } from "react";
import styled from "styled-components";

export type FeeTierProps = {
  type: string;
  fee: number;
  denominator?: number;
  dynamic?: boolean;
  showType?: boolean;
};

export const FeeTier = forwardRef<HTMLSpanElement, FeeTierProps>(
  ({ type, fee, denominator = 10_000, dynamic, showType = true }, ref) => {
    const percent = useMemo(() => {
      const value = new BigNumber(fee).div(denominator).times(100).toNumber().toString();
      const formatted = smartRoundNumber(value, 6);
      return formatted;
    }, [fee, denominator]);
    return (
      <StyledFeeTier ref={ref}>
        {showType ? (
          <>
            {type === "infinityStable" ? (
              <>
                <span style={{ textTransform: "capitalize" }}>Infinity</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ textTransform: "capitalize" }}>SS</span>
              </>
            ) : type === "infinityCl" ? (
              <>
                <span>Infinity</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>CLAMM</span>
              </>
            ) : type === "infinityBin" ? (
              <>
                <span>Infinity</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>LBAMM</span>
              </>
            ) : (
              <span style={{ textTransform: "capitalize" }}>{type}</span>
            )}
            <span style={{ opacity: 0.5 }}>|</span>
          </>
        ) : null}
        <span>
          {dynamic ? <span style={{ marginRight: "2px" }}>↕️</span> : ""}
          {percent}%
        </span>
      </StyledFeeTier>
    );
  }
);

const StyledFeeTier = styled.span`
  display: inline-flex;
  padding: 2px 8px;
  background: ${({ theme }) => theme.colors.tertiary};
  gap: 4px;
  border: 2px solid ${({ theme }) => theme.colors.tertiary20};
  border-radius: 999px;
  color: ${({ theme }) => theme.colors.textSubtle};
  font-size: 14px;
  font-weight: 400;
  line-height: 150%;
`;
