import { useTranslation } from '@pancakeswap/localization'
import { AddIcon, Box, BoxProps, Button, ButtonProps } from '@pancakeswap/uikit'

export const AddLiquidityButton: React.FC<ButtonProps & { wrapperProps?: BoxProps; to?: string }> = ({
  wrapperProps,
  to = '/add',
  ...props
}) => {
  const { t } = useTranslation()
  return (
    <Box width="100%" {...wrapperProps}>
      {/* @ts-ignore */}
      <Button as="a" href={to} endIcon={<AddIcon color="invertedContrast" />} {...props}>
        {t('Add Liquidity')}
      </Button>
    </Box>
  )
}
