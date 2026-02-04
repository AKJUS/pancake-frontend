import { useTooltip } from '@pancakeswap/uikit'
import React from 'react'
import { stringify } from 'viem'

export const PositionDebugView: React.FC<
  React.PropsWithChildren<{
    json: unknown
  }>
> = ({ children, json }) => {
  const isDevelopmentOrPreview =
    window?.location?.hostname === 'localhost' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

  const { targetRef, tooltipVisible, tooltip } = useTooltip(
    isDevelopmentOrPreview ? (
      <pre style={{ maxHeight: '500px', overflow: 'auto' }}>
        {stringify(
          json,
          (k, v) => {
            if (React.isValidElement(v)) return 'ReactElement'
            // Handle BigInt serialization
            if (typeof v === 'bigint') return v.toString()
            return v
          },
          2,
        )}
      </pre>
    ) : null,
  )

  if (!isDevelopmentOrPreview) return children

  return (
    <div ref={targetRef}>
      {children}
      {tooltipVisible && tooltip}
    </div>
  )
}

export const SimpleDebugView = ({ json }: { json: unknown }) => {
  return <PositionDebugView json={json}>⚙️</PositionDebugView>
}
