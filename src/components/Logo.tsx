import { useId } from 'react'

export default function Logo({ size = 30 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <rect x="7" y="9" width="11" height="15" rx="2.5" fill="#fff" opacity="0.55" transform="rotate(-12 12.5 16.5)" />
      <rect x="13" y="7.5" width="11" height="15" rx="2.5" fill="#fff" />
      <text x="18.5" y="19" textAnchor="middle" fontWeight="700" fontSize="8" fill="#0d9488">
        5
      </text>
    </svg>
  )
}
