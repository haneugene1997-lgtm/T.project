# Cursor 작업 지시서 + Vercel 배포 커맨드

> 이 문서는 `DESIGN_SYSTEM.md`를 실제 코드에 반영하기 위한 Cursor 복붙용 프롬프트와 Vercel 배포 커맨드 모음입니다. 각 블록은 그대로 복사해서 Cursor Chat(⌘L / Ctrl+L)에 붙여넣으면 됩니다.

---

## ⚠️ 레포 구분 (반드시 읽기)

| 항목 | **`T.Project/` (이 폴더)** | **`T.Project.remote/`** (GitHub `T.project` → t-project-pi 등) |
|------|---------------------------|------------------------------------------------------------------|
| 스택 | React 18 + **Vite 6** | React 18 + **Next.js 14** |
| UI 진입 | `src/SKTLegalChat.jsx`, `src/main.jsx` | **`app/page.js`** (대화 UI가 여기) |
| API | `api/chat.js` (문서 기준: Edge + Anthropic) | **`app/api/chat/route.js`** (Node, **Gemini**) |
| 빌드 | `npm run build` → `dist/` | `next build` → `.next/` |
| Vercel | `vercel.json` + `outputDirectory: dist` 사용 가능 | **루트 `api/chat.js` + Vite용 `vercel.json`을 두지 말 것** — Next `app/api`와 경로 충돌 시 `/api/chat` 오동작 |

- **디자인 시스템 리팩터는 `T.Project`를 Cursor 워크스페이스 루트로 연 뒤** 이 지시서를 쓰는 것이 문서와 일치합니다.
- **`DESIGN_SYSTEM.md` 경로:** `T.Project/DESIGN_SYSTEM.md`
- **프로덕션 배포용 원격 레포**가 `T.Project.remote`라면, API/환경변수는 **`GEMINI_API_KEY`**, 선택 **`GEMINI_MODEL`** 기준으로 따로 맞춥니다. (`ANTHROPIC_API_KEY`는 Anthropic 프록시용 `T.Project` 쪽.)

---

## 0. Cursor에 먼저 넣을 "컨텍스트 프롬프트"

매 세션 맨 처음 한 번만 넣어주세요. 이후 프롬프트가 이 컨텍스트를 전제로 합니다.

```text
당신은 SKT 법무 컴플라이언스 에이전트(React 18 + Vite + Vercel Edge) 프론트엔드 리팩터를 돕는 시니어 프론트엔드 엔지니어입니다.

레포 구조:

- src/SKTLegalChat.jsx  (약 900줄, 전체 UI 단일 파일)
- src/App.jsx, src/main.jsx
- api/chat.js  (Vercel Edge: Anthropic API 프록시)
- vercel.json  (buildCommand, outputDirectory=dist)
- package.json (의존성은 react/react-dom + vite만, 최소 구성)

설계 기준서:

- 프로젝트 루트의 DESIGN_SYSTEM.md 를 단일 기준으로 삼는다.
- 벤치마크는 Google Gemini + Claude. 과한 효과는 피하고 절제된 톤 유지.

코딩 규칙:

1. TypeScript로 마이그레이션 금지 (JSX 유지). 추가 의존성은 최소화.
2. 기존 동작(대화·문서분석·PDF/JSON 다운로드·히스토리 localStorage)은 절대 깨지지 않게 한다.
3. 인라인 스타일은 단계적으로 CSS 변수로 이관한다. 한번에 전부 바꾸지 않는다.
4. 새 컴포넌트는 src/components/ 에 파일 하나씩, 250줄 이하.
5. 한국어 UI 문구는 DESIGN_SYSTEM.md 부록 C 마이크로카피를 따른다.
6. 접근성: focus-visible 링, aria-label, 키보드 네비게이션 포함.
7. 커밋 메시지는 Conventional Commits (feat/fix/refactor/chore).

응답 방식:

- 변경이 필요한 파일 목록을 먼저 제시하고 승인 후 코드를 편집한다.
- 큰 변경은 diff 설명을 붙인다.
- 테스트가 없어도, 수동 확인 체크리스트를 마지막에 한국어로 준다.
```

---

## 1. Phase 1 — 디자인 토큰 추출 (1~2일)

### 1-1. 테마 프로바이더 만들기

`DESIGN_SYSTEM.md` §4(디자인 토큰)과 부록 A(매핑 테이블)를 기준으로 아래 작업을 해줘.

1. `src/theme/tokens.css` 생성 — `:root`에 다크 테마 CSS 변수, `[data-theme="light"]`에 라이트 테마. 값은 §4 다크/라이트 컬럼 그대로.
2. `src/theme/ThemeProvider.jsx` 생성 — `useTheme()`, `<ThemeProvider>`, 기본 `dark`, `localStorage('skt-legal-theme')`, `prefers-color-scheme` 감지.
3. `src/main.jsx` 수정 — `tokens.css` import, `<App />`를 `<ThemeProvider>`로 감싸기.
4. `src/SKTLegalChat.jsx`는 이번에 손대지 않는다. (다음 단계에서 치환)

완료 후 수동 확인 체크리스트를 한국어로 만들어줘.

### 1-2. 하드코딩 값 일괄 치환

`src/SKTLegalChat.jsx` 안의 인라인 스타일에서 아래를 순차적으로 CSS 변수로 교체. 기능·시각 동일 유지.

| 기존 | 변수 |
|------|------|
| `#08080d` | `var(--bg-base)` |
| `#e5e5ea` | `var(--text-primary)` |
| `#a0a0a8` | `var(--text-secondary)` |
| `#636366` | `var(--text-tertiary)` |
| `#48484a` | `var(--text-disabled)` |
| `#007aff` | `var(--brand-500)` |
| `#5e5ce6`, `#5856d6` | `var(--brand-600)` |
| `rgba(255,255,255,0.03)` | `var(--bg-elev-1)` |
| `rgba(255,255,255,0.06)` | `var(--border-subtle)` |
| `#ff3b30` | `var(--risk-high)` |
| `#ff9f0a` | `var(--risk-med)` |
| `#30d158` | `var(--risk-low)` |
| `linear-gradient(135deg,#007aff,#5e5ce6)` | `var(--brand-grad)` |

`RC`, `VT`, `glass()`도 CSS 변수 사용. `LEGAL_DB`의 `law.color`는 토큰 매핑 없이 유지.

변경 후 `npm run build` 통과 확인 명령을 같이 알려줘.

### 1-3. Lint 룰

`eslint-plugin-react` 기반으로 인라인 스타일의 리터럴 hex / rgb(a) 경고 루 추가. `var(--…)` 허용. 기존 위반은 `warn`. `package.json` devDependency, `.eslintrc.cjs` 생성.

---

## 2. Phase 2 — 핵심 컴포넌트 추출 (2~3일)

### 2-1. Button / IconButton

`DESIGN_SYSTEM.md` §5.1 기준으로 `src/components/Button.jsx`, `src/components/IconButton.jsx` 생성.

- variant: `primary` | `secondary` | `ghost`
- size: `sm(32)` | `md(40)` | `lg(48)`
- props: `leadingIcon`, `loading`, `disabled`, `aria-label`
- states: default, hover, focus-visible(2px outline), active(scale .98), loading, disabled
- IconButton은 `aria-label` 필수 (미지정 시 `console.warn`)
- 스타일: 인라인 + CSS 변수

`SKTLegalChat.jsx`에서 이번 PR에는 3곳만 교체: **「대화로 돌아가기」→ ghost**, **「PDF 리포트」→ secondary**, **「JSON」→ secondary**.

### 2-2. Composer

§5.2 기준 `src/components/Composer.jsx`: AttachmentStrip, textarea(1~8줄), toolbar. props: `value`, `onChange`, `onSubmit`, `onAttach`, `mode`, `disabled`, `maxFiles=5`. 키보드: Enter 전송, Shift+Enter 줄바꿈, Cmd/Ctrl+U 첨부, Esc 취소. 기존 단일 파일·10MB·확장자 유지, `maxFiles`는 props만.

### 2-3. MessageBubble, RiskBadge, RiskCard, LawChip, AttachmentChip, ScoreGauge

`src/components/`에 분리 생성, 동작 1:1. 한 컴포넌트씩 커밋 + 시각 회귀 체크리스트.

---

## 3. Phase 3 — Drawer 분할 & Suggestion & Sensitive (3~5일)

§6.2 Split-Pane, §6.3 Re-Ask, §5.2 Sensitive — 문서 절차대로. `src/lib/sensitive.js`, `PreShareGate` 등은 원문 지시에 따름.

---

## 4. Phase 4 — Pre-Share, Projects, Command Palette (3~5일)

§6.4 Pre-Share Gate, §3.2 Projects MVP, Cmd+K 팔레트 — 원문 지시에 따름.

---

## 5. Phase 5 — 접근성 · Light · 품질 (1~2일)

§8 체크리스트, `@playwright/test` 스모크 3개, README 업데이트.

---

## 6. Vercel 배포 커맨드 (복붙용)

### 6-1. 로컬 사전 준비

```bash
node -v
npm -v
npm ci
npm run dev
npm run dev:vercel
npm run build && npm run preview
```

### 6-2. Vercel CLI 설치 & 로그인

```bash
npm i -g vercel
vercel login
vercel link
```

### 6-3. 환경 변수 (T.Project / Anthropic 기준)

```bash
vercel env add ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_API_KEY preview
vercel env add ANTHROPIC_API_KEY development
vercel env ls
vercel env pull .env.local
```

**`T.Project.remote`(Next + Gemini)로 배포 중이면:** `GEMINI_API_KEY` 필수, 선택 `GEMINI_MODEL`.

### 6-4. 배포

```bash
vercel
vercel --prod
```

### 6-5. 배포 후 점검

```bash
vercel logs
vercel logs https://<배포-URL>.vercel.app
vercel rollback
vercel domains ls
vercel domains add legal.example.com
```

### 6-6. GitHub 연동

Dashboard → Project → Settings → Git → Connect. 이후 `git push`로 자동 배포.

### 6-7. 트러블슈팅

```bash
npm ci && npm run build
rm -rf node_modules dist .vercel && npm ci && npm run build
vercel dev
du -sh api/*
vercel --force --prod
```

---

## 7. Cursor "한 방 프롬프트" (Phase 1 + 2-1)

```text
지금부터 DESIGN_SYSTEM.md 를 레퍼런스로 Phase 1 + Phase 2-1 까지 한 번에 진행해줘.

각 단계마다 커밋을 나누고, 단계 사이에 내가 확인할 수 있게 멈춰줘.

[단계 1] 토큰 CSS 생성
  - src/theme/tokens.css (다크 + 라이트 모두)
  - src/theme/ThemeProvider.jsx
  - src/main.jsx 수정(ThemeProvider 래핑, tokens.css import)
  → 커밋 "chore(theme): introduce design tokens"

[단계 2] SKTLegalChat 의 색 하드코딩을 CSS 변수로 치환
  - DESIGN_SYSTEM.md 부록 A 매핑 테이블 그대로 적용
  - 기능 변경 금지, 시각 회귀 금지
  → 커밋 "refactor(style): migrate hardcoded colors to design tokens"

[단계 3] Button / IconButton 컴포넌트 추출
  - src/components/Button.jsx, src/components/IconButton.jsx
  - 명세: DESIGN_SYSTEM.md §5.1
  - 최소 3곳에 적용(대화로 돌아가기, PDF 리포트, JSON)
  → 커밋 "feat(ui): extract Button component"

각 단계 완료 후 수동 확인 체크리스트를 한국어로 뽑고, npm run build 가 통과하는지 확인.
실패하면 원인과 수정안을 먼저 제시해줘.
```

---

## 8. 배포 전 체크리스트

- [ ] `.env` / `.env.local`이 `.gitignore`에 있는지
- [ ] API 키가 Vercel production / preview / development에 설정됐는지 (스택에 맞게 Anthropic 또는 Gemini)
- [ ] `npm run build` 로컬 성공
- [ ] `npm run preview`로 질문·파일·PDF·히스토리 스모크
- [ ] 민감정보 감지(Phase 3 이후) 의도대로인지
- [ ] Drawer 반응형(Phase 3 이후)
- [ ] 키보드 플로우(Phase 5)
- [ ] 프로덕션 첫 응답 401/403 없음
- [ ] 잘못된 키 시 사용자 친화적 에러

---

문서 끝. **Phase마다 끝날 때 `vercel --prod`(또는 Git push 자동 배포)** 하세요. 문제 시 §6-7 트러블슈팅을 먼저 확인하세요.
