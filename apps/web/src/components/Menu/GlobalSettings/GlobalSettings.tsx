import { useCallback, useMemo, useState } from 'react'

import { useTranslation } from '@pancakeswap/localization'
import { Flex, FlexGap, PreTitle } from '@pancakeswap/uikit'

import { EVMSettingsTab } from './EVMSettingsTab'
import { GlobalSettingsTab } from './GlobalSettingsTab'
import { SolanaSettingsTab } from './SolanaSettingsTab'

enum GlobalSettingsTabIndex {
  GLOBAL = 0,
  EVM_SETTINGS = 1,
  SOLANA_SETTINGS = 2,
}

export type GlobalSettingsLayoutVariant = 'default' | 'navbarPanel'

type GlobalSettingsProps = {
  /** `navbarPanel`: typography + spacing aligned with desktop navbar hover */
  layoutVariant?: GlobalSettingsLayoutVariant
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ layoutVariant = 'default' }) => {
  const { t } = useTranslation()
  const isPanel = layoutVariant === 'navbarPanel'

  // Tab state
  const [activeTabIndex, setActiveTabIndex] = useState<GlobalSettingsTabIndex>(GlobalSettingsTabIndex.GLOBAL)

  const onTabChange = useCallback(
    (index: GlobalSettingsTabIndex) => {
      setActiveTabIndex(index)
    },
    [setActiveTabIndex],
  )

  // Tab configuration
  // Limitation: we use t() so can't have config outside of the component
  const tabs = useMemo(
    () => [
      {
        index: GlobalSettingsTabIndex.GLOBAL,
        label: t('Global Settings'),
        component: <GlobalSettingsTab compact={isPanel} />,
      },
      {
        index: GlobalSettingsTabIndex.EVM_SETTINGS,
        label: t('EVM Settings'),
        component: <EVMSettingsTab />,
      },
      {
        index: GlobalSettingsTabIndex.SOLANA_SETTINGS,
        label: t('Solana Settings'),
        component: <SolanaSettingsTab />,
      },
    ],
    [t, isPanel],
  )

  return (
    <Flex pb={isPanel ? '0' : '24px'} flexDirection="column">
      <FlexGap mb={isPanel ? '16px' : '24px'} gap={isPanel ? '20px' : '16px'} flexWrap="wrap" alignItems="center">
        {tabs.map((tab) => (
          <PreTitle
            key={tab.index}
            style={{
              cursor: 'pointer',
              ...(isPanel ? { fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' } : {}),
            }}
            color={activeTabIndex === tab.index ? 'secondary' : 'textSubtle'}
            onClick={() => onTabChange(tab.index)}
          >
            {tab.label}
          </PreTitle>
        ))}
      </FlexGap>

      {tabs.find((tab) => tab.index === activeTabIndex)?.component}
    </Flex>
  )
}

export default GlobalSettings
