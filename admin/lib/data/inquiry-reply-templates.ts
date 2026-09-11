import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { COMMON_CATEGORY_LABEL } from '@/lib/validation/inquiry-reply-templates'

/**
 * 답변 템플릿 조회 계층 (`inquiry_reply_templates`, 마이그레이션 20260911000200).
 *
 * 세션 클라이언트로 읽는다. `inquiry_reply_templates_admin_all` 정책이 관리자에게만
 * 열려 있으므로, 권한이 사라지면 화면도 함께 비는 것이 맞다 — 서비스 롤로 읽으면
 * 그 검증이 통째로 사라진다.
 *
 * `category_id IS NULL` 이 **공통**이다. 목록은 공통 묶음을 늘 맨 위에 둔다 — 어느
 * 문의에서나 보이는 문안이라 운영자가 가장 먼저 확인해야 한다.
 */

const TEMPLATE_COLUMNS = 'id, category_id, name, body, sort_order, is_active, updated_at'

export type AdminInquiryReplyTemplate = {
  id: string
  /** NULL 이면 공통(모든 카테고리에서 보인다). */
  categoryId: string | null
  name: string
  body: string
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

/** 카테고리 한 묶음. 템플릿이 없는 카테고리도 자리를 남긴다(어디에 넣는지가 보여야 한다). */
export type InquiryReplyTemplateGroup = {
  categoryId: string | null
  label: string
  /** 비활성 카테고리인지. 머리글에 '숨김' 을 달아 "왜 답변 화면에 안 보이나"를 설명한다. */
  isCategoryActive: boolean
  templates: readonly AdminInquiryReplyTemplate[]
}

export type InquiryReplyTemplateListResult = {
  groups: readonly InquiryReplyTemplateGroup[]
  /** 조회가 깨졌는지. 빈 목록을 "템플릿이 없다"로 읽지 않도록 화면이 배너를 세운다. */
  hasError: boolean
}

/** 폼의 카테고리 셀렉트 옵션(비활성 포함 — 이미 그 카테고리에 붙은 템플릿을 고칠 수 있어야 한다). */
export type InquiryReplyTemplateCategory = {
  id: string
  label: string
  isActive: boolean
}

async function getTemplateCategories(): Promise<readonly InquiryReplyTemplateCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiry_categories')
    .select('id, label, is_active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error !== null || data === null) {
    console.error('[inquiry-reply-templates] 카테고리 조회 실패', error?.message)

    return []
  }

  return data.map((row) => ({ id: row.id, label: row.label, isActive: row.is_active }))
}

function toTemplate(row: {
  id: string
  category_id: string | null
  name: string
  body: string
  sort_order: number
  is_active: boolean
  updated_at: string
}): AdminInquiryReplyTemplate {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    body: row.body,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }
}

/** 관리 화면 목록 — 공통 묶음 + 카테고리 순서대로. */
export async function getInquiryReplyTemplates(): Promise<InquiryReplyTemplateListResult> {
  const supabase = await createClient()
  const [{ data, error }, categories] = await Promise.all([
    supabase
      .from('inquiry_reply_templates')
      .select(TEMPLATE_COLUMNS)
      .order('sort_order', { ascending: true })
      // sort_order 가 같으면 먼저 만든 쪽을 위에 둔다(답변 화면의 선택 상자와 같은 순서).
      .order('created_at', { ascending: true }),
    getTemplateCategories(),
  ])

  if (error !== null || data === null) {
    console.error('[inquiry-reply-templates] 목록 조회 실패', error?.message)

    return { groups: [], hasError: true }
  }

  const templates = data.map(toTemplate)
  const groups: InquiryReplyTemplateGroup[] = [
    {
      categoryId: null,
      label: COMMON_CATEGORY_LABEL,
      isCategoryActive: true,
      templates: templates.filter((template) => template.categoryId === null),
    },
    ...categories.map((category) => ({
      categoryId: category.id,
      label: category.label,
      isCategoryActive: category.isActive,
      templates: templates.filter((template) => template.categoryId === category.id),
    })),
  ]

  return { groups, hasError: false }
}

export async function getInquiryReplyTemplateCategories(): Promise<
  readonly InquiryReplyTemplateCategory[]
> {
  return getTemplateCategories()
}

/** 새 템플릿을 그 묶음의 맨 뒤에 붙이기 위한 다음 순번. */
export async function getNextInquiryReplyTemplateSortOrder(
  categoryId: string | null,
): Promise<number> {
  const supabase = await createClient()
  const query = supabase
    .from('inquiry_reply_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const { data, error } =
    categoryId === null
      ? await query.is('category_id', null).maybeSingle()
      : await query.eq('category_id', categoryId).maybeSingle()

  if (error !== null || data === null) {
    return 0
  }

  return data.sort_order + 1
}

/** 답변 화면의 선택지. 문의 카테고리 라벨로 찾는다(`inquiries.category` 는 라벨 문자열이다). */
export type InquiryReplyTemplateOption = {
  id: string
  name: string
  body: string
  /** 공통 템플릿인지. 선택 상자에서 묶음 머리글을 가른다. */
  isCommon: boolean
}

/**
 * 이 문의에서 쓸 수 있는 템플릿 — 공통 + 같은 카테고리, **활성만**.
 *
 * 카테고리는 라벨로 찾는다. 등록된 카테고리가 없는 옛 라벨('계정' 등)이나 이메일
 * 문의('general')면 공통 템플릿만 남는다 — 그 경우에도 불러오기를 감추지 않는다.
 */
export async function getInquiryReplyTemplateOptions(
  categoryLabel: string,
): Promise<readonly InquiryReplyTemplateOption[]> {
  const supabase = await createClient()
  const { data: category } = await supabase
    .from('inquiry_categories')
    .select('id')
    .eq('label', categoryLabel)
    .maybeSingle()

  const base = supabase
    .from('inquiry_reply_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const { data, error } =
    category === null
      ? await base.is('category_id', null)
      : await base.or(`category_id.is.null,category_id.eq.${category.id}`)

  if (error !== null || data === null) {
    console.error('[inquiry-reply-templates] 답변 템플릿 조회 실패', error?.message)

    return []
  }

  /* 공통을 앞에 둔다. '접수 확인 안내' 처럼 어느 문의에서나 먼저 찾는 문안이라
     카테고리 전용 문안보다 위에 있어야 한다. */
  return data
    .map(toTemplate)
    .sort((left, right) => {
      const byGroup = Number(left.categoryId !== null) - Number(right.categoryId !== null)

      return byGroup !== 0 ? byGroup : left.sortOrder - right.sortOrder
    })
    .map((template) => ({
      id: template.id,
      name: template.name,
      body: template.body,
      isCommon: template.categoryId === null,
    }))
}
