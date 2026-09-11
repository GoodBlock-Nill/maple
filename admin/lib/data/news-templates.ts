import 'server-only'

import {
  NEWS_CATEGORY_KEYS,
  newsCategoryLabel,
  newsCategoryTone,
  type NewsCategoryKey,
} from '@/lib/constants/news'
import { newsTemplateSeed, type NewsTemplateSeed } from '@/lib/constants/news-templates'
import { createClient } from '@/lib/supabase/server'

import type { BadgeTone } from '@/components/ui/Badge'
import type { NewsTemplate } from '@/lib/utils/news-template-prefill'

/**
 * 카테고리 템플릿 조회 (`news_category_templates`).
 *
 * 세션 클라이언트로 읽는다 — 서비스 롤을 쓰면 `news_category_templates_admin_all` 정책이
 * 건너뛰어져, 권한이 사라진 계정에도 문안이 계속 보인다.
 *
 * **화면은 언제나 카테고리 6종을 모두 보여 준다.** DB 에 행이 없는 카테고리(시드 이후에 추가된
 * 카테고리)는 코드 상수의 기본 템플릿으로 채워 넣는다. 행이 없다고 카드가 사라지면 운영자는
 * 그 카테고리에 템플릿을 만들 입구를 잃는다.
 */

const COLUMNS =
  'id, category_key, title_template, summary_template, body_template, is_active, updated_at'

export type AdminNewsTemplate = {
  /** DB 행 id. 아직 저장된 적이 없으면 null(코드 기본값을 그리는 중이다). */
  id: string | null
  categoryKey: NewsCategoryKey
  label: string
  tone: BadgeTone
  title: string
  summary: string
  /** Tiptap HTML. */
  body: string
  isActive: boolean
  /** 지금 문안이 시드(코드 기본값)와 같은가. '기본값으로 되돌리기' 의 노출 조건이다. */
  isDefault: boolean
  updatedAt: string | null
}

export type NewsTemplateListResult = {
  rows: readonly AdminNewsTemplate[]
  /** 조회가 깨졌는지. true 면 비어 있는 목록이 "템플릿 없음"이 아니다. */
  hasError: boolean
}

type TemplateRow = {
  id: string
  category_key: string
  title_template: string
  summary_template: string
  body_template: string
  is_active: boolean
  updated_at: string
}

function isSameAsSeed(
  seed: NewsTemplateSeed,
  value: { title: string; summary: string; body: string },
): boolean {
  return seed.title === value.title && seed.summary === value.summary && seed.body === value.body
}

/** 저장된 행이 없는 카테고리는 코드 기본값으로 그린다(id 가 null 인 것이 그 표시다). */
function fromSeed(category: NewsCategoryKey): AdminNewsTemplate {
  const seed = newsTemplateSeed(category)

  return {
    id: null,
    categoryKey: category,
    label: newsCategoryLabel(category),
    tone: newsCategoryTone(category),
    title: seed.title,
    summary: seed.summary,
    body: seed.body,
    isActive: true,
    isDefault: true,
    updatedAt: null,
  }
}

function fromRow(category: NewsCategoryKey, row: TemplateRow): AdminNewsTemplate {
  const value = {
    title: row.title_template,
    summary: row.summary_template,
    body: row.body_template,
  }

  return {
    id: row.id,
    categoryKey: category,
    label: newsCategoryLabel(category),
    tone: newsCategoryTone(category),
    ...value,
    isActive: row.is_active,
    isDefault: isSameAsSeed(newsTemplateSeed(category), value),
    updatedAt: row.updated_at,
  }
}

/** 카테고리 6종 × (저장된 행 ?? 코드 기본값). 순서는 `NEWS_CATEGORY_KEYS` 를 따른다. */
export async function listNewsTemplates(): Promise<NewsTemplateListResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('news_category_templates').select(COLUMNS)

  if (error !== null) {
    /* 빈 목록 + 배너로 알린다. 여기서 코드 기본값을 대신 그리면 운영자는 저장된 문안을
       보고 있다고 믿게 되고, 그 화면에서 고친 값이 남의 문안을 덮어쓴다. */
    console.error('[news-templates] 목록 조회 실패', error.message)

    return { rows: [], hasError: true }
  }

  const byCategory = new Map((data ?? []).map((row) => [row.category_key, row]))

  return {
    rows: NEWS_CATEGORY_KEYS.map((category) => {
      const row = byCategory.get(category)

      return row === undefined ? fromSeed(category) : fromRow(category, row)
    }),
    hasError: false,
  }
}

/** 편집 화면의 단건. 저장된 행이 없으면 코드 기본값을 연다. */
export async function getNewsTemplate(category: NewsCategoryKey): Promise<AdminNewsTemplate> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('news_category_templates')
    .select(COLUMNS)
    .eq('category_key', category)
    .maybeSingle()

  if (error !== null || data === null) {
    return fromSeed(category)
  }

  return fromRow(category, data)
}

/**
 * 작성·수정 폼에 실어 보낼 목록.
 *
 * 조회가 깨지면 **빈 배열**이다 — 그 경우 카테고리를 골라도 아무 일도 일어나지 않는다.
 * 코드 기본값으로 대신 채우면, 운영자가 꺼 둔 템플릿이 장애 중에만 되살아난다.
 */
export async function listNewsTemplateOptions(): Promise<readonly NewsTemplate[]> {
  const { rows, hasError } = await listNewsTemplates()

  if (hasError) {
    return []
  }

  return rows.map((row) => ({
    categoryKey: row.categoryKey,
    title: row.title,
    summary: row.summary,
    body: row.body,
    isActive: row.isActive,
  }))
}
