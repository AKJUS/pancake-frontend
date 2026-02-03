import type { Language } from "@pancakeswap/localization";
import { ElementType, ReactElement, ReactNode } from "react";
import { FooterLinkType } from "../../components/Footer/types";
import { MenuItemsType } from "../../components/MenuItems/types";
import { SubMenuItemsType } from "../../components/SubMenuItems/types";
import { Colors } from "../../theme/types";

export interface LinkStatus {
  text: string;
  color: keyof Colors;
}

export interface NavProps {
  linkComponent?: ElementType;
  rightSide?: ReactNode;
  banner?: ReactElement;
  links: Array<MenuItemsType>;
  homeLink?: string;
  subLinks?: Array<SubMenuItemsType>;
  footerLinks: Array<FooterLinkType>;
  showFooter?: boolean;
  showBottomNav?: boolean;
  activeItem?: string;
  activeSubItem?: string;
  activeSubItemChildItem?: string;
  isDark: boolean;
  toggleTheme: (isDark: boolean) => void;
  cakePriceUsd?: number;
  currentLang: string;
  buyCakeLabel: string;
  buyCakeLink: string;
  showCakePrice?: boolean;
  showLangSelector?: boolean;
  langs: Language[];
  chainId: number;
  setLang: (lang: Language) => void;
  logoComponent?: ReactNode;
}
