# 인증 메일 템플릿

Supabase Auth 가 보내는 메일 본문이다. `supabase/config.toml` 의
`[auth.email.template.*]` 이 이 파일들을 가리키며, **`supabase config push` 를
실행해야** 원격 프로젝트에 반영된다(오너가 실행). 절차와 주의사항은
`docs/admin/EMAIL-AUTH-ACTIVATION.md` 를 본다.

| 파일                | 언제 나가나                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `confirmation.html` | 새 주소로 `signInWithOtp({ shouldCreateUser: true })` — 회원가입 1단계 |
| `magic-link.html`   | 이미 있는(미인증) 주소로 같은 요청을 다시 보냈을 때                    |
| `recovery.html`     | 비밀번호 찾기(`resetPasswordForEmail`)                                 |

세 템플릿 모두 **인증번호(`{{ .Token }}`)를 가장 크게** 싣는다. 화면이 번호를
입력받는 방식이라 링크는 보조 수단이다. 링크는 `{{ .TokenHash }}` 를 쓰는
`/auth/confirm` 형식이어야 서버 세션이 정상적으로 만들어진다
(`app/auth/confirm/route.ts`). `{{ .ConfirmationURL }}` 은 마지막 폴백으로만 둔다.
