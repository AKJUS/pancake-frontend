import { Flex, Text, Checkbox } from '@pancakeswap/uikit'

export function CardCheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <Flex alignItems="center" style={{ cursor: 'pointer' }} onClick={onChange}>
      <Text bold small color="textSubtle" mr="4px">
        {label}
      </Text>
      <Checkbox scale="sm" checked={checked} onChange={onChange} />
    </Flex>
  )
}
