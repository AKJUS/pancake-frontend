import React, { useEffect, useState } from "react";
import { usePopper } from "react-popper";
import { styled } from "styled-components";
import { Box, Flex } from "../../../../components/Box";
import { ChevronDownIcon } from "../../../../components/Svg";
import MenuIcon from "./MenuIcon";
import { UserMenuItem } from "./styles";
import { UserMenuProps, variants } from "./types";

export const StyledUserMenu = styled(Flex)<{ $avatarSize?: number }>`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.tertiary};
  border-radius: 999px;
  box-shadow: inset 0px -2px 0px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  display: inline-flex;
  height: 32px;
  padding-left: ${({ $avatarSize }) => ($avatarSize ?? 32) + 8}px;
  padding-right: 8px;
  position: relative;

  &:hover {
    opacity: 0.65;
  }
`;

export const LabelText = styled.div`
  color: ${({ theme }) => theme.colors.text};
  display: none;
  font-weight: 600;
  font-size: 16px;
  white-space: nowrap;

  ${({ theme }) => theme.mediaQueries.sm} {
    display: block;
    margin-left: 4px;
    margin-right: 0;
  }
`;

const Menu = styled.div<{ $isOpen: boolean }>`
  background-color: ${({ theme }) => theme.card.background};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 16px;
  padding-bottom: 4px;
  padding-top: 4px;
  pointer-events: auto;
  width: 280px;
  visibility: visible;
  z-index: 1001;

  ${({ $isOpen }) =>
    !$isOpen &&
    `
    pointer-events: none;
    visibility: hidden;
  `}

  ${UserMenuItem}:first-child {
    border-radius: 8px 8px 0 0;
  }

  ${UserMenuItem}:last-child {
    border-radius: 0 0 8px 8px;
  }
`;

const UserMenu: React.FC<UserMenuProps> = ({
  account,
  text,
  avatarSrc,
  avatarClassName,
  variant = variants.DEFAULT,
  children,
  disabled,
  placement = "bottom-end",
  recalculatePopover,
  ellipsis = true,
  popperStyle = {},
  avatarSize,
  avatarRound,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [targetRef, setTargetRef] = useState<HTMLDivElement | null>(null);
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null);

  const { styles, attributes, update } = usePopper(targetRef, tooltipRef, {
    strategy: "fixed",
    placement,
    modifiers: [{ name: "offset", options: { offset: [0, 0] } }],
  });

  const accountEllipsis = account ? `${account.substring(0, 2)}...${account.substring(account.length - 4)}` : null;

  // recalculate the popover position
  useEffect(() => {
    if (recalculatePopover && isOpen && update) update();
  }, [isOpen, update, recalculatePopover]);

  useEffect(() => {
    const showDropdownMenu = () => {
      setIsOpen(true);
    };

    const hideDropdownMenu = (evt: MouseEvent | TouchEvent) => {
      const target = evt.target as Node;
      if (target && !tooltipRef?.contains(target)) {
        setIsOpen(false);
        evt.stopPropagation();
      }
    };

    targetRef?.addEventListener("mouseenter", showDropdownMenu);
    targetRef?.addEventListener("mouseleave", hideDropdownMenu);

    return () => {
      targetRef?.removeEventListener("mouseenter", showDropdownMenu);
      targetRef?.removeEventListener("mouseleave", hideDropdownMenu);
    };
  }, [targetRef, tooltipRef, setIsOpen]);

  return (
    <Flex alignItems="center" height="100%" ref={setTargetRef} {...props}>
      <StyledUserMenu
        $avatarSize={avatarSize}
        onTouchStart={() => {
          setIsOpen((s) => !s);
        }}
      >
        <MenuIcon
          className={avatarClassName}
          avatarSrc={avatarSrc}
          variant={variant}
          avatarSize={avatarSize}
          avatarRound={avatarRound}
        />
        <LabelText title={typeof text === "string" ? text || account : account}>
          {text || (ellipsis ? accountEllipsis : account)}
        </LabelText>
        {!disabled && <ChevronDownIcon color="text" width="20px" />}
      </StyledUserMenu>
      {!disabled && children && (
        <Menu style={{ ...styles.popper, ...popperStyle }} ref={setTooltipRef} {...attributes.popper} $isOpen={isOpen}>
          <Box onClick={() => setIsOpen(false)}>{children?.({ isOpen })}</Box>
        </Menu>
      )}
    </Flex>
  );
};

export default UserMenu;
