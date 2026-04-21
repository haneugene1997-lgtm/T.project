# Cursor 작업 지시서 + Vercel 배포 커맨드

> 이 문서는 `DESIGN_SYSTEM.md` 를 실제 코드에 반영하기 위한 **Cursor 복붙용 프롬프트**와
> **Vercel 배포 커맨드** 모음입니다. 각 블록은 그대로 복사해서 Cursor Chat(⌘L/Ctrl+L)에
> 붙여넣으면 됩니다.
>
> 프로젝트: `skt-legal-agent` · React 18 + Vite 6 + Vercel Edge
> 핵심 파일: `src/SKTLegalChat.jsx`, `api/chat.js`, `vercel.json`

---

## 0. Cursor 에 먼저 넣을 "컨텍스트 프롬프트"

> 매 세션 맨 처음 한 번만 넣어주세요. 이후 프롬프트가 이 컨텍스트를 전제로 합니다.

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
2. 기존 동작(대화·문서분석·PDF/JSON 다운로드·히스토리 localStorage)은 절대 깨지 않게 한다.
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

```text
DESIGN_SYSTEM.md §4 (디자인 토큰) 과 부록 A (매핑 테이블) 를 기준으로
아래 작업을 해줘.

1) src/theme/tokens.css 생성
   - :root 에 다크 테마 CSS 변수 전체 선언 (색·타이포·간격·radius·elevation·motion)
   - [data-theme="light"] 에 라이트 테마 선언
   - 값은 DESIGN_SYSTEM.md §4 의 다크/라이트 컬럼을 그대로 사용

2) src/theme/ThemeProvider.jsx 생성
   - useTheme() 훅과 <ThemeProvider> 컴포넌트
   - 기본값 dark, localStorage('skt-legal-theme') 에 저장
   - prefers-color-scheme 감지

3) src/main.jsx 수정
   - tokens.css import
   - <App/> 를 <ThemeProvider> 로 감싸기

4) src/SKTLegalChat.jsx 는 이번에 손대지 않는다. (다음 단계에서 치환)

완료 후 수동 확인 체크리스트를 한국어로 만들어줘.
```

### 1-2. 하드코딩 값 일괄 치환

```text
src/SKTLegalChat.jsx 안의 인라인 스타일에서 아래 값들을 순차적으로 CSS 변수로 교체해줘.
기능은 절대 바꾸지 말고, 시각적 결과도 동일해야 한다.

- #08080d              → var(--bg-base)
- #e5e5ea              → var(--text-primary)
- #a0a0a8              → var(--text-secondary)
- #636366              → var(--text-tertiary)
- #48484a              → var(--text-disabled)
- #007aff              → var(--brand-500)
- #5e5ce6, #5856d6     → var(--brand-600)
- rgba(255,255,255,0.03) → var(--bg-elev-1)
- rgba(255,255,255,0.06) → var(--border-subtle)
- #ff3b30              → var(--risk-high)
- #ff9f0a              → var(--risk-med)
- #30d158              → var(--risk-low)
- linear-gradient(135deg,#007aff,#5e5ce6) → var(--brand-grad)

RC, VT, glass() 헬퍼도 CSS 변수를 쓰도록 업데이트.
LEGAL_DB 의 law.color 값은 토큰 매핑 없이 유지(법령별 식별 색).

변경 후 빌드(`npm run build`)가 통과하는지 확인하는 명령도 같이 알려줘.
```

### 1-3. Lint 룰

```text
인라인 스타일에 리터럴 색/숫자가 더 이상 들어가지 못하도록
eslint-plugin-react 기반으로 경고 룰을 하나 추가해줘.
- 리터럴 hex(#xxxxxx), rgb/rgba(…) 감지
- var(--…) 사용은 허용
- 기존 코드의 위반은 우선 warn 레벨

package.json devDependency 추가, .eslintrc.cjs 생성.
```

---

## 2. Phase 2 — 핵심 컴포넌트 추출 (2~3일)

### 2-1. Button / IconButton

```text
DESIGN_SYSTEM.md §5.1 기준으로
src/components/Button.jsx, src/components/IconButton.jsx 를 생성해줘.

요구사항:
- variant: primary | secondary | ghost
- size: sm(32) | md(40) | lg(48)
- props: leadingIcon, loading(boolean), disabled, aria-label
- states: default, hover, focus-visible(2px outline), active(scale .98), loading(스피너 + 텍스트 숨김), disabled
- IconButton 은 aria-label 필수 (PropTypes 경고 대신 dev 콘솔 console.warn)
- 스타일은 인라인 style 객체 + CSS 변수

그리고 SKTLegalChat.jsx 에서 아래 버튼들을 새 Button 으로 교체해줘.
(범위를 작게 유지: 이번 PR에선 3곳만)
- "대화로 돌아가기" → ghost
- "PDF 리포트" → secondary
- "JSON" → secondary
```

### 2-2. Composer (입력 영역)

```text
DESIGN_SYSTEM.md §5.2 기준으로 src/components/Composer.jsx 를 생성해줘.

- 내부 구성: AttachmentStrip(여러 파일 지원), textarea(자동 확장 1~8줄), toolbar(+ 첨부, ↑ 전송)
- props: value, onChange, onSubmit, onAttach, mode('quick'|'analyze'|'preshare'), disabled, maxFiles=5
- 키보드: Enter 전송, Shift+Enter 줄바꿈, Cmd/Ctrl+U 첨부, Esc 첨부 취소
- 상태: empty / typing / hasAttachment / pasting-large-text(5000자↑ 감지 시 토스트 emit)
- 외부에 sensitive-pattern 감지 결과를 onSensitive(matches) 콜백으로 전달 (구현은 다음 단계)

기존 SKTLegalChat.jsx 의 input + attach 블록을 <Composer /> 로 교체.
기존 동작(파일 단일 업로드, 10MB 제한, 지원 확장자)은 **일단 유지**하고,
maxFiles 같은 확장은 props 만 받아두고 내부는 단일 파일로.
```

### 2-3. MessageBubble, RiskBadge, RiskCard, LawChip, AttachmentChip

```text
아래 컴포넌트를 src/components/ 하위에 하나씩 분리 생성.
기능 변경 없이 현 동작을 1:1로 추출.

- MessageBubble.jsx    (variant: user | agent-text | agent-analysis | system-notice)
- RiskBadge.jsx        (level, score, size, 형상 중복: 원/삼각/사각 SVG 병행)
- RiskCard.jsx         (이슈 카드, 펼침 토글, 200ms 트랜지션)
- LawChip.jsx          (count badge, active/hover 상태)
- AttachmentChip.jsx   (uploading/ready/parse-error/oversize/unsupported 상태 표시)
- ScoreGauge.jsx       (role="img" + aria-label, prefers-reduced-motion 대응)

그리고 SKTLegalChat.jsx 안 인라인 정의를 위 컴포넌트로 교체.
한번에 한 컴포넌트씩 커밋하고, 교체 후 시각 회귀가 없는지 확인 체크리스트 포함.
```

---

## 3. Phase 3 — 흐름 개선: Drawer 분할 뷰 & Suggestion Chips (3~5일)

### 3-1. Analysis Drawer (핵심 변경)

```text
DESIGN_SYSTEM.md §6.2 Split-Pane 레이아웃 기준으로
현재 풀스크린 오버레이를 **우측 Drawer** 로 전환해줘.

요구사항:
1) 브레이크포인트 1024px 이상: 좌(대화) + 우(Drawer) 분할 뷰
2) 1024px 미만: 하단 bottom-sheet (peek/half/full 3단계)
3) Drawer 폭: 420~560px, 사용자가 좌측 엣지를 드래그해 조절, localStorage 저장
4) 공통 액션(상단): 닫기 · 팝아웃(새 창) · PDF · JSON · 공유 검토(Phase 4에서 채움)
5) ESC 로 닫기, F6 로 포커스 이동
6) 기존 activeAnalysis state 그대로 사용, openAnalysis/closeAnalysis 시그니처 유지

기존 activeAnalysis 렌더링 블록을 <AnalysisDrawer /> 로 이동.
좌측 대화 영역의 max-width 는 Drawer 열렸을 때 자동 조정.
```

### 3-2. Suggestion Chips (후속 액션)

```text
DESIGN_SYSTEM.md §6.3 Contextual Re-Ask 패턴 구현.

1) src/components/SuggestionChips.jsx
   - props: chips=[{label, intent, payload}], onPick
   - 3~5개 칩을 인라인 롤로 배치

2) RiskCard 하단에 Suggestion Chips 2~3개 자동 노출:
   - "조항 원문 보기" → 해당 법령 Drawer 오픈
   - "수정 초안 주세요" → 자동 프롬프트 전송
   - "우리 회사 템플릿에 맞춰 다시" → 후속 질의

3) 클릭 시 sendMessage(payload.text) 호출,
   현재 분석 세션 유지를 위해 hidden context 를 messages 배열에 첨부.

수동 확인: 분석 1회 한 뒤 "수정 초안 주세요" 눌러 후속 답변이 대화에 붙고
Drawer 의 해당 이슈에 "수정안 있음" 배지가 뜨는지.
```

### 3-3. Sensitive Pattern 감지

```text
DESIGN_SYSTEM.md §5.2 의 Sensitive Pattern 감지 레이어를 구현해줘.

1) src/lib/sensitive.js
   - detect(text): {type, match, index}[] 반환
   - 패턴: 주민번호 /\b\d{6}-[1-4]\d{6}\b/, 카드번호 /\b(?:\d{4}[- ]?){3}\d{4}\b/,
     이메일, 전화번호(010-xxxx-xxxx / 02-xxxx-xxxx 형), 사업자번호
   - mask(text): 감지 패턴을 *** 로 치환한 새 문자열

2) Composer 에서 onChange 시 debounce 200ms 로 detect 실행,
   감지되면 입력 영역 아래에 경고 배너 노출:
   "민감정보가 포함되어 있어요. [자동 마스킹] [그대로 전송] [취소]"

3) 전송 직전에 한 번 더 검사,
   미해결 상태에서 전송 시도하면 모달 확인 단계.

4) 전송된 페이로드와는 별개로, UI 상에선 기록이 마스킹 처리 여부가 보이도록 표시.
```

---

## 4. Phase 4 — 신규 패턴: Pre-Share Gate, Projects, Command Palette (3~5일)

### 4-1. Pre-Share Gate (BP 외부 공유 사전 점검)

```text
DESIGN_SYSTEM.md §6.4 Pre-Share Gate 구현.

1) 인텐트 진입
   - 홈 빈 상태에 Intent 카드 4개: 빠른질의 / 문서검토 / BP 공유 점검 / 조항 설명
   - BP 공유 점검 카드 클릭 시 mode='preshare' 로 Composer 전환

2) src/components/PreShareGate.jsx
   - 단계: 수신(드롭다운) → 목적(100자 텍스트) → 원문 첨부/세션 선택 → 실행 → 결과
   - 체크 항목: PII 감지, 내부 코드명 키워드(사내 프로젝트 네이밍 배열 props로), 위수탁 계약 체결 여부(사용자 입력), 영업비밀 키워드
   - 결과 카드: 통과 접기, 이슈 항목별 [마스킹] [제거] [사유 입력] 액션

3) 산출
   - "공유 가능 버전" 텍스트 (.txt / .md) 다운로드
   - 점검 이력 PDF (기존 generatePDFReport 로직 재사용, 헤더만 "외부공유 점검 리포트"로)

4) 사내 BP 목록 / 프로젝트 네이밍 목록은 하드코딩 대신 src/config/preshare.config.js 에서 관리.
```

### 4-2. Projects (선택)

```text
DESIGN_SYSTEM.md §3.2 Project 패턴 — 이번엔 MVP만.

- localStorage 에 projects: [{id, name, createdAt, itemIds}]
- 좌측 사이드바(1440px 이상에서만) 에 Project 목록
- 대화/분석을 Project 로 드래그해 묶기
- 기존 history 는 "분류 없음" Project 로 마이그레이션
```

### 4-3. Command Palette (Cmd+K)

```text
Cmd/Ctrl+K 로 열리는 Command Palette 를 추가해줘.
- 새 대화, 분석 히스토리 검색, 테마 전환, BP 공유 모드 진입, 단축키 안내
- 의존성 최소화: 별도 라이브러리 없이 자체 구현
- 접근성: role="dialog" + aria-modal, 첫 포커스는 검색 인풋
```

---

## 5. Phase 5 — 접근성 · Light 모드 · 품질 (1~2일)

```text
DESIGN_SYSTEM.md §8 접근성 체크리스트 통과시키기.

1) 키보드
   - 탭 순서 점검, 포커스 트랩(Drawer, 모달)
   - 분석 탭 ←/→ 이동, Space 토글, Esc 닫기

2) 스크린리더
   - <main>/<aside>/<nav>/<header> 랜드마크
   - aria-live="polite" 로 에러/로딩/체크리스트 상태 안내
   - ScoreGauge role="img" + aria-label="리스크 점수 N 중 10"

3) 색 대비
   - placeholder 색 #48484a → var(--text-tertiary) 로 상향
   - focus-visible 링 2px, 3:1 대비 보장

4) 모션
   - prefers-reduced-motion 감지 시 게이지 카운트업, pulse 애니메이션 비활성

5) Light 테마
   - [data-theme="light"] 분기만 있으면 전환 바로 테스트 가능하게
   - 상단 우측 "☀️/🌙" 토글 버튼

6) E2E 스모크
   - @playwright/test 로 최소 시나리오 3개:
     (a) 질문 전송 → 응답 수신
     (b) PDF 파일 첨부 → 분석 결과 Drawer 노출
     (c) Pre-Share Gate 실행 → 산출물 다운로드

완료 후 README 를 업데이트해서 개발·배포 방법을 명시해줘.
```

---

## 6. Vercel 배포 커맨드 (복붙용)

> 최초 1회 프로젝트 연결부터, 이후 CI/CD 자동화까지.

### 6-1. 로컬 사전 준비

```bash
# Node 버전 확인 (Vite 6 는 Node 18.18+ 또는 20+ 필요)
node -v
npm -v

# 의존성 설치
npm ci

# 로컬 개발
npm run dev                 # Vite 만 실행 (API 경로 404 날 수 있음)
npm run dev:vercel          # vercel dev: Edge 함수까지 같이 실행 (권장)

# 프로덕션 빌드 검증
npm run build && npm run preview
```

### 6-2. Vercel CLI 설치 & 로그인

```bash
# 설치 (전역)
npm i -g vercel

# 로그인 (브라우저 열림)
vercel login

# 현재 레포를 Vercel 프로젝트에 연결 (최초 1회)
vercel link
# → 프로젝트 선택 / 신규 생성 프롬프트 응답
```

### 6-3. 환경 변수 설정 (가장 중요)

```bash
# 프로덕션/프리뷰/개발 모두에 ANTHROPIC_API_KEY 추가
vercel env add ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_API_KEY preview
vercel env add ANTHROPIC_API_KEY development

# 확인
vercel env ls

# 로컬 .env 로 내려받기 (vercel dev 사용 시)
vercel env pull .env.local
```

### 6-4. 배포

```bash
# 프리뷰 배포 (고유 URL 생성)
vercel

# 프로덕션 배포
vercel --prod

# 특정 브랜치에서 프리뷰
git checkout -b feature/drawer-split-pane
git push -u origin feature/drawer-split-pane
# → GitHub 연동 시 PR 생성하면 자동 프리뷰 URL 발급
```

### 6-5. 배포 후 점검

```bash
# 최근 배포 로그
vercel logs

# 특정 배포 URL 로그
vercel logs https://skt-legal-agent-xxxx.vercel.app

# 롤백 (이전 프로덕션으로 즉시 복구)
vercel rollback

# 프로젝트 도메인 목록 / 추가
vercel domains ls
vercel domains add legal.example.com
```

### 6-6. GitHub 연동 자동 배포 (권장)

```bash
# 1) GitHub 레포 생성 (아직 없다면)
gh repo create skt-legal-agent --private --source=. --push

# 2) Vercel Dashboard → Project → Settings → Git → Connect Git Repository
#    (웹 UI에서 한 번만)

# 3) 이후는 git push 만 하면 자동 배포
git add .
git commit -m "feat: design system tokens"
git push

# 메인 브랜치 push → Production 배포
# 그 외 브랜치 push → Preview 배포
```

### 6-7. 자주 쓰는 트러블슈팅

```bash
# 빌드 실패 시 로컬에서 재현
npm ci
npm run build

# 노드 모듈 초기화
rm -rf node_modules dist .vercel
npm ci
npm run build

# Edge 함수만 로컬에서 실험
vercel dev

# 함수 크기 초과 에러(Edge는 1MB 제한) — 번들에 큰 파일이 들어갔는지 확인
du -sh api/*

# 캐시가 이상할 때 강제 배포
vercel --force --prod
```

---

## 7. Cursor 에 넣을 "한 방 프롬프트" (Phase 1~2만 빠르게)

> 시간이 급할 때, Phase 1 과 2-1(Button)까지만 한 번에 진행하는 통합 프롬프트.

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

각 단계 완료 후 수동 확인 체크리스트를 한국어로 뽑고, `npm run build` 가 통과하는지 확인.
실패하면 원인과 수정안을 먼저 제시해줘.
```

---

## 8. 체크리스트 — 배포 전 마지막

배포 직전에 반드시 확인.

- [ ] `.env` / `.env.local` 이 `.gitignore` 에 있는지
- [ ] `ANTHROPIC_API_KEY` 가 Vercel 3개 환경에 모두 설정됐는지
- [ ] `npm run build` 가 로컬에서 성공하는지
- [ ] `npm run preview` 로 기능 전체 스모크(질문, 파일 업로드, PDF 출력, 히스토리) 통과
- [ ] 민감정보 감지가 의도대로 마스킹/차단하는지 (주민번호 예시로 테스트)
- [ ] Drawer 가 1024px 이하에서 bottom-sheet 로 전환되는지
- [ ] 키보드만으로 첫 질문 → 응답 → Drawer 열기/닫기가 가능한지
- [ ] 프로덕션 URL 접속 후 첫 응답 수신 성공 (네트워크 탭 401/403 없는지)
- [ ] 잘못된 API 키 상태에서 에러 메시지가 사용자 친화적으로 나오는지

---

**문서 끝.** 이 지시서로 Cursor 에게 단계적으로 작업을 맡기고, 각 Phase 가 끝날 때마다 `vercel --prod` 로 배포하세요. 문제가 생기면 §6-7 트러블슈팅을 먼저 확인하세요.
