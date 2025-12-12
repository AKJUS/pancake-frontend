import { useTranslation } from "@pancakeswap/localization";
import { AutoColumn, Box, CheckmarkCircleIcon, InfoIcon, Text } from "@pancakeswap/uikit";
import { ReactNode } from "react";
import { StepTitleAnimationContainer } from "./ApproveModalContent";
import { FadePresence } from "./Logos";

type SwapReceiptContents = {
  children: ReactNode;
  explorerLink?: ReactNode;
  isMultisig?: boolean;
};

export const SwapTransactionReceiptModalContent = ({ children, explorerLink, isMultisig }: SwapReceiptContents) => {
  const { t } = useTranslation();

  return (
    <Box width="100%">
      <FadePresence>
        <Box margin="auto auto 22px auto" width="fit-content">
          {isMultisig ? (
            <InfoIcon color="warning" width={80} height={80} />
          ) : (
            <CheckmarkCircleIcon color="success" width={80} height={80} />
          )}
        </Box>
      </FadePresence>

      <AutoColumn justify="center">
        <StepTitleAnimationContainer>
          <Text bold textAlign="center">
            {isMultisig ? t("Multisig transaction submitted") : t("Transaction receipt")}
          </Text>

          {!isMultisig && explorerLink}
        </StepTitleAnimationContainer>
        {children}
        {isMultisig ? (
          <Text textAlign="center" mt="12px">
            {t("Transaction pending approvals. Execution will occur after multisig confirmation.")}
          </Text>
        ) : null}
      </AutoColumn>
    </Box>
  );
};
