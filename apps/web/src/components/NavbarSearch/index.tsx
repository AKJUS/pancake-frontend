import { AtomBox } from '@pancakeswap/uikit'
import { NavbarSearchSurface } from './NavbarSearchSurface'

export const NavbarSearchDesktop: React.FC = () => {
  return <NavbarSearchSurface />
}

export const NavbarSearchMobile: React.FC = () => {
  return (
    <AtomBox display={{ xs: 'flex', lg: 'none' }} alignItems="center">
      <NavbarSearchSurface mobile />
    </AtomBox>
  )
}
