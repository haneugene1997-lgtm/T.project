import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/* ═══════════════════════════════════════════════
   법령 DB (서버사이드)
   ═══════════════════════════════════════════════ */
const LEGAL_DB = {
  pipa: { name: "개인정보 보호법", articles: [
    "제15조 (수집·이용): 동의 없이 수집 금지 [high]",
    "제17조 (제3자 제공): 별도 동의 필요 [high]",
    "제18조 (목적 외 이용 제한): 수집 목적 외 금지 [high]",
    "제22조 (동의 방법): 필수/선택 구분 [medium]",
    "제24조 (고유식별정보 제한): 주민번호 처리 금지 [high]",
    "제26조 (위탁 시 제한): 수탁자 관리·감독 [high]",
    "제29조 (안전조치의무): 기술적·관리적 보호조치 [high]",
    "제30조 (처리방침 공개): 처리방침 수립 공개 [medium]",
  ]},
  telecom: { name: "전기통신사업법", articles: [
    "제28조 (이용약관 신고): 변경 시 신고 [medium]",
    "제32조의2 (이용자 보호): 피해 방지 의무 [high]",
    "제50조 (금지행위): 불공정·이용자 이익 침해 금지 [high]",
    "제83조 (통신비밀 보호): 통신사실 확인자료 제한 [high]",
  ]},
  ict: { name: "정보통신망법", articles: [
    "제22조 (수집·이용 동의): 서비스 목적 수집 동의 [high]",
    "제28조 (보호조치): 기술적·관리적 보호조치 [high]",
    "제45조 (ISMS 인증): 인증 의무 [high]",
    "제50조 (광고 전송 제한): 수신 동의 없는 광고 금지 [medium]",
  ]},
  fair: { name: "공정거래법", articles: [
    "제3조의2 (시장지배적지위 남용금지): 부당 가격·방해 금지 [high]",
    "제19조 (부당 공동행위 금지): 담합 금지 [high]",
    "제23조 (불공정거래 금지): 거래거절·끼워팔기 금지 [high]",
  ]},
  labor: { name: "근로기준법", articles: [
    "제17조 (근로조건 명시): 임금·시간 서면 명시 [high]",
    "제23조 (해고 제한): 정당 사유 없는 해고 금지 [high]",
    "제43조 (임금 지급): 직접·전액·정기 지급 [high]",
  ]},
  subcon: { name: "하도급법", articles: [
    "제3조 (서면 발급): 계약 시 서면 발급 [high]",
    "제4조 (부당 대금결정 금지): 부당 낮은 대금 금지 [high]",
    "제13조 (대금 지급): 60일 내 지급 [high]",
  ]},
};

function buildSystemPrompt() {
  const lawsSection = Object.entries(LEGAL_DB).map(([id, law]) => {
    return `## ${law.name} (${id})\n${law.articles.map(a => `  - ${a}`).join("\n")}`;
  }).join("\n\n");

  return `당신은 SK텔레콤 내부 법무 검토 AI 어시스턴트입니다.
사용자가 보내는 텍스트, 질문, 또는 문서를 분석하여 컴플라이언스 리스크를 식별합니다.

## 적용 법령 DB
${lawsSection}

## 응답 방식

### 1) 간단한 질문 → 자연스러운 한국어로 답변. 관련 법령/조항 인용. 일반 텍스트.

### 2) 문서 분석 요청 (200자+ 텍스트, 계약서, 약관, 파일) → JSON만 출력:
{
  "type": "analysis",
  "summary": "문서 요약 (3-4문장)",
  "overall_risk": "high | medium | low",
  "risk_score": 1-10,
  "issues": [
    {
      "id": 1,
      "title": "이슈 제목",
      "description": "상세 설명",
      "risk_level": "high | medium | low",
      "severity_score": 1-10,
      "violation_type": "omission | active_violation | ambiguity",
      "related_law": "법령명",
      "related_law_id": "pipa|telecom|ict|fair|labor|subcon",
      "clause": "관련 조항",
      "clause_detail": "조항 내용 요약",
      "recommendation": "시정 권고사항",
      "sample_clause": "수정 문구 예시"
    }
  ],
  "checklist": [
    { "category": "법령ID", "item": "체크 항목", "status": "pass|fail|warning|not_applicable", "note": "비고", "article": "조항" }
  ],
  "needs_legal_review": true/false,
  "legal_review_reason": "법무팀 검토 사유",
  "priority_actions": ["우선 시정 1", "우선 시정 2"]
}

### 판단 기준
- 200자 이상 문서 → JSON 분석
- 짧은 질문 → 자연어 답변
- SKT 통신사업자 특수성 반영`;
}

/** v1beta에서 없어지거나 키/지역에 없는 모델 ID → 안전한 기본값으로 치환 */
function normalizeGeminiModelId(raw) {
  const id = String(raw || "").trim().replace(/^models\//i, "");
  if (!id) return "gemini-2.5-flash";
  const m = id.toLowerCase();

  /* 1.5-flash-latest 만 v1beta에서 자주 없음 → 무접미사 1.5-flash 로 */
  if (m === "gemini-1.5-flash-latest") return "gemini-1.5-flash";

  const allow = new Set([
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-3-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
  ]);
  if (allow.has(m)) return id;

  /* 날짜 붙은 preview 등은 불안정 */
  if (/preview/i.test(m)) return "gemini-2.5-flash";

  if (/gemini-1\.5-pro|gemini-1\.0-pro|^gemini-pro$/i.test(m)) return "gemini-2.5-flash";

  return id;
}

/** 파일(바이너리) 분석 시 AI Studio에서 한도가 잡히는 모델을 먼저 시도 */
const FILE_FIRST_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-latest",
  "gemini-3-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.0-flash",
];

function uniqModels(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = normalizeGeminiModelId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * 사용자가 모델을 고르면 그 모델만 호출 (연속 호출로 RPM 소모 방지).
 * 자동이면 소수의 후보만 시도 (무료 등급 RPM/RPD 보호).
 * @param {{ hasFile: boolean; envModel: string; clientModel?: string | null; envFileModel?: string | null }} o
 */
function buildCandidateModels(o) {
  const { hasFile, envModel, clientModel, envFileModel } = o;
  const explicit =
    typeof clientModel === "string" && clientModel.trim()
      ? normalizeGeminiModelId(clientModel.trim())
      : "";
  if (explicit) {
    return [explicit];
  }

  const maxTry = Math.min(
    8,
    Math.max(1, parseInt(String(process.env.GEMINI_MAX_MODEL_TRIES || "4"), 10) || 4)
  );
  const filePref = envFileModel ? normalizeGeminiModelId(envFileModel) : "";

  if (hasFile) {
    const chain = uniqModels([filePref, ...FILE_FIRST_MODELS, envModel]);
    return chain.slice(0, maxTry);
  }

  const chain = uniqModels([envModel, "gemini-2.5-flash-lite", "gemini-2.5-flash", ...FILE_FIRST_MODELS]);
  return chain.slice(0, maxTry);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, fileData, fileType, fileMimeType, model: clientModelRaw } = body;
    const apiKey = process.env.GEMINI_API_KEY;
    /* 무료 등급에서 한도가 있는 모델이 프로젝트마다 다름 → 기본은 2.5 Flash 우선 */
    const envModel = normalizeGeminiModelId(
      process.env.GEMINI_MODEL || "gemini-2.5-flash"
    );
    const envFileModel =
      process.env.GEMINI_MODEL_FILES?.trim() || null;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다. 환경변수를 확인해주세요." },
        { status: 500 }
      );
    }
    if (!message && !fileData) {
      return NextResponse.json(
        { error: "질문 또는 분석할 문서를 함께 보내주세요." },
        { status: 400 }
      );
    }

    // Build user content
    let userParts;
    if (fileData && fileType === "inline") {
      userParts = [
        { inline_data: { mime_type: fileMimeType || "application/octet-stream", data: fileData } },
        { text: message || "이 문서를 법무 컴플라이언스 관점에서 분석해주세요." },
      ];
    } else if (fileData) {
      userParts = [
        {
          text: `${message ? message + "\n\n---\n\n" : ""}다음 문서를 법무 컴플라이언스 관점에서 분석해주세요:\n\n${fileData}`,
        },
      ];
    } else {
      userParts = [{ text: message }];
    }

    const requestPayload = {
      systemInstruction: {
        role: "system",
        parts: [{ text: buildSystemPrompt() }],
      },
      contents: [
        {
          role: "user",
          parts: userParts,
        },
      ],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.2,
      },
    };

    const hasFile = Boolean(fileData);
    const explicitClient =
      typeof clientModelRaw === "string" && Boolean(clientModelRaw.trim());

    const candidateModels = buildCandidateModels({
      hasFile,
      envModel,
      clientModel:
        typeof clientModelRaw === "string" && clientModelRaw.trim()
          ? clientModelRaw.trim()
          : null,
      envFileModel,
    });

    let response = null;
    let responseJson = null;
    let authStop = false;

    outer: for (let mi = 0; mi < candidateModels.length; mi++) {
      const m = candidateModels[mi];
      /* 자동 모드: 모델 전환 시 짧게 쉬어 RPM 버스트 완화 */
      if (mi > 0 && !explicitClient) {
        await sleep(1200);
      }
      const maxSameModelTries = explicitClient ? 2 : 1;
      for (let attempt = 0; attempt < maxSameModelTries; attempt++) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
        const retryAfterHdr = response.headers.get("retry-after");
        const bodyText = await response.text();
        try {
          responseJson = JSON.parse(bodyText);
        } catch {
          responseJson = {
            error: { message: bodyText?.slice(0, 400) || `HTTP ${response.status}` },
          };
        }
        if (response.ok) break outer;

        if (response.status === 401 || response.status === 403) {
          authStop = true;
          break outer;
        }

        /* 사용자 지정 모델: 429면 짧게 대기 후 1회만 재시도 (일시 RPM 한도) */
        if (
          explicitClient &&
          response.status === 429 &&
          attempt + 1 < maxSameModelTries
        ) {
          const sec = parseInt(String(retryAfterHdr || "").trim(), 10);
          const waitMs = Number.isFinite(sec) && sec > 0 ? Math.min(sec * 1000, 20000) : 6000;
          await sleep(waitMs);
          continue;
        }
        break;
      }
    }

    if (authStop || !response || !response.ok) {
      const providerErr =
        responseJson?.error?.message ||
        responseJson?.error ||
        `Gemini API 오류 (${response?.status || "?"})`;
      const e = new Error(providerErr);
      e.status = response?.status || 500;
      e.detail = responseJson;
      throw e;
    }

    const responseText = (responseJson?.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("")
      .trim();

    // JSON 분석 결과인지 판별
    let analysis = null;
    try {
      const cleaned = responseText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.type === "analysis" || parsed.issues) {
        analysis = parsed;
      }
    } catch {}

    return NextResponse.json({
      text: analysis ? null : responseText,
      analysis: analysis,
    });
  } catch (error) {
    console.error("API Error:", error);

    const status = typeof error?.status === "number" ? error.status : 500;
    const rawMessage =
      error?.error?.message ||
      error?.message ||
      "분석 중 오류가 발생했습니다.";
    const lower = String(rawMessage).toLowerCase();
    const isBillingIssue =
      status === 429 ||
      lower.includes("quota") ||
      lower.includes("resource_exhausted") ||
      lower.includes("billing") ||
      lower.includes("insufficient") ||
      lower.includes("exceeded");
    const providerMessage = isBillingIssue
      ? "Gemini 요청 한도(RPM·RPD·TPM)에 걸렸습니다. 무료 등급은 분·일 단위 제한이 좁아, 연속으로 파일 분석을 하면 잠시 막힐 수 있습니다. 1~2분 후 한 번만 다시 시도하거나, Google AI Studio에서 사용량·결제를 확인하세요. (같은 요청에서 여러 모델을 연달아 호출하지 않도록 서버를 조정했습니다.)"
      : rawMessage;

    return NextResponse.json(
      {
        error: providerMessage,
        hint: isBillingIssue
          ? "잠시 후 재시도 · 첨부는 가능하면 작은 파일(또는 PDF/TXT)로 줄이기"
          : undefined,
      },
      { status: isBillingIssue ? 429 : status }
    );
  }
}
