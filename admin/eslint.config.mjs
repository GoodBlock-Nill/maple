import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /* `const { variant, ...rest } = props` 처럼 **남기지 않을 prop 을 걷어내는**
         구조분해가 컴포넌트마다 나온다. 이 용법까지 미사용 변수로 잡으면 경고가
         구조적으로 사라지지 않는다. 실제 미사용은 계속 잡되 rest 형제만 예외로 둔다. */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // supabase gen types 산출물. 손으로 고치지 않으므로 검사 대상이 아니다.
    'types/database.types.ts',
  ]),
])

export default eslintConfig
