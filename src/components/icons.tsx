import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function icon(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export function IconHome(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function IconList(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  )
}

export function IconScale(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 4v16M8 20h8M5 8h14M5 8l-3 6h6zM19 8l-3 6h6z" />
    </svg>
  )
}

export function IconChart(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 19h16M7 16V9M12 16V5M17 16v-7" />
    </svg>
  )
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 13.5h.01" />
    </svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 7.6 7.6M16.4 16.4l1.4 1.4M17.8 6.2 16.4 7.6M7.6 16.4 6.2 17.8" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function IconPiggy(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M15 11h.01M5 11c0-3.5 3.2-6 8-6 4.4 0 8 2.2 8 6 0 1.2-.4 2.2-1 3.1V18a1 1 0 0 1-1 1h-2l-1.5 2h-5L9 19H7a1 1 0 0 1-1-1v-2.2A6.4 6.4 0 0 1 5 11Z" />
      <path d="M5 12H3l1-3h2" />
    </svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 16V7M8 11l4-4 4 4M5 19h14" />
    </svg>
  )
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}
