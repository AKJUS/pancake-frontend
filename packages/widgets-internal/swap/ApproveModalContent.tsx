import { useTheme } from "@pancakeswap/hooks";
import { useTranslation } from "@pancakeswap/localization";
import { Currency } from "@pancakeswap/swap-sdk-core";
import {
  AutoColumn,
  Box,
  Button,
  Column,
  ColumnCenter,
  Flex,
  LinkExternal,
  SwapLoading,
  Text,
  TooltipText,
  useTooltip,
} from "@pancakeswap/uikit";
import { FC, ReactNode, Ref, useMemo, useRef } from "react";
import styled, { css } from "styled-components";
import { CurrencyLogo } from "../components/CurrencyLogo";
import { ApprovalPhaseIcon } from "./Logos";
import { AnimationType, slideInAnimation, slideOutAnimation } from "./styles";
import { useUnmountingAnimation } from "./useUnmountingAnimation";

export enum ConfirmModalState {
  REVIEWING,
  WRAPPING,
  RESETTING_APPROVAL,
  APPROVING_TOKEN,
  PERMITTING,
  PENDING_CONFIRMATION,
  COMPLETED,

  // Cross-Chain Swap
  ORDER_SUBMITTED,
  MULTISIG_SUBMITTED,
}

export type PendingApproveModalState = Extract<
  ConfirmModalState,
  ConfirmModalState.APPROVING_TOKEN | ConfirmModalState.PERMITTING | ConfirmModalState.RESETTING_APPROVAL
>;

type AllowedAllowanceState =
  | ConfirmModalState.RESETTING_APPROVAL
  | ConfirmModalState.APPROVING_TOKEN
  | ConfirmModalState.PERMITTING;

interface ApproveModalContentProps {
  title: {
    [step in AllowedAllowanceState]: string;
  };
  isX: boolean;
  isBonus: boolean;
  currencyA: Currency;
  asBadge: boolean;
  currentStep: ConfirmModalState;
  approvalModalSteps: PendingApproveModalState[];
}

interface StepTitleAnimationContainerProps {
  disableEntranceAnimation?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export const StepTitleAnimationContainer: FC<StepTitleAnimationContainerProps> = styled(
  Column
)<StepTitleAnimationContainerProps>`
  align-items: center;
  transition: display 300ms ease-in-out;
  ${({ disableEntranceAnimation }) =>
    !disableEntranceAnimation &&
    css`
      ${slideInAnimation}
    `}

  &.${AnimationType.EXITING} {
    ${slideOutAnimation}
  }
`;

export const ApproveModalContent: React.FC<ApproveModalContentProps> = ({
  title,
  isX,
  isBonus,
  currencyA,
  asBadge,
  currentStep,
  approvalModalSteps,
}) => {
  const { t } = useTranslation();
  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    <Text>{t("Pancakeswap AMM includes V3, V2 and stable swap.")}</Text>,
    { placement: "top" }
  );

  const currentStepContainerRef = useRef<HTMLDivElement>(null);
  useUnmountingAnimation(currentStepContainerRef, () => AnimationType.EXITING);
  const disableEntranceAnimation = approvalModalSteps[0] === currentStep;

  return useMemo(
    () => (
      <Box width="100%">
        <Flex height="160px" alignItems="center">
          <ColumnCenter>
            <ApprovalPhaseIcon currency={currencyA} asBadge={asBadge} />
          </ColumnCenter>
        </Flex>
        <AutoColumn gap="12px" justify="center">
          {approvalModalSteps.map((step: PendingApproveModalState) => {
            return (
              Boolean(step === currentStep) && (
                <StepTitleAnimationContainer
                  disableEntranceAnimation={disableEntranceAnimation}
                  key={step}
                  ref={step === currentStep ? currentStepContainerRef : undefined}
                >
                  <Text bold textAlign="center">
                    {title[step]}
                  </Text>
                  <Flex>
                    <Text fontSize="14px">{t("Swapping thru:")}</Text>
                    {isX ? (
                      <Text ml="4px" fontSize="14px">
                        PancakeSwap X
                      </Text>
                    ) : isBonus ? (
                      <Text ml="4px" fontSize="14px">
                        {t("Bonus Route")}
                      </Text>
                    ) : (
                      <>
                        <TooltipText ml="4px" fontSize="14px" color="textSubtle" ref={targetRef}>
                          {t("Pancakeswap AMM")}
                        </TooltipText>
                        {tooltipVisible && tooltip}
                      </>
                    )}
                  </Flex>
                </StepTitleAnimationContainer>
              )
            );
          })}
        </AutoColumn>
      </Box>
    ),
    [
      currencyA,
      isBonus,
      isX,
      t,
      targetRef,
      title,
      tooltip,
      tooltipVisible,
      asBadge,
      approvalModalSteps,
      currentStep,
      disableEntranceAnimation,
    ]
  );
};

const TertiaryButton = styled(Button).attrs({ variant: "tertiary" })<{ $color: string }>`
  height: unset;
  padding: 7px 8px;
  font-size: 14px;
  border-radius: 12px;
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
  color: ${({ $color }) => $color};
`;

// TODO: Remove if not needed
export const ApproveCrossChainModalContent = ({ currency, chainName }: { currency: Currency; chainName: string }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <AutoColumn gap="8px" justify="center" alignItems="center">
      <AutoColumn gap="4px" justify="center" alignItems="center">
        <Box width="fit-content">
          <CurrencyLogo currency={currency} size="40px" showChainLogo />
        </Box>
        <Flex>
          <Text bold mr="4px">
            {currency.symbol}
          </Text>

          <Text bold color="textSubtle">
            ({chainName})
          </Text>
        </Flex>
      </AutoColumn>

      <TertiaryButton
        $color={theme.colors.primary60}
        onClick={() => {
          window.open(
            "https://docs.pancakeswap.finance/~/changes/d1gFBwxReM0gH1aeMo0G/readme/help/what-is-an-approval-transaction",
            "_blank"
          );
        }}
      >
        <LinkExternal showExternalIcon target="_blank" color={theme.colors.primary60}>
          {t("Why approving this?")}
        </LinkExternal>
      </TertiaryButton>
      <Flex mt="8px">
        <Text color="textSubtle" fontSize="12px" mr="8px">
          {t("Please proceed in your wallet")}
        </Text>
        <SwapLoading reverse />
      </Flex>
    </AutoColumn>
  );
};
