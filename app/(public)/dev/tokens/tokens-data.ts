import type { BadgeColor } from '@/lib/constants/categories'
import type { ButtonSize, ButtonVariant } from '@/components/ui/Button'

export type Swatch = {
  name: string
  hex: string
  className: string
  /** 칩 위에 올릴 글자색이 흰색이어야 하는지. */
  isDark?: boolean
}

export type SwatchGroup = {
  title: string
  description: string
  items: readonly Swatch[]
}

export const COLOR_GROUPS: readonly SwatchGroup[] = [
  {
    title: 'Ink',
    description: '제목 · 본문 · 어두운 버튼',
    items: [
      { name: 'ink', hex: '#2A2A2A', className: 'bg-ink', isDark: true },
      { name: 'ink-muted', hex: '#737373', className: 'bg-ink-muted', isDark: true },
      { name: 'ink-soft', hex: '#C2C2C2', className: 'bg-ink-soft' },
    ],
  },
  {
    title: 'Surface / Line',
    description: '카드 · 시트 · 경계선',
    items: [
      { name: 'surface', hex: '#FFFFFF', className: 'bg-surface' },
      { name: 'sheet', hex: '#F6F6F6', className: 'bg-sheet' },
      { name: 'page', hex: '#F3F3F3', className: 'bg-page' },
      { name: 'line', hex: '#E5E8EF', className: 'bg-line' },
      { name: 'line-soft', hex: '#CDD3DB', className: 'bg-line-soft' },
    ],
  },
  {
    title: 'Category card',
    description: '카드 하단 색 패널',
    items: [
      { name: 'card-notice', hex: '#FFAEE7', className: 'bg-card-notice' },
      { name: 'card-patch', hex: '#74B1FF', className: 'bg-card-patch' },
      { name: 'card-free', hex: '#33C791', className: 'bg-card-free' },
      { name: 'card-support', hex: '#FFBA43', className: 'bg-card-support' },
    ],
  },
  {
    title: 'Discord / Focus',
    description: '디스코드 CTA 그라데이션 스톱 · 포커스 링',
    items: [
      { name: 'discord-from', hex: '#5290F4', className: 'bg-discord-from', isDark: true },
      { name: 'discord-mid', hex: '#3B82F6', className: 'bg-discord-mid', isDark: true },
      { name: 'discord-to', hex: '#406AE4', className: 'bg-discord-to', isDark: true },
      { name: 'focus', hex: '#1D6FE0', className: 'bg-focus', isDark: true },
    ],
  },
  {
    title: 'Badge',
    description: '게시판 말머리 뱃지',
    items: [
      { name: 'badge-red', hex: '#E8412F', className: 'bg-badge-red' },
      { name: 'badge-pink', hex: '#FF6B9A', className: 'bg-badge-pink' },
      { name: 'badge-purple', hex: '#6A4AE0', className: 'bg-badge-purple', isDark: true },
      { name: 'badge-orange', hex: '#FF8A3D', className: 'bg-badge-orange' },
      { name: 'badge-green', hex: '#22B573', className: 'bg-badge-green' },
      { name: 'badge-rose', hex: '#F5A3A3', className: 'bg-badge-rose' },
      { name: 'badge-gray', hex: '#6B7280', className: 'bg-badge-gray', isDark: true },
    ],
  },
]

export const BADGE_SAMPLES: readonly { label: string; color: BadgeColor }[] = [
  { label: '필독', color: 'red' },
  { label: '점검', color: 'pink' },
  { label: '공지사항', color: 'purple' },
  { label: '업데이트', color: 'orange' },
  { label: '상시진행', color: 'green' },
  { label: '종료', color: 'rose' },
  { label: '제재', color: 'gray' },
]

export const BUTTON_VARIANTS: readonly ButtonVariant[] = ['dark', 'discord', 'light', 'ghost']

export const BUTTON_SIZES: readonly ButtonSize[] = ['sm', 'md', 'lg']

export const SURFACE_SAMPLES = [
  { label: '.glass (헤더 · CTA 링)', className: 'glass' },
  { label: '.glass-panel (푸터)', className: 'glass-panel' },
  { label: '.card-sheet (카테고리 카드)', className: 'card-sheet' },
] as const

export const TYPE_SCALE = [
  {
    label: 'Hero / H1 (64)',
    className: 'text-[clamp(32px,5vw,64px)] font-semibold tracking-[-0.056em]',
  },
  { label: 'Section / H2 (35)', className: 'text-[35px] font-semibold' },
  { label: 'Sub / 25', className: 'text-[25px] font-semibold opacity-50' },
  { label: 'Body / 22', className: 'text-[22px] font-semibold text-ink-muted' },
  { label: 'Body / 18', className: 'text-[18px]' },
  { label: 'Body / 16', className: 'text-[16px]' },
  { label: 'Caption / 12', className: 'text-[12px] text-ink-muted' },
] as const

export const RADIUS_SAMPLES = [
  { label: 'bar (10px)', className: 'rounded-bar' },
  { label: 'card (15px)', className: 'rounded-card' },
  { label: 'panel (20px)', className: 'rounded-panel' },
  { label: 'pill', className: 'rounded-pill' },
] as const
