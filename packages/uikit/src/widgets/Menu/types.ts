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
  /** When set, desktop top `MenuItems` use this list; `links` is still used for mobile `BottomNav`. */
  desktopNavLinks?: Array<MenuItemsType>;
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
  showNavbarCakePrice?: boolean;
  showLangSelector?: boolean;
  langs: Language[];
  chainId: number;
  setLang: (lang: Language) => void;
  logoComponent?: ReactNode;
  /** Desktop-only slot (e.g. global search) rendered before the right-side cluster */
  headerSearchSlot?: ReactNode;
}
