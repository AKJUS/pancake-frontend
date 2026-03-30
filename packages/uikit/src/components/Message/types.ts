import React from "react";
import { SpaceProps } from "styled-system";

export const variants = {
  WARNING: "warning",
  WARNING60: "warning60",
  DANGER: "danger",
  SUCCESS: "success",
  PRIMARY: "primary",
  PRIMARY60: "primary60",
  SECONDARY: "secondary",
  SECONDARY60: "secondary60",
} as const;

export type Variant = (typeof variants)[keyof typeof variants];

export interface MessageProps extends SpaceProps {
  variant: Variant;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionInline?: boolean;
  style?: React.CSSProperties;
  showIcon?: boolean;
}
