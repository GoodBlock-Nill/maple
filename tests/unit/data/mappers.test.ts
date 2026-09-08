import { describe, expect, it } from 'vitest'

import {
  toAdjacentNewsItem,
  toComment,
  toFaqItem,
  toGachaItem,
  toNewsItem,
  toPost,
  toRankingEntry,
  toSiteSettings,
} from '@/lib/data/mappers'

import type { AdjacentNewsSource, CommentSource, NewsSource, PostSource } from '@/lib/data/mappers'
import type { FaqRow, GachaItemRow, RankingRow, SiteSettings } from '@/lib/supabase/types'

const newsRow: NewsSource = {
  id: '11111111-0000-4000-8000-000000000001',
  category_key: 'notice',
  title: '서버 불안정 안내',
  summary: '접속 지연 현상을 확인하고 있습니다.',
  content: '# 본문',
  thumbnail_url: null,
  view_count: 160745,
  published_at: '2026-05-19T10:00:00.000Z',
}

const postRow: PostSource = {
  id: '22222222-0000-4000-8000-000000000001',
  category_key: 'chat',
  title: '오늘 길드 사냥 같이 가실 분',
  content: '<p>본문</p>',
  content_format: 'html',
  author_id: 'aaaaaaaa-0000-4000-8000-000000000001',
  author_name: 'cinnamon',
  view_count: 120,
  like_count: 7,
  comment_count: 3,
  created_at: '2026-05-19T10:00:00.000Z',
  edited_at: null,
}

describe('toNewsItem', () => {
  it('should map snake_case columns to the domain shape', () => {
    // Arrange & Act
    const result = toNewsItem(newsRow)

    // Assert
    expect(result).toEqual({
      id: newsRow.id,
      category: 'notice',
      title: newsRow.title,
      summary: newsRow.summary,
      body: newsRow.content,
      views: 160745,
      publishedAt: newsRow.published_at,
    })
  })

  it('should omit the thumbnail key when the column is null', () => {
    // Arrange & Act
    const result = toNewsItem(newsRow)

    // Assert — 값이 undefined 인 키가 아니라 키 자체가 없어야 한다.
    expect('thumbnail' in result).toBe(false)
  })

  it('should expose the thumbnail when the column has a value', () => {
    // Arrange & Act
    const result = toNewsItem({ ...newsRow, thumbnail_url: '/images/news/1.png' })

    // Assert
    expect(result.thumbnail).toBe('/images/news/1.png')
  })

  it('should fall back to an empty summary when the column is null', () => {
    // Arrange & Act
    const result = toNewsItem({ ...newsRow, summary: null })

    // Assert
    expect(result.summary).toBe('')
  })

  it('should fall back to the first category when the key is unknown', () => {
    // Arrange & Act — 관리자가 새 말머리를 만들면 프론트 상수보다 먼저 DB 에 생긴다.
    const result = toNewsItem({ ...newsRow, category_key: 'unknown' })

    // Assert
    expect(result.category).toBe('notice')
  })
})

describe('toAdjacentNewsItem', () => {
  const adjacentRow: AdjacentNewsSource = {
    id: '11111111-0000-4000-8000-000000000002',
    category_key: 'patch',
    title: '9월 정기 점검 안내',
    published_at: '2026-05-12T10:00:00.000Z',
  }

  it('should map only the columns an adjacent-post link needs', () => {
    // Arrange & Act
    const result = toAdjacentNewsItem(adjacentRow)

    // Assert
    expect(result).toEqual({
      id: adjacentRow.id,
      category: 'patch',
      title: adjacentRow.title,
      publishedAt: adjacentRow.published_at,
    })
  })

  it('should fall back to the first category when the key is unknown', () => {
    // Arrange & Act — 관리자가 새 말머리를 만들면 프론트 상수보다 먼저 DB 에 생긴다.
    const result = toAdjacentNewsItem({ ...adjacentRow, category_key: 'unknown' })

    // Assert
    expect(result.category).toBe('notice')
  })
})

describe('toPost', () => {
  it('should carry the denormalized comment count when mapping a list row', () => {
    // Arrange & Act
    const result = toPost(postRow)

    // Assert
    expect(result.commentCount).toBe(3)
    expect(result.comments).toEqual([])
  })

  it('should carry the stored content format so the detail view can pick a renderer', () => {
    // Arrange & Act
    const result = toPost({ ...postRow, content: '# 옛 글', content_format: 'markdown' })

    // Assert
    expect(result.contentFormat).toBe('markdown')
    expect(result.body).toBe('# 옛 글')
  })

  it('should attach comments when they are provided for the detail view', () => {
    // Arrange
    const commentRow: CommentSource = {
      id: '33333333-0000-4000-8000-000000000001',
      author_id: 'aaaaaaaa-0000-4000-8000-000000000002',
      author_name: 'moonlight',
      content: '좋은 글이네요',
      created_at: '2026-05-19T11:00:00.000Z',
    }

    // Act
    const result = toPost(postRow, [toComment(commentRow)])

    // Assert
    expect(result.comments).toHaveLength(1)
    expect(result.comments[0]?.author).toBe('moonlight')
  })

  it('should fall back to the first category when the key is unknown', () => {
    // Arrange & Act
    const result = toPost({ ...postRow, category_key: 'nope' })

    // Assert
    expect(result.category).toBe('chat')
  })
})

describe('toGachaItem', () => {
  const gachaRow: GachaItemRow = {
    id: '55555555-0000-4000-8000-000000000001',
    tab: 'premium',
    name: '전설의 용사 뱃지',
    icon_url: '/images/guide/icon-item-1.png',
    probability: 0.01,
    rows: [
      {
        grade: 'SS',
        itemName: '핑크빈 펫(영구)',
        itemIcon: '/images/guide/icon-item-1.png',
        probability: '0.05',
        note: '-',
      },
    ],
    published_at: '2026-05-19T10:00:00.000Z',
    is_published: true,
    created_at: '2026-05-19T10:00:00.000Z',
    updated_at: '2026-05-19T10:00:00.000Z',
  }

  it('should format the headline probability to two decimals', () => {
    // Arrange & Act
    const result = toGachaItem(gachaRow)

    // Assert
    expect(result.probability).toBe('0.01')
  })

  it('should keep the detail table rows when the jsonb payload is well formed', () => {
    // Arrange & Act
    const result = toGachaItem(gachaRow)

    // Assert
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.grade).toBe('SS')
  })

  it('should return an empty table when the jsonb payload is not an array', () => {
    // Arrange & Act
    const result = toGachaItem({ ...gachaRow, rows: { broken: true } })

    // Assert
    expect(result.rows).toEqual([])
  })

  it('should drop unknown grades to the lowest grade', () => {
    // Arrange & Act
    const result = toGachaItem({
      ...gachaRow,
      rows: [{ grade: 'ZZ', itemName: 'x', itemIcon: 'y', probability: '1', note: '' }],
    })

    // Assert
    expect(result.rows[0]?.grade).toBe('C')
  })

  it('should borrow the first table icon when the item icon is null', () => {
    // Arrange & Act
    const result = toGachaItem({ ...gachaRow, icon_url: null })

    // Assert
    expect(result.icon).toBe('/images/guide/icon-item-1.png')
  })
})

describe('toRankingEntry', () => {
  const rankingRow: RankingRow = {
    id: '66666666-0000-4000-8000-000000000001',
    rank_type: 'total',
    rank: 1,
    character_name: '설윤',
    avatar_url: '/images/ranking/top3-char-1.png',
    level: 212,
    job: '비숍',
    job_group: 'adventurer',
    guild: 'MapleStar',
    guild_icon_url: null,
    exp: '98.7B',
    snapshot_at: '2026-05-19T10:00:00.000Z',
    created_at: '2026-05-19T10:00:00.000Z',
  }

  it('should map the character columns to the domain shape', () => {
    // Arrange & Act
    const result = toRankingEntry(rankingRow)

    // Assert
    expect(result.nickname).toBe('설윤')
    expect(result.jobGroup).toBe('adventurer')
    expect(result.character).toBe('/images/ranking/top3-char-1.png')
  })

  it('should omit the character key when there is no avatar', () => {
    // Arrange & Act
    const result = toRankingEntry({ ...rankingRow, avatar_url: null })

    // Assert
    expect('character' in result).toBe(false)
  })

  it('should show a dash when the experience column is empty', () => {
    // Arrange & Act
    const result = toRankingEntry({ ...rankingRow, exp: null })

    // Assert
    expect(result.exp).toBe('-')
  })

  it('should keep a null guild so the guild ranking can filter it out', () => {
    // Arrange & Act
    const result = toRankingEntry({ ...rankingRow, guild: null })

    // Assert
    expect(result.guild).toBeNull()
  })
})

describe('toFaqItem', () => {
  it('should map the faq columns to the domain shape', () => {
    // Arrange
    const faqRow: FaqRow = {
      id: '44444444-0000-4000-8000-000000000001',
      category: 'notice',
      question: '글자월드는 어떤 서비스인가요?',
      answer: '공식 홈페이지입니다.',
      sort_order: 1,
      is_published: true,
      created_at: '2026-05-19T10:00:00.000Z',
      updated_at: '2026-05-19T10:00:00.000Z',
    }

    // Act
    const result = toFaqItem(faqRow)

    // Assert
    expect(result).toEqual({
      id: faqRow.id,
      category: 'notice',
      question: faqRow.question,
      answer: faqRow.answer,
    })
  })
})

describe('toSiteSettings', () => {
  it('should keep nullable placeholders as null so callers can fall back', () => {
    // Arrange
    const row: SiteSettings = {
      id: 1,
      game_name: '글자월드',
      world_id: null,
      discord_url: null,
      youtube_url: null,
      contact_email: 'contact@example.com',
      ip_notice: null,
      copyright: null,
      creator_name: '세글자',
      creator_slogan: null,
      creator_intro: null,
      creator_photo_url: null,
      updated_at: '2026-05-19T10:00:00.000Z',
    }

    // Act
    const result = toSiteSettings(row)

    // Assert
    expect(result.gameName).toBe('글자월드')
    expect(result.creatorName).toBe('세글자')
    expect(result.youtubeUrl).toBeNull()
  })
})
