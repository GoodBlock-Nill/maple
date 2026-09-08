# 테스트 계정 만들기

`seed.sql` 은 `postgres` 롤로 실행되지만 **`auth.users` 에 직접 INSERT 하지 않는다.**
비밀번호 해시 알고리즘·`auth.identities` 구조는 GoTrue 내부 구현이라 버전이 올라가면
직접 넣은 행이 깨진다. 그래서 계정은 항상 Auth API(또는 대시보드)로 만든다.

프로필 행은 `handle_new_user()` 트리거가 자동으로 만들어 주므로, 계정 생성 후
관리자 승격만 SQL 로 하면 된다.

| 계정        | 이메일              | 비밀번호         | 역할    |
| ----------- | ------------------- | ---------------- | ------- |
| 관리자      | `admin@example.com` | 로컬 전용 임시값 | `admin` |
| 일반 사용자 | `user@example.com`  | 로컬 전용 임시값 | `user`  |

> 비밀번호는 이 문서에 적지 않는다. 로컬에서 임의로 정하고, 스테이징/운영에서는
> 반드시 서로 다른 값을 쓴다.

---

## 1. 로컬 (supabase start)

```bash
# 1) 스택 기동 + 마이그레이션 + seed.sql 적용
supabase start
supabase db reset

# 2) 계정 생성 (anon 키는 `supabase status` 에 출력된다)
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_ANON_KEY="$(supabase status --output json | jq -r '.ANON_KEY')"

for EMAIL in admin@example.com user@example.com; do
  read -rsp "password for ${EMAIL}: " PASSWORD; echo
  curl -sS -X POST "${SUPABASE_URL}/auth/v1/signup" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"data\":{\"nickname\":\"${EMAIL%%@*}\"}}"
  echo
done
```

`config.toml` 의 `auth.email.enable_confirmations = false` 라서 로컬은 메일 확인 없이
바로 로그인된다. 확인 메일은 http://127.0.0.1:54324 (Inbucket) 에서도 볼 수 있다.

## 2. 클라우드 (대시보드)

`Authentication → Users → Add user → Create new user` 에서 두 계정을 만든다.
`Auto Confirm User` 를 켜야 메일 확인 없이 로그인된다.

## 3. 관리자 승격

계정 생성 뒤 SQL Editor(또는 `supabase db psql`)에서 실행한다.
`profiles.role` 은 RLS + `guard_profile_role()` 트리거로 보호되어 있어
**클라이언트에서는 절대 바꿀 수 없다.** 반드시 서비스 롤/DB 콘솔에서 실행해야 한다.

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'admin@example.com');

-- 확인
select p.id, u.email, p.nickname, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
 order by p.role desc, u.email;
```

## 4. 시드 게시물을 테스트 계정에 붙이기 (선택)

`seed.sql` 의 커뮤니티 글은 `author_id` 가 비어 있다(계정이 없어도 목록이 렌더되도록
`author_name` 스냅샷만 둔다). 작성자 권한(수정/삭제) 시나리오를 테스트하려면
일부 글의 소유자를 지정한다.

```sql
update public.posts
   set author_id = (select id from auth.users where email = 'user@example.com'),
       author_name = (select nickname from public.profiles p
                       join auth.users u on u.id = p.id
                      where u.email = 'user@example.com')
 where board = 'community'
   and id in (
     '22222222-0000-4000-8000-000000000001',
     '22222222-0000-4000-8000-000000000002',
     '22222222-0000-4000-8000-000000000003'
   );
```

## 5. 초기화

```bash
supabase db reset   # 마이그레이션 + seed.sql 재적용. auth.users 도 함께 비워진다.
```

`db reset` 은 계정까지 지우므로 위 1~4 단계를 다시 실행해야 한다.
