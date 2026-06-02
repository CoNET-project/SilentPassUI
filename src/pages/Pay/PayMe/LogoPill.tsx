import { IpfsImg } from '@/components/IpfsImg';
import React from 'react'
import visa_icon from './assets/icons8-visa.svg'
import master_icon from './assets/Mastercard-logo.svg'
import union_icon from './assets/icons8-unionpay.svg'
import usdc_coin from './assets/usdc.svg'

export type PayLogoType = 'visa' | 'mastercard' | 'unionpay'|'usdc'

const LOGO_MAP: Record<PayLogoType, string> = {
  visa: visa_icon,
  mastercard: master_icon,
  unionpay: union_icon,
  usdc: usdc_coin
}

type PayLogoProps = {
  type: PayLogoType
  size?: number | string
  className?: string
  style?: React.CSSProperties
}

export function PayLogo({ type, size = 24, className, style }: PayLogoProps) {
  const resolvedSize = typeof size === 'number' ? `${size}px` : size

  return (
    <IpfsImg
      src={LOGO_MAP[type]}
      alt={type}
      className={className}
      style={{
        height: resolvedSize,
        width: 'auto',
        objectFit: 'contain',
        display: 'inline-block',
        ...style
      }}
      draggable={false}
    />
  )
}
