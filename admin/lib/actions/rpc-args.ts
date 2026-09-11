/**
 * RPC 인자에 null 을 실어 보낼 때 쓰는 통로.
 *
 * `supabase gen types` 는 함수 인자를 **전부 non-null** 로 내보낸다 — Postgres 함수의
 * 인자는 기본값이 있든 없든 NULL 을 받을 수 있는데, 생성기가 그 사실을 표현하지
 * 못한다. 호출부마다 `as unknown as T` 를 흩뿌리면 진짜 타입 오류까지 함께 가려지므로,
 * "여기서만 속인다"를 한 줄로 모아 둔다.
 *
 * 받는 쪽(SQL)이 null 을 어떻게 다루는지는 각 함수의 주석에 적혀 있어야 한다
 * (예: `add_inquiry_reply` 의 기대값은 null 이면 비교를 건너뛴다).
 */
export function nullableArg<TValue>(value: TValue | null): TValue {
  return value as TValue
}
