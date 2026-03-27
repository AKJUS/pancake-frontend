import { ReactNode } from "react";

import { Placement } from "@popperjs/core";

import { FlexProps } from "../../../../components/Box";

export const variants = {
  DEFAULT: "default",
  WARNING: "warning",
  DANGER: "danger",
  PENDING: "pending",
} as const;

export type Variant = (typeof variants)[keyof typeof variants];

export interface UserMenuProps extends Omit<FlexProps, "children"> {
  account?: string;
  text?: ReactNode;
  avatarSrc?: string;
  avatarClassName?: string;
  variant?: Variant;
  disabled?: boolean;
  children?: (exposedProps: { isOpen: boolean }) => ReactNode;
  placement?: Placement;
  recalculatePopover?: boolean;
  ellipsis?: boolean;
  popperStyle?: React.CSSProperties;
  /** Avatar / wallet icon diameter in px (default 32). Use ~24 for compact navbar. */
  avatarSize?: number;
  /** When true, renders the avatar icon as a circle (e.g. for chain icons). Default is rounded-square. */
  avatarRound?: boolean;
}

export interface UserMenuItemProps {
  disabled?: boolean;
}
