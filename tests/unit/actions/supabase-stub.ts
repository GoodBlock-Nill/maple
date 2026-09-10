import { vi } from 'vitest'

/**
 * 서버 액션 테스트용 Supabase 클라이언트 스텁.
 *
 * postgrest 빌더는 체이닝이라 모든 중간 메서드가 자기 자신을 돌려주면 되고,
 * 종단 메서드(`maybeSingle`/`single`/`then`)만 준비된 결과를 순서대로 내보내면
 * 실제 네트워크 없이 쿼리 흐름을 검증할 수 있다.
 */

export type StubResult = { data: unknown; error: unknown }

export type StorageUpload = { bucket: string; path: string; contentType: string | undefined }

export type SupabaseStub = {
  client: {
    from: (table: string) => unknown
    rpc: (name: string, args: unknown) => Promise<StubResult>
    storage: { from: (bucket: string) => unknown }
    auth: {
      /** 기본값은 "미로그인". 필요한 테스트에서 mockResolvedValue 로 덮어쓴다. */
      getUser: ReturnType<typeof vi.fn>
      signInAnonymously: ReturnType<typeof vi.fn>
      verifyOtp: ReturnType<typeof vi.fn>
      signInWithPassword: ReturnType<typeof vi.fn>
      signOut: ReturnType<typeof vi.fn>
      updateUser: ReturnType<typeof vi.fn>
    }
  }
  /** `rpc()` 호출 순서 — 함수 이름과 인자. */
  rpcCalls: { name: string; args: unknown }[]
  /** 스토리지 업로드 순서. */
  uploads: StorageUpload[]
  /** 스토리지 삭제 대상(경로 배열) 순서. */
  removals: string[][]
  /** 다음 업로드가 돌려줄 오류. null 이면 성공. */
  uploadError: { message: string } | null
  /** `from()` 에 넘어온 테이블 이름 순서. */
  tables: string[]
  /** `insert()` 에 넘어온 payload 순서. */
  inserts: unknown[]
  /** `update()` 에 넘어온 payload 순서. */
  updates: unknown[]
  /** `delete()` 호출 뒤 이어진 `eq()` 필터. 삭제 대상 확인용. */
  deletes: Record<string, unknown>[]
  /** `order()` 에 넘어온 `[column, options]` 호출 순서. 동률 정렬 키 검증용. */
  orders: [string, unknown][]
}

const EMPTY_RESULT: StubResult = { data: null, error: null }

export function createSupabaseStub(results: readonly StubResult[] = []): SupabaseStub {
  const tables: string[] = []
  const inserts: unknown[] = []
  const updates: unknown[] = []
  const deletes: Record<string, unknown>[] = []
  const orders: [string, unknown][] = []
  const rpcCalls: { name: string; args: unknown }[] = []
  const uploads: StorageUpload[] = []
  const removals: string[][] = []
  let cursor = 0

  const nextResult = (): StubResult => results[cursor++] ?? EMPTY_RESULT

  function createBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    /* `delete()` 이후의 `eq()` 만 삭제 조건이다. 그 전의 `eq()` 는 평범한 조회 필터라
       기록하지 않는다(조회는 결과 큐로 검증한다). */
    let deleteFilter: Record<string, unknown> | null = null

    for (const method of ['select', 'is', 'not', 'ilike', 'limit', 'range']) {
      builder[method] = () => builder
    }

    builder.order = (column: string, options: unknown) => {
      orders.push([column, options])

      return builder
    }

    builder.eq = (column: string, value: unknown) => {
      if (deleteFilter !== null) {
        deleteFilter[column] = value
      }

      return builder
    }

    builder.delete = () => {
      deleteFilter = {}
      deletes.push(deleteFilter)

      return builder
    }

    builder.insert = (payload: unknown) => {
      inserts.push(payload)

      return builder
    }

    builder.update = (payload: unknown) => {
      updates.push(payload)

      return builder
    }

    builder.maybeSingle = async () => nextResult()
    builder.single = async () => nextResult()
    // await 로 종단 처리되는 목록 쿼리(`.range(...)`)를 위한 thenable.
    builder.then = (resolve: (value: StubResult) => unknown) =>
      Promise.resolve(nextResult()).then(resolve)

    return builder
  }

  const stub: SupabaseStub = {
    client: {
      from: (table: string) => {
        tables.push(table)

        return createBuilder()
      },
      rpc: async (name: string, args: unknown) => {
        rpcCalls.push({ name, args })

        return nextResult()
      },
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _file: unknown, options?: { contentType?: string }) => {
            uploads.push({ bucket, path, contentType: options?.contentType })

            return { data: { path }, error: stub.uploadError }
          },
          remove: async (paths: string[]) => {
            removals.push(paths)

            return { data: [], error: null }
          },
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://stub.supabase.co/storage/v1/object/public/${bucket}/${path}`,
            },
          }),
          list: async () => ({ data: [], error: null }),
        }),
      },
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
        signInAnonymously: vi.fn(async () => nextResult()),
        verifyOtp: vi.fn(async () => nextResult()),
        signInWithPassword: vi.fn(async () => nextResult()),
        signOut: vi.fn(async () => nextResult()),
        updateUser: vi.fn(async () => nextResult()),
      },
    },
    tables,
    inserts,
    updates,
    deletes,
    orders,
    rpcCalls,
    uploads,
    removals,
    uploadError: null,
  }

  return stub
}
