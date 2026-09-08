import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Enums as DatabaseEnums } from '@/types/database.types'

/**
 * `Database` 를 직접 인덱싱하는 코드가 앱 전체에 퍼지면 `supabase gen types` 로
 * 스키마 타입을 교체할 때 수정 지점이 폭발한다. 접근은 이 파일의 별칭으로만 한다.
 */

export type PublicSchema = Database['public']

export type TableName = keyof PublicSchema['Tables']

export type Tables<TName extends TableName> = PublicSchema['Tables'][TName]['Row']

export type TablesInsert<TName extends TableName> = PublicSchema['Tables'][TName]['Insert']

export type TablesUpdate<TName extends TableName> = PublicSchema['Tables'][TName]['Update']

export type Enums<TName extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][TName]

/* 자주 쓰는 행 타입 단축 별칭. */
export type Profile = Tables<'profiles'>
export type PostRow = Tables<'posts'>
export type CommentRow = Tables<'comments'>
export type InquiryRow = Tables<'inquiries'>
export type ReportRow = Tables<'reports'>
export type AdminInviteRow = Tables<'admin_invites'>
export type AuditLogRow = Tables<'audit_logs'>

/** 프로필의 역할 (user_role enum). */
export type UserRole = DatabaseEnums<'user_role'>

/** 앱 전역에서 쓰는 스키마 바인딩 클라이언트 타입. */
export type TypedSupabaseClient = SupabaseClient<Database>
