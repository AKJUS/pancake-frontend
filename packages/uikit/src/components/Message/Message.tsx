import React, { useContext, useMemo } from "react";
import { styled } from "styled-components";
import { space, variant as systemVariant } from "styled-system";
import { Box } from "../Box";
import { CheckmarkCircleIcon, ErrorIcon, InfoFilledIcon, WarningIcon } from "../Svg";
import { Text, TextProps } from "../Text";
import variants from "./theme";
import { MessageProps } from "./types";

const MessageContext = React.createContext<MessageProps>({ variant: "success" });

const Icons = {
  warning: WarningIcon,
  warning60: WarningIcon,
  danger: ErrorIcon,
  success: CheckmarkCircleIcon,
  primary: InfoFilledIcon,
  primary60: InfoFilledIcon,
  secondary: ErrorIcon,
  secondary60: ErrorIcon,
};

const MessageContainer = styled.div<MessageProps>`
  background-color: gray;
  padding: 16px;
  border-radius: 16px;
  border: solid 1px;
  line-height: 1.4;

  ${space}
  ${systemVariant({
    variants,
  })}
`;

const Flex = styled.div`
  display: flex;
`;

const colors = {
  // these color names should be place in the theme once the palette is finalized
  primary: "text",
  primary60: "#280D5F",
  warning: "#D67E0A",
  success: "#129E7D",
  danger: "failure",
  secondary: "#D67E0A",
  secondary60: "text",
  warning60: "text",
};

export const MessageText: React.FC<React.PropsWithChildren<TextProps>> = ({ children, ...props }) => {
  const ctx = useContext(MessageContext);
  return (
    <Text fontSize="14px" color={colors[ctx?.variant]} {...props}>
      {children}
    </Text>
  );
};

const Message: React.FC<React.PropsWithChildren<MessageProps>> = ({
  children,
  variant,
  icon,
  action,
  actionInline,
  showIcon = true,
  ...props
}) => {
  const Icon = Icons[variant];
  const providerValue = useMemo(() => ({ variant }), [variant]);
  return (
    <MessageContext.Provider value={providerValue}>
      <MessageContainer variant={variant} {...props}>
        <Flex>
          {showIcon && (
            <Box mr="12px">
              {icon ?? (
                <Icon
                  color={
                    "iconColor" in variants[variant]
                      ? (variants[variant].iconColor as string)
                      : (variants[variant].borderColor as string)
                  }
                  width="24px"
                />
              )}
            </Box>
          )}
          {children}
          {actionInline && action}
        </Flex>
        {!actionInline && action}
      </MessageContainer>
    </MessageContext.Provider>
  );
};

export default Message;
