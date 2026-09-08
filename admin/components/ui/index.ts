/**
 * 관리자 공용 UI 프리미티브의 단일 진입점.
 * 2단계에서 각 모듈이 여기서만 가져다 쓰면 화면 간 표기가 어긋나지 않는다.
 */
export { Badge, type BadgeTone } from '@/components/ui/Badge'
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from '@/components/ui/Button'
export { Card, CardBody, CardHeader } from '@/components/ui/Card'
export { Dialog } from '@/components/ui/Dialog'
export { EmptyState } from '@/components/ui/EmptyState'
export {
  CONTROL_CLASS,
  CONTROL_INVALID_CLASS,
  FormBanner,
  FormError,
  FormField,
  type FieldRenderProps,
} from '@/components/ui/FormField'
export { Input } from '@/components/ui/Input'
export { PageHeader } from '@/components/ui/PageHeader'
export { Pagination } from '@/components/ui/Pagination'
export { Select, type SelectOption } from '@/components/ui/Select'
export { Skeleton } from '@/components/ui/Skeleton'
export { StatCard, type StatTone } from '@/components/ui/StatCard'
export { Table, type Column, type ColumnAlign } from '@/components/ui/Table'
export { Textarea } from '@/components/ui/Textarea'
export { ToastProvider, useToast, type ToastTone } from '@/components/ui/Toast'
