import debounce from "lodash/debounce";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePopper } from "react-popper";
import useMatchBreakpoints from "../../contexts/MatchBreakpoints/useMatchBreakpoints";
import { useOnClickOutside } from "../../hooks";
import { MenuContext } from "../../widgets/Menu/context";
import { Box, Flex } from "../Box";
import { ChevronDownIcon, ChevronUpIcon, OpenNewIcon } from "../Svg";
import {
  DropdownMenuDivider,
  DropdownMenuItem,
  LinkStatus,
  StyledDropdownMenu,
  StyledDropdownMenuItemContainer,
} from "./styles";
import { DropdownMenuItems, DropdownMenuItemType, DropdownMenuProps, LinkStatus as LinkStatusType } from "./types";

const MenuItemComponent: React.FC<{
  label: React.ReactNode;
  status: LinkStatusType | undefined;
  isChildItems: boolean | undefined;
}> = ({ label, status, isChildItems }) => {
  return (
    <Flex alignItems="center" ml={isChildItems ? "16px" : "0px"}>
      {label}
      {status && (
        <LinkStatus textTransform="uppercase" color={status.color} fontSize="14px">
          {status.text}
        </LinkStatus>
      )}
    </Flex>
  );
};

const MenuItem: React.FC<{
  item: DropdownMenuItems;
  activeItem?: string;
  activeSubItemChildItem?: string;
  isChildItems?: boolean;
  isDisabled?: boolean;
  linkComponent: any;
  setIsOpen: (open: boolean) => void;
}> = ({ item, isChildItems, isDisabled, linkComponent, activeItem, activeSubItemChildItem, setIsOpen }) => {
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(true);
  const { isMobile, isMd } = useMatchBreakpoints();
  const {
    type = DropdownMenuItemType.INTERNAL_LINK,
    label,
    href = "/",
    status,
    disabled,
    items,
    onClick,
    ...itemProps
  } = item;
  const hasChildItems = useMemo(() => Boolean(items && items.length > 0), [items]);

  const isActive = useMemo(() => {
    return Boolean(isChildItems ? item.href === activeSubItemChildItem : item.href === activeItem);
  }, [item, isChildItems, activeSubItemChildItem, activeItem]);

  const MenuItemContent = <MenuItemComponent label={label} status={status} isChildItems={isChildItems} />;

  const handleToggleSubMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      setIsSubMenuOpen(!isSubMenuOpen);
    },
    [isSubMenuOpen]
  );

  const chevronIconColor = useMemo(() => {
    const isActiveChevron = hasChildItems && item.items?.find((i) => i.href === activeSubItemChildItem);
    if (isActiveChevron) {
      return "secondary";
    }

    return disabled || isDisabled ? "disabled" : "textSubtle";
  }, [activeSubItemChildItem, disabled, hasChildItems, isDisabled, item]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (hasChildItems) {
        handleToggleSubMenu(e);
      } else {
        setIsOpen(false);
        onClick?.(e);
      }
    },
    [hasChildItems, handleToggleSubMenu, setIsOpen, onClick]
  );

  const handleExternalClick = useCallback(
    (e: any) => {
      setIsOpen(false);
      onClick?.(e);
    },
    [setIsOpen, onClick]
  );

  return (
    <StyledDropdownMenuItemContainer>
      {type === DropdownMenuItemType.BUTTON && (
        <DropdownMenuItem
          $isActive={isActive}
          disabled={disabled || isDisabled}
          type="button"
          onClick={onClick}
          {...itemProps}
        >
          {MenuItemContent}
        </DropdownMenuItem>
      )}
      {type === DropdownMenuItemType.INTERNAL_LINK && (
        <DropdownMenuItem
          disabled={disabled || isDisabled}
          as={linkComponent}
          href={href}
          $isActive={isActive}
          onClick={handleClick}
          {...itemProps}
        >
          {MenuItemContent}
          {hasChildItems && (
            <>
              {isSubMenuOpen ? (
                <ChevronDownIcon width="24px" height="24px" color={chevronIconColor} />
              ) : (
                <ChevronUpIcon width="24px" height="24px" color={chevronIconColor} />
              )}
            </>
          )}
        </DropdownMenuItem>
      )}
      {type === DropdownMenuItemType.EXTERNAL_LINK && (
        <DropdownMenuItem
          $isActive={isActive}
          disabled={disabled || isDisabled}
          as="a"
          href={href}
          target="_blank"
          onClick={handleExternalClick}
        >
          <Flex alignItems="center" justifyContent="space-between" width="100%">
            {MenuItemContent}
            <OpenNewIcon color={disabled ? "textDisabled" : "textSubtle"} />
          </Flex>
        </DropdownMenuItem>
      )}

      {type === DropdownMenuItemType.DIVIDER && <DropdownMenuDivider />}

      {isSubMenuOpen &&
        hasChildItems &&
        items
          ?.filter((childItem) => ((isMobile || isMd) && childItem.isMobileOnly) || !childItem.isMobileOnly)
          ?.map((childItem, index) => (
            <MenuItem
              isChildItems
              key={childItem?.label?.toString() || `delimiter${index}`}
              item={childItem}
              isDisabled={isDisabled}
              linkComponent={linkComponent}
              activeSubItemChildItem={activeSubItemChildItem}
              setIsOpen={setIsOpen}
            />
          ))}
    </StyledDropdownMenuItemContainer>
  );
};

const DropdownMenu: React.FC<React.PropsWithChildren<DropdownMenuProps>> = ({
  children,
  isBottomNav = false,
  showItemsOnMobile = false,
  activeItem = "",
  activeSubItemChildItem = "",
  items = [],
  itemKey,
  index,
  setMenuOpenByIndex,
  isDisabled,
  trigger = "hover",
  ...props
}) => {
  const { linkComponent } = useContext(MenuContext);
  const [isOpen, setIsOpen] = useState(false);
  const { isMobile, isMd } = useMatchBreakpoints();
  const [targetRef, setTargetRef] = useState<HTMLDivElement | null>(null);
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null);
  const filteredItems = useMemo(
    () => items.filter((item) => ((isMobile || isMd) && item.isMobileOnly) || !item.isMobileOnly),
    [items, isMobile, isMd]
  );
  const hasItems = filteredItems.length > 0;
  const { styles, attributes } = usePopper(targetRef, tooltipRef, {
    strategy: isBottomNav ? "absolute" : "fixed",
    placement: isBottomNav ? "top" : "bottom-start",
    modifiers: [{ name: "offset", options: { offset: [0, isBottomNav ? 6 : 0] } }],
  });

  const isMenuShow = isOpen && ((isBottomNav && showItemsOnMobile) || !isBottomNav);

  useEffect(() => {
    if (isBottomNav && !hasItems) return undefined;
    if (trigger !== "hover") return undefined;
    const showDropdownMenu = () => {
      setIsOpen(true);
      hideDropdownMenu.cancel();
    };

    const hideDropdownMenu = debounce(
      () => {
        setIsOpen(false);
      },
      isBottomNav ? 100 : 10
    );

    [targetRef, tooltipRef].forEach((ref) => {
      ref?.addEventListener("mouseenter", showDropdownMenu);
      ref?.addEventListener("mouseleave", hideDropdownMenu);
    });

    return () => {
      [targetRef, tooltipRef].forEach((ref) => {
        ref?.removeEventListener("mouseenter", showDropdownMenu);
        ref?.removeEventListener("mouseleave", hideDropdownMenu);
      });
      hideDropdownMenu.cancel();
    };
  }, [setIsOpen, tooltipRef, targetRef, isBottomNav, hasItems, trigger]);

  useEffect(() => {
    if (setMenuOpenByIndex && index !== undefined) {
      setMenuOpenByIndex((prevValue) => ({ ...prevValue, [index]: isMenuShow }));
    }
  }, [isMenuShow, setMenuOpenByIndex, index]);

  useOnClickOutside(
    isOpen ? targetRef : null,
    useCallback(() => {
      setIsOpen(false);
    }, [setIsOpen])
  );

  const handlePointerDown = useCallback(() => {
    if (isBottomNav && !hasItems) return;
    setIsOpen((s) => !s);
  }, [isBottomNav, hasItems]);

  return (
    <Box ref={setTargetRef} {...props}>
      <Box onPointerDown={handlePointerDown}>{children}</Box>
      {hasItems && (
        <StyledDropdownMenu
          ref={setTooltipRef}
          style={styles.popper}
          $isBottomNav={isBottomNav}
          $isOpen={isMenuShow}
          {...attributes.popper}
        >
          {filteredItems.map((item) => (
            <MenuItem
              key={itemKey?.(item) ?? item.key ?? item?.label?.toString() ?? `delimiter${index}`}
              item={item}
              activeItem={activeItem}
              activeSubItemChildItem={activeSubItemChildItem}
              isDisabled={isDisabled}
              linkComponent={linkComponent}
              setIsOpen={setIsOpen}
            />
          ))}
        </StyledDropdownMenu>
      )}
    </Box>
  );
};

export default DropdownMenu;
