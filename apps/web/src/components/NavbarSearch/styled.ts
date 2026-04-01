import { styled } from 'styled-components'
import { Box } from '@pancakeswap/uikit'

export const SearchRoot = styled.div`
  flex-shrink: 0;
`

export const TriggerButton = styled.button<{ $mobile?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: ${({ $mobile }) => ($mobile ? '36px' : 'auto')};
  min-width: ${({ $mobile }) => ($mobile ? '36px' : '129px')};
  height: ${({ $mobile }) => ($mobile ? '36px' : '40px')};
  padding: ${({ $mobile }) => ($mobile ? '0' : '8px 12px')};
  border-radius: ${({ $mobile }) => ($mobile ? '10px' : '999px')};
  cursor: pointer;
  flex-shrink: 0;
  border: 1px solid ${({ theme }) => theme.colors.dropdownDeep};
  background: ${({ theme }) => theme.colors.dropdown};
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
`

export const Kbd = styled(Box)`
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSubtle};
  background: ${({ theme }) => theme.colors.inputPrimary};
`

export const SearchModalCard = styled.div`
  width: 100%;
  height: 80vh;
  min-height: 388px;
  border-radius: 32px 32px 0 0;
  background: ${({ theme }) => theme.colors.cardSecondary};
  overflow: hidden;
  display: flex;
  flex-direction: column;

  ${({ theme }) => theme.mediaQueries.md} {
    width: min(440px, calc(100vw - 16px));
    border-radius: 24px;
  }
`

export const ModalGrabber = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.textSubtle};
  opacity: 0.3;
  margin: 8px auto 4px;
  flex-shrink: 0;
`

export const SearchPanelHeader = styled.div`
  padding: 16px 16px 8px;
  background: ${({ theme }) => theme.colors.cardSecondary};
`

export const SearchField = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 8px 8px 12px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.inputSecondary};
  background: ${({ theme }) => theme.colors.input};
  overflow: hidden;
`

export const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  font-size: 16px;
  font-weight: 400;
  outline: none;
  z-index: 10;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSubtle};
    font-weight: 400;
  }
`

export const FiltersStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
`

export const FiltersRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 8px;
`

export const FilterButton = styled.button<{ $active: boolean }>`
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: ${({ theme, $active }) => ($active ? theme.colors.secondary : theme.colors.textSubtle)};
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
`

export const SearchPanelBody = styled.div`
  background: ${({ theme }) => theme.colors.cardSecondary};
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 11px 16px 16px;
  margin-right: 5px;
  &::-webkit-scrollbar {
    width: 6px;
  }
  scrollbar-width: thin;
`

export const Section = styled.div`
  & + & {
    margin-top: 16px;
  }
`

export const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.colors.textSubtle};
  padding: 0 8px;
`

export const ClearButton = styled.button`
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.secondary};
  font-size: 12px;
  font-weight: 600;
`

export const ResultList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`

export const ResultRow = styled.button<{ $active?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
  padding: 8px;
  border: 0;
  border-radius: 16px;
  background: ${({ theme, $active }) => ($active ? theme.colors.tertiary : 'transparent')};
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.tertiary};
  }
`

export const ResultMeta = styled.div`
  flex: 1;
  min-width: 0;
`

export const ResultTitleRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
`

export const ResultSubLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.24px;
  color: ${({ theme }) => theme.colors.textSubtle};
  text-transform: uppercase;
`

export const ProtocolTag = styled.span`
  display: inline-flex;
  padding: 2px 8px;
  background: ${({ theme }) => theme.colors.tertiary};
  border: 2px solid ${({ theme }) => theme.colors.tertiary20};
  border-radius: 999px;
  color: ${({ theme }) => theme.colors.textSubtle};
  font-size: 14px;
  font-weight: 400;
  line-height: 150%;
  text-transform: capitalize;
  white-space: nowrap;
`

export const MoreButton = styled.button`
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSubtle};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  flex-shrink: 0;
`

export const ActionMenu = styled.div<{ $flipUp: boolean; $top: number; $right: number }>`
  position: fixed;
  ${({ $flipUp, $top }) => ($flipUp ? `bottom: calc(100vh - ${$top}px + 8px);` : `top: calc(${$top}px + 8px);`)}
  right: ${({ $right }) => $right}px;
  z-index: ${({ theme }) => theme.zIndices.modal + 1};
  width: max-content;
  min-width: 148px;
  padding: 8px;
  border-radius: 24px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  background: ${({ theme }) => theme.card.background};
`

export const ActionMenuButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.tertiary};
  }
`

export const SearchFieldContainer = styled.div`
  position: relative;
`

export const ChainStackTrigger = styled.button`
  display: flex;
  align-items: center;
  padding: 0 4px;
  border: 0;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
`

export const NetworkFilterDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 10;
  width: 320px;

  .select-input-container {
    height: 0;
    min-height: 0;
    padding: 0;
    border: none !important;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    box-shadow: none !important;
  }

  .p-multiselect-panel {
    padding: 8px 0;
    border-radius: 16px !important;
    border: 1px solid ${({ theme }) => theme.colors.secondary} !important;
    .p-multiselect-items-wrapper {
      height: auto;
    }
  }
`

export const NetworkStack = styled.div`
  display: flex;
  align-items: center;
  padding-right: 12px;
`

export const NetworkBadge = styled.div`
  width: 24px;
  height: 24px;
  margin-right: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 35%;
  border: 2px solid ${({ theme }) => theme.colors.input};
  overflow: hidden;
`

export const NetworkBadgeImage = styled.img`
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 35%;
`

export const NetworkOverflowBadge = styled.div`
  min-width: 24px;
  height: 24px;
  margin-right: -8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 2px solid ${({ theme }) => theme.colors.input};
  background: ${({ theme }) => theme.colors.inputSecondary};
  color: ${({ theme }) => theme.colors.textSubtle};
  font-size: 12px;
  font-weight: 600;
`

export const SearchLogoWrap = styled.div`
  height: 40px;
  flex-shrink: 0;
  > div {
    height: 36px;
  }
`

export const PoolOverviewWrap = styled.div`
  flex: 1;
  min-width: 0;
`
