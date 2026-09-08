/**
 * 문의에 운영자 답변을 하나 넣는다.
 *
 * 관리자 화면이 아직 없어서(별도 앱으로 개발 중) 답변 스레드를 실제 데이터로
 * 확인하려면 서비스 롤로 직접 넣는 수밖에 없다. E2E(`tests/e2e/support-inquiries.spec.ts`)
 * 가 이 스크립트를 그대로 호출한다.
 *
 *   node --env-file=.env.local tests/manual/inquiry-reply-insert.mjs <inquiryId> [본문]
 *
 * 키는 환경 변수에서만 읽고 출력에도 남기지 않는다.
 */
import { createClient } from '@supabase/supabase-js'

const [inquiryId, content = '문의 주신 내용 확인했습니다. 순차적으로 처리해 드리겠습니다.'] =
  process.argv.slice(2)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

if (!inquiryId) {
  console.error('사용법: node --env-file=.env.local tests/manual/inquiry-reply-insert.mjs <id>')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data, error } = await admin
  .from('inquiry_replies')
  .insert({ inquiry_id: inquiryId, author_name: '운영자', content })
  .select('id')
  .single()

if (error) {
  console.error(`답변 등록 실패: ${error.message}`)
  process.exit(1)
}

/* 답변이 달렸으면 상태도 함께 올린다. 운영자 도구가 하는 일을 그대로 흉내 낸다. */
const { error: statusError } = await admin
  .from('inquiries')
  .update({ status: 'answered', answered_at: new Date().toISOString() })
  .eq('id', inquiryId)

if (statusError) {
  console.error(`상태 갱신 실패: ${statusError.message}`)
  process.exit(1)
}

console.log(`OK ${data.id}`)
