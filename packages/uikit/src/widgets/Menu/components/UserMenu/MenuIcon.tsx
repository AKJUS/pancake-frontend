import React from "react";

import { styled } from "styled-components";

import { Image } from "../../../../components/Image";
import { RefreshIcon, WalletFilledIcon, WarningIcon } from "../../../../components/Svg";
import { Colors } from "../../../../theme/types";
import { Variant, variants } from "./types";

const MenuIconWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "borderColor" && prop !== "$size",
})<{ borderColor: keyof Colors; $size?: number }>`
  align-items: center;
  background-color: ${({ theme }) => theme.colors.background};
  border-color: ${({ theme, borderColor }) => theme.colors[borderColor]};
  border-radius: ${({ $size }) => Math.round(($size ?? 32) / 4)}px;
  border-style: solid;
  border-width: 2px;
  display: flex;
  height: ${({ $size }) => $size ?? 32}px;
  justify-content: center;
  left: 4px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: ${({ $size }) => $size ?? 32}px;
  z-index: 20;
`;

const ProfileIcon = styled(Image).withConfig({
  shouldForwardProp: (prop) => prop !== "$size" && prop !== "$rounded",
})<{ $size: number; $rounded?: boolean }>`
  left: 4px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;

  & > img {
    border-radius: 50%;
  }
`;

export const NoProfileMenuIcon: React.FC<{ size?: number }> = ({ size = 32 }) => {
  const inner = Math.max(14, Math.round((size ?? 32) * 0.72));
  return (
    <MenuIconWrapper borderColor="primary" $size={size}>
      <WalletFilledIcon color="primary" width={`${inner}px`} />
    </MenuIconWrapper>
  );
};

export const PendingMenuIcon: React.FC<{ size?: number }> = ({ size = 32 }) => {
  const inner = Math.max(14, Math.round((size ?? 32) * 0.72));
  return (
    <MenuIconWrapper borderColor="secondary" $size={size}>
      <RefreshIcon color="secondary" width={`${inner}px`} spin />
    </MenuIconWrapper>
  );
};

export const WarningMenuIcon: React.FC<{ size?: number }> = ({ size = 32 }) => {
  const inner = Math.max(14, Math.round((size ?? 32) * 0.72));
  return (
    <MenuIconWrapper borderColor="warning" $size={size}>
      <WarningIcon color="warning" width={`${inner}px`} />
    </MenuIconWrapper>
  );
};

export const DangerMenuIcon: React.FC<{ size?: number }> = ({ size = 32 }) => {
  const inner = Math.max(14, Math.round((size ?? 32) * 0.72));
  return (
    <MenuIconWrapper borderColor="failure" $size={size}>
      <WarningIcon color="failure" width={`${inner}px`} />
    </MenuIconWrapper>
  );
};

const MenuIcon: React.FC<
  React.PropsWithChildren<{
    avatarSrc?: string;
    variant: Variant;
    className?: string;
    avatarSize?: number;
    avatarRound?: boolean;
  }>
> = ({ avatarSrc, variant, className, avatarSize = 32, avatarRound }) => {
  const size = avatarSize ?? 32;

  if (variant === variants.DANGER) {
    return <DangerMenuIcon size={size} />;
  }

  if (variant === variants.WARNING) {
    return <WarningMenuIcon size={size} />;
  }

  if (variant === variants.PENDING) {
    return <PendingMenuIcon size={size} />;
  }

  if (!avatarSrc) {
    return <NoProfileMenuIcon size={size} />;
  }

  return (
    <ProfileIcon src={avatarSrc} height={size} width={size} className={className} $size={size} $rounded={avatarRound} />
  );
};

export default MenuIcon;
