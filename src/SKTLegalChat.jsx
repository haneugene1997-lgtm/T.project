import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useTheme } from "./theme/ThemeProvider.jsx";

/* ═══════════════════════════════════════════════
   법령 DB (간결 버전)
   ═══════════════════════════════════════════════ */
const LEGAL_DB = {
  pipa: { id: "pipa", name: "개인정보 보호법", icon: "🔒", color: "#007aff", summary: "개인정보 처리 및 보호",
    key_articles: [
      { article: "제15조", title: "수집·이용", desc: "동의 없이 수집 금지", severity: "high" },
      { article: "제17조", title: "제3자 제공", desc: "별도 동의 필요", severity: "high" },
      { article: "제18조", title: "목적 외 이용 제한", desc: "수집 목적 외 금지", severity: "high" },
      { article: "제22조", title: "동의 방법", desc: "필수/선택 구분", severity: "medium" },
      { article: "제24조", title: "고유식별정보 제한", desc: "주민번호 처리 금지", severity: "high" },
      { article: "제26조", title: "위탁 시 처리 제한", desc: "수탁자 관리·감독", severity: "high" },
      { article: "제29조", title: "안전조치의무", desc: "기술적·관리적 보호조치", severity: "high" },
      { article: "제30조", title: "처리방침 공개", desc: "처리방침 수립 및 공개", severity: "medium" },
    ] },
  telecom: { id: "telecom", name: "전기통신사업법", icon: "📡", color: "#5856d6", summary: "통신사업 운영·이용자 보호",
    key_articles: [
      { article: "제28조", title: "이용약관 신고", desc: "변경 시 신고 의무", severity: "medium" },
      { article: "제32조의2", title: "이용자 보호", desc: "피해 방지 의무", severity: "high" },
      { article: "제50조", title: "금지행위", desc: "불공정·이용자 이익 침해 금지", severity: "high" },
      { article: "제83조", title: "통신비밀 보호", desc: "통신사실 확인자료 제한", severity: "high" },
    ] },
  ict: { id: "ict", name: "정보통신망법", icon: "🌐", color: "#34c759", summary: "정보통신망 이용촉진·정보보호",
    key_articles: [
      { article: "제22조", title: "수집·이용 동의", desc: "서비스 목적 수집 동의", severity: "high" },
      { article: "제28조", title: "보호조치", desc: "기술적·관리적 보호조치", severity: "high" },
      { article: "제45조", title: "ISMS 인증", desc: "인증 의무", severity: "high" },
      { article: "제50조", title: "광고 전송 제한", desc: "수신 동의 없는 광고 금지", severity: "medium" },
    ] },
  fair: { id: "fair", name: "공정거래법", icon: "⚖️", color: "#ff9500", summary: "공정한 거래질서·소비자 보호",
    key_articles: [
      { article: "제3조의2", title: "시장지배적지위 남용금지", desc: "부당 가격·방해 금지", severity: "high" },
      { article: "제19조", title: "부당 공동행위 금지", desc: "담합 금지", severity: "high" },
      { article: "제23조", title: "불공정거래 금지", desc: "거래거절·끼워팔기 금지", severity: "high" },
    ] },
  labor: { id: "labor", name: "근로기준법", icon: "👷", color: "#ff2d55", summary: "근로조건·근로자 보호",
    key_articles: [
      { article: "제17조", title: "근로조건 명시", desc: "임금·시간 서면 명시", severity: "high" },
      { article: "제23조", title: "해고 제한", desc: "정당 사유 없는 해고 금지", severity: "high" },
      { article: "제43조", title: "임금 지급", desc: "직접·전액·정기 지급", severity: "high" },
    ] },
  subcon: { id: "subcon", name: "하도급법", icon: "🤝", color: "#af52de", summary: "하도급거래 공정화",
    key_articles: [
      { article: "제3조", title: "서면 발급", desc: "계약 시 서면 발급", severity: "high" },
      { article: "제4조", title: "부당 대금결정 금지", desc: "부당하게 낮은 대금 금지", severity: "high" },
      { article: "제13조", title: "대금 지급", desc: "60일 내 지급", severity: "high" },
    ] },
};

/* ═══════════════════════════════════════════════
   시스템 프롬프트
   ═══════════════════════════════════════════════ */
function buildSystemPrompt() {
  const lawsSection = Object.values(LEGAL_DB).map((law) => {
    const arts = law.key_articles.map((a) => `  - ${a.article} (${a.title}): ${a.desc} [${a.severity}]`).join("\n");
    return `## ${law.name} (${law.id})\n${arts}`;
  }).join("\n\n");

  return `당신은 SK텔레콤 내부 법무 검토 AI 어시스턴트입니다.
사용자가 보내는 텍스트, 질문, 또는 문서를 분석하여 컴플라이언스 리스크를 식별합니다.

## 적용 법령 DB
${lawsSection}

## 응답 방식
사용자의 메시지 유형에 따라 응답 형식을 다르게 합니다:

### 1) 간단한 질문 (예: "이 조항 문제 없어?", "개인정보 위탁 시 주의사항은?")
→ 자연스러운 한국어로 답변하세요. 관련 법령과 조항을 인용하며 실무적 조언을 제공합니다.
→ 일반 텍스트로 응답 (JSON 아님)

### 2) 문서 분석 요청 (긴 텍스트, 계약서, 약관, 파일 등)
→ 반드시 아래 JSON 형식으로만 응답. 다른 텍스트 없이 JSON만:
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
- 200자 이상의 문서/계약 내용이 포함되면 → JSON 분석 리포트
- 짧은 질문, 조항 질의, 개념 설명 요청 → 자연어 답변
- SKT 통신사업자 특수성 반영 (개인정보 대량 처리, 통신비밀, 이용자보호)
- 실무적이고 구체적인 권고사항 제공`;
}

/* ═══════════════════════════════════════════════
   UI Constants (CSS 변수) · PDF는 별도 창이라 hex 유지
   ═══════════════════════════════════════════════ */
const RC = {
  high: { bg: "var(--risk-high-bg)", border: "var(--risk-high-border)", text: "var(--risk-high)", label: "높음" },
  medium: { bg: "var(--risk-med-bg)", border: "var(--risk-med-border)", text: "var(--risk-med)", label: "중간" },
  low: { bg: "var(--risk-low-bg)", border: "var(--risk-low-border)", text: "var(--risk-low)", label: "낮음" },
};
const RISK_FOR_PDF = {
  high: { text: "#ff3b30", bg: "rgba(255,59,48,0.12)", border: "rgba(255,59,48,0.4)", label: "높음" },
  medium: { text: "#ff9f0a", bg: "rgba(255,159,10,0.12)", border: "rgba(255,159,10,0.4)", label: "중간" },
  low: { text: "#30d158", bg: "rgba(48,209,88,0.12)", border: "rgba(48,209,88,0.4)", label: "낮음" },
};
const VT = {
  omission: { label: "누락", color: "var(--risk-med)", bg: "var(--risk-med-bg)" },
  active_violation: { label: "위반", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  ambiguity: { label: "모호", color: "var(--info)", bg: "var(--info-bg)" },
};
const glass = (x = {}) => ({
  background: "var(--bg-elev-1)",
  backdropFilter: "blur(20px)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 16,
  ...x,
});

/* ═══════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════ */
function ScoreGauge({ score, size = 64 }) {
  const r = (size - 6) / 2, c = Math.PI * 2 * r, pct = score / 10;
  const color = score >= 7 ? "var(--risk-high)" : score >= 4 ? "var(--risk-med)" : "var(--risk-low)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-gauge-track)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.14, color: "var(--text-tertiary)" }}>/10</span>
      </div>
    </div>
  );
}

function RadarChart({ lawStats, size = 220 }) {
  const laws = Object.entries(lawStats);
  if (laws.length < 3) return null;
  const cx = size / 2, cy = size / 2, maxR = size * 0.35;
  const n = laws.length, step = (Math.PI * 2) / n;
  const pt = (i, val) => {
    const a = step * i - Math.PI / 2;
    return [cx + (val / 10) * maxR * Math.cos(a), cy + (val / 10) * maxR * Math.sin(a)];
  };
  const maxScores = laws.map(([, s]) => s.maxScore || 0);
  const poly = laws.map(([, s], i) => pt(i, maxScores[i]).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", margin: "0 auto" }}>
      {[2.5, 5, 7.5, 10].map((lv) => (
        <polygon key={lv} points={Array.from({ length: n }, (_, i) => pt(i, lv).join(",")).join(" ")}
          fill="none" stroke="var(--surface-chart-line)" strokeWidth="1"/>
      ))}
      <polygon points={poly} fill="var(--accent-radar-fill)" stroke="var(--brand-500)" strokeWidth="1.5" strokeLinejoin="round"/>
      {laws.map(([id], i) => {
        const law = LEGAL_DB[id], a = step * i - Math.PI / 2, lr = maxR + 24;
        return (
          <text key={id} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)}
            textAnchor="middle" dominantBaseline="middle" fill={law?.color || "var(--chart-fallback)"} fontSize="10" fontWeight="600">
            {law?.icon}{law?.name?.slice(0, 3)}
          </text>
        );
      })}
      {maxScores.map((s, i) => { const [x, y] = pt(i, s); return <circle key={i} cx={x} cy={y} r="3" fill="var(--brand-500)" stroke="var(--bg-base)" strokeWidth="1.5"/>; })}
    </svg>
  );
}

/* PDF 리포트 */
function generatePDFReport(result, fileName) {
  const riskLabel = RISK_FOR_PDF[result.overall_risk]?.label || "중간";
  const riskColor = RISK_FOR_PDF[result.overall_risk]?.text || "#ff9f0a";
  const now = new Date().toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const issueRows = (result.issues || []).map((issue, i) => `
    <tr><td style="text-align:center;font-weight:700">${i+1}</td>
    <td><strong>${issue.title}</strong><br/><span style="font-size:11px;color:#666">${issue.description}</span></td>
    <td style="text-align:center"><span style="color:${RISK_FOR_PDF[issue.risk_level]?.text};font-weight:700">${RISK_FOR_PDF[issue.risk_level]?.label}</span><br/><span style="font-size:11px">${issue.severity_score}/10</span></td>
    <td style="font-size:12px">${issue.related_law}<br/>${issue.clause}</td>
    <td style="font-size:12px">${issue.recommendation}</td></tr>`).join("");
  const checkRows = (result.checklist || []).map((item) => {
    const icon = { pass: "✅", fail: "❌", warning: "⚠️", not_applicable: "➖" }[item.status] || "❓";
    return `<tr><td style="text-align:center;font-size:16px">${icon}</td><td>${item.item}</td><td style="font-size:12px;color:#666">${item.article || ""}</td><td style="font-size:12px;color:#666">${item.note || ""}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>법무 검토 리포트</title>
<style>@page{size:A4;margin:20mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Pretendard',-apple-system,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.7}
.header{display:flex;justify-content:space-between;border-bottom:3px solid #007aff;padding-bottom:14px;margin-bottom:20px}.header h1{font-size:20px;color:#007aff}
.meta{text-align:right;font-size:11px;color:#666}.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:13px}
.summary-box{background:#f5f7fa;border-radius:8px;padding:16px;margin-bottom:18px;border-left:4px solid ${riskColor}}
h2{font-size:15px;margin:24px 0 10px;padding-bottom:5px;border-bottom:1px solid #e5e5ea}
table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px}th{background:#f0f2f5;padding:7px 9px;text-align:left;font-weight:600;border-bottom:2px solid #d1d5db}
td{padding:7px 9px;border-bottom:1px solid #e5e5ea;vertical-align:top}.priority{background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:18px}
.priority li{margin-bottom:3px;color:#dc2626}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #e5e5ea;font-size:10px;color:#999;text-align:center}
.stamp{display:inline-block;border:2px solid ${riskColor};border-radius:8px;padding:4px 14px;color:${riskColor};font-weight:700;font-size:15px;transform:rotate(-3deg);margin-left:10px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header"><div><h1>⚖️ SKT 법무 컴플라이언스 검토 리포트</h1></div>
<div class="meta"><p>분석일시: ${now}</p><p>파일: ${fileName||"-"}</p>
<p style="margin-top:5px"><span class="badge" style="background:${RISK_FOR_PDF[result.overall_risk]?.bg};color:${riskColor}">리스크 ${riskLabel}</span><span class="stamp">${result.risk_score||"?"}/10</span></p></div></div>
<div class="summary-box"><strong>📋 문서 요약</strong><br/>${result.summary}${result.needs_legal_review?`<br/><br/><strong style="color:#d97706">⚠️ 법무팀 검토 권고:</strong> ${result.legal_review_reason||""}`:""}</div>
${result.priority_actions?.length?`<div class="priority"><strong>🚨 우선 시정 항목</strong><ul>${result.priority_actions.map(a=>`<li>${a}</li>`).join("")}</ul></div>`:""}
<h2>📌 이슈 (${result.issues?.length||0}건)</h2><table><thead><tr><th>#</th><th>이슈</th><th>리스크</th><th>법령/조항</th><th>권고사항</th></tr></thead><tbody>${issueRows}</tbody></table>
<h2>✅ 체크리스트 (${result.checklist?.length||0}항목)</h2><table><thead><tr><th>상태</th><th>항목</th><th>조항</th><th>비고</th></tr></thead><tbody>${checkRows}</tbody></table>
<div class="footer"><p>⚠️ AI 기반 사전 검토이며 법적 효력이 없습니다. 최종 법무 검토는 법무팀을 통해 진행하세요.</p>
<p>SKT Legal Compliance Agent v3.5 · ${now}</p></div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
}

/* ═══════════════════════════════════════════════
   MAIN APP — 대화형 인터페이스
   ═══════════════════════════════════════════════ */
export default function SKTLegalChat() {
  const { theme, toggleTheme } = useTheme();
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState(null); // 현재 열린 분석 결과
  const [analysisTab, setAnalysisTab] = useState("dashboard");
  const [filterLaw, setFilterLaw] = useState("all");
  const [expandedIssues, setExpandedIssues] = useState({});
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [analysisSourceFileName, setAnalysisSourceFileName] = useState(null);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  /* persistent history (localStorage — 브라우저 환경) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("legal-chat-history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const saveHistory = useCallback((hOrUpdater) => {
    setHistory((prev) => {
      const next = typeof hOrUpdater === "function" ? hOrUpdater(prev) : hOrUpdater;
      try {
        localStorage.setItem("legal-chat-history", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /* auto-scroll */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, loading]);

  /* auto-resize textarea */
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = Math.min(textAreaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  /* file handling */
  const handleFileSelect = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (f.size > 10 * 1024 * 1024) return;
    if (!["pdf", "txt", "doc", "docx", "md", "csv"].includes(ext)) return;
    setAttachedFile({ name: f.name, size: f.size, type: ext });
    const reader = new FileReader();
    if (ext === "pdf") {
      reader.onload = (e) => setFileContent({ type: "pdf", data: e.target.result.split(",")[1] });
      reader.readAsDataURL(f);
    } else {
      reader.onload = (e) => setFileContent({ type: "text", data: e.target.result });
      reader.readAsText(f);
    }
  }, []);

  const removeFile = () => { setAttachedFile(null); setFileContent(null); };

  /* send message — Next.js /api/chat (Gemini 프록시) */
  const sendMessage = async (textOverride) => {
    if (loading) return;
    const text = (textOverride != null ? String(textOverride) : input).trim();
    if (!text && !fileContent) return;

    const userMsg = {
      role: "user",
      text: text || `📎 ${attachedFile?.name} 분석 요청`,
      file: attachedFile ? { ...attachedFile } : null,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "이 문서를 법무 컴플라이언스 관점에서 분석해주세요.",
          fileData: fileContent?.data || null,
          fileType: fileContent?.type || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" ");
        throw new Error(msg || `서버 오류 ${res.status}`);
      }

      const assistantMsg = {
        role: "assistant",
        text: data.text || null,
        analysis: data.analysis || null,
        sourceFileName: attachedFile?.name || null,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      if (data.analysis) {
        const entry = {
          fileName: attachedFile?.name || "텍스트 입력",
          result: data.analysis,
          date: new Date().toISOString(),
          preview: text?.slice(0, 60),
        };
        saveHistory((prev) => [entry, ...prev].slice(0, 30));
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `⚠️ 오류: ${err.message}`,
          time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
      setAttachedFile(null);
      setFileContent(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* analysis helpers */
  const openAnalysis = (analysis, fileName) => {
    setActiveAnalysis(analysis);
    setAnalysisSourceFileName(fileName ?? null);
    setAnalysisTab("dashboard");
    setFilterLaw("all");
    setExpandedIssues({});
  };
  const closeAnalysis = () => {
    setActiveAnalysis(null);
    setAnalysisSourceFileName(null);
  };

  const filteredIssues = useMemo(() => {
    if (!activeAnalysis?.issues) return [];
    return filterLaw === "all" ? activeAnalysis.issues : activeAnalysis.issues.filter((i) => i.related_law_id === filterLaw);
  }, [activeAnalysis, filterLaw]);

  const lawStats = useMemo(() => {
    if (!activeAnalysis?.issues) return {};
    const s = {};
    activeAnalysis.issues.forEach((i) => {
      const id = i.related_law_id;
      if (!s[id]) s[id] = { count: 0, high: 0, medium: 0, low: 0, maxScore: 0 };
      s[id].count++; s[id][i.risk_level]++; s[id].maxScore = Math.max(s[id].maxScore, i.severity_score || 0);
    });
    return s;
  }, [activeAnalysis]);

  const checkStats = useMemo(() => {
    if (!activeAnalysis?.checklist) return { pass: 0, fail: 0, warning: 0, na: 0 };
    const s = { pass: 0, fail: 0, warning: 0, na: 0 };
    activeAnalysis.checklist.forEach((c) => { if (c.status === "pass") s.pass++; else if (c.status === "fail") s.fail++; else if (c.status === "warning") s.warning++; else s.na++; });
    return s;
  }, [activeAnalysis]);

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */

  /* analysis detail overlay */
  if (activeAnalysis) {
    const r = activeAnalysis;
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)",
        fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif" }}>
        <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: 600, height: 600, top: "-12%", right: "-10%", background: "var(--radial-brand)", filter: "blur(80px)" }}/>
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
          {/* Back button */}
          <button onClick={closeAnalysis} style={{ background: "var(--surface-panel)", border: "1px solid var(--surface-border-08)",
            borderRadius: 8, padding: "7px 16px", color: "var(--brand-500)", fontSize: 13, cursor: "pointer", marginBottom: 20 }}>
            ← 대화로 돌아가기
          </button>

          {/* Summary */}
          <div style={{ ...glass({ padding: "20px 24px", marginBottom: 16 }), borderLeft: `3px solid ${RC[r.overall_risk]?.border}`,
            display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <ScoreGauge score={r.risk_score || 5} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: RC[r.overall_risk]?.text,
                  background: RC[r.overall_risk]?.bg, border: `1px solid ${RC[r.overall_risk]?.border}`,
                  padding: "2px 8px", borderRadius: 5 }}>리스크 {RC[r.overall_risk]?.label}</span>
                {r.needs_legal_review && <span style={{ fontSize: 11, color: "var(--risk-med)", background: "var(--risk-med-soft-bg)", padding: "2px 7px", borderRadius: 5 }}>법무팀 검토 권고</span>}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-summary)", margin: 0, lineHeight: 1.7 }}>{r.summary}</p>
            </div>
          </div>

          {r.priority_actions?.length > 0 && (
            <div style={{ ...glass({ padding: "12px 16px", marginBottom: 14, borderLeft: "3px solid var(--risk-high-accent)" }) }}>
              <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px", color: "var(--risk-high-priority)" }}>🚨 우선 시정</p>
              {r.priority_actions.map((a, i) => <div key={i} style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 3 }}>• {a}</div>)}
            </div>
          )}

          {r.needs_legal_review && r.legal_review_reason && (
            <div style={{ ...glass({ padding: "10px 14px", marginBottom: 14, background: "var(--risk-med-panel-bg)", border: "1px solid var(--risk-med-panel-border)" }) }}>
              <span style={{ fontSize: 12, color: "var(--risk-med-text-soft)" }}>💡 <strong>법무팀 검토 사유:</strong> {r.legal_review_reason}</span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 3, marginBottom: 16, background: "var(--bg-elev-1)", borderRadius: 10, padding: 3 }}>
            {[{ key: "dashboard", label: "대시보드" }, { key: "issues", label: `이슈 (${filteredIssues.length})` }, { key: "checklist", label: `체크리스트 (${r.checklist?.length||0})` }].map((tab) => (
              <button key={tab.key} onClick={() => setAnalysisTab(tab.key)} style={{
                flex: 1, padding: "8px 10px", borderRadius: 8, border: "none",
                background: analysisTab === tab.key ? "var(--accent-tab-active)" : "transparent",
                color: analysisTab === tab.key ? "var(--brand-500)" : "var(--text-tertiary)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dashboard */}
          {analysisTab === "dashboard" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 16 }}>
                {["high", "medium", "low"].map((lv) => (
                  <div key={lv} style={{ background: RC[lv].bg, border: `1px solid ${RC[lv].border}`, borderRadius: 10, padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: RC[lv].text }}>{r.issues?.filter((i) => i.risk_level === lv).length || 0}</div>
                    <div style={{ fontSize: 10, color: "var(--text-meta)" }}>리스크 {RC[lv].label}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...glass({ padding: "12px 16px", marginBottom: 16 }) }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-meta)", marginBottom: 6 }}>체크리스트</p>
                <div style={{ display: "flex", gap: 5, height: 7, borderRadius: 4, overflow: "hidden", background: "var(--surface-check-bar)" }}>
                  {checkStats.pass > 0 && <div style={{ flex: checkStats.pass, background: "var(--risk-low)", borderRadius: 3 }}/>}
                  {checkStats.warning > 0 && <div style={{ flex: checkStats.warning, background: "var(--risk-med)", borderRadius: 3 }}/>}
                  {checkStats.fail > 0 && <div style={{ flex: checkStats.fail, background: "var(--risk-high)", borderRadius: 3 }}/>}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "var(--text-meta)" }}>
                  <span>✅ {checkStats.pass}</span><span>⚠️ {checkStats.warning}</span><span>❌ {checkStats.fail}</span>
                </div>
              </div>
              {Object.keys(lawStats).length >= 3 && (
                <div style={{ ...glass({ padding: "14px" }) }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-meta)", marginBottom: 6, textAlign: "center" }}>법령별 리스크</p>
                  <RadarChart lawStats={lawStats} />
                </div>
              )}
            </div>
          )}

          {/* Issues */}
          {analysisTab === "issues" && (
            <div>
              {Object.keys(lawStats).length > 1 && (
                <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setFilterLaw("all")} style={{ ...glass({ padding: "4px 9px", fontSize: 10, cursor: "pointer",
                    color: filterLaw === "all" ? "var(--brand-500)" : "var(--text-tertiary)", border: filterLaw === "all" ? "1px solid var(--accent-chip-border)" : "1px solid var(--border-subtle)" }) }}>전체</button>
                  {Object.keys(lawStats).map((id) => {
                    const law = LEGAL_DB[id]; if (!law) return null;
                    return <button key={id} onClick={() => setFilterLaw(filterLaw === id ? "all" : id)} style={{ ...glass({ padding: "4px 9px", fontSize: 10, cursor: "pointer",
                      color: filterLaw === id ? law.color : "var(--text-tertiary)", border: filterLaw === id ? `1px solid ${law.color}40` : "1px solid var(--border-subtle)" }) }}>{law.icon} {lawStats[id].count}</button>;
                  })}
                </div>
              )}
              {filteredIssues.map((issue, i) => {
                const vt = VT[issue.violation_type], exp = expandedIssues[issue.id] !== false;
                return (
                  <div key={i} style={{ ...glass({ padding: exp ? "16px 20px" : "10px 20px", marginBottom: 8, borderLeft: `3px solid ${RC[issue.risk_level]?.border}`, transition: "padding 0.3s" }) }}>
                    <div onClick={() =>
                      setExpandedIssues((p) => ({ ...p, [issue.id]: p[issue.id] === false ? true : false }))
                    }
                      style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: RC[issue.risk_level]?.text, background: RC[issue.risk_level]?.bg, padding: "2px 6px", borderRadius: 4 }}>{RC[issue.risk_level]?.label} ({issue.severity_score}/10)</span>
                      {vt && <span style={{ fontSize: 9, color: vt.color, background: vt.bg, padding: "1px 5px", borderRadius: 3 }}>{vt.label}</span>}
                      <span style={{ fontSize: 10, color: "var(--text-disabled)" }}>{LEGAL_DB[issue.related_law_id]?.icon} {issue.clause}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-disabled)" }}>{exp ? "▲" : "▼"}</span>
                    </div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, margin: "6px 0 0" }}>{issue.title}</h3>
                    {exp && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.7 }}>{issue.description}</p>
                        <div style={{ background: "var(--accent-recommend-bg)", borderRadius: 7, padding: "7px 10px", fontSize: 11, color: "var(--accent-recommend)", lineHeight: 1.5 }}>💡 {issue.recommendation}</div>
                        {issue.sample_clause && <div style={{ marginTop: 5, background: "var(--risk-low-soft-bg)", borderRadius: 7, padding: "7px 10px", fontSize: 10, color: "var(--risk-low)", lineHeight: 1.5 }}>✏️ {issue.sample_clause}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Checklist */}
          {analysisTab === "checklist" && (() => {
            const groups = {};
            (r.checklist || []).forEach((item) => { const cat = item.category || "other"; if (!groups[cat]) groups[cat] = []; groups[cat].push(item); });
            return Object.entries(groups).map(([cat, items]) => {
              const law = LEGAL_DB[cat];
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  {law && <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
                    <span style={{ fontSize: 12 }}>{law.icon}</span><span style={{ fontSize: 11, fontWeight: 600, color: law.color }}>{law.name}</span>
                  </div>}
                  {items.map((item, i) => {
                    const st = { pass: { i: "✅", b: "var(--risk-check-pass)" }, fail: { i: "❌", b: "var(--risk-check-fail)" }, warning: { i: "⚠️", b: "var(--risk-check-warn)" } }[item.status] || { i: "➖", b: "var(--risk-check-na)" };
                    return <div key={i} style={{ display: "flex", gap: 8, background: st.b, borderRadius: 7, padding: "8px 12px", marginBottom: 3 }}>
                      <span style={{ fontSize: 13 }}>{st.i}</span>
                      <div style={{ flex: 1 }}><p style={{ fontSize: 12, margin: 0 }}>{item.item}</p>{item.note && <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: "2px 0 0" }}>{item.note}</p>}</div>
                    </div>;
                  })}
                </div>
              );
            });
          })()}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={closeAnalysis} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid var(--surface-border-08)",
              background: "var(--bg-elev-1)", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}>← 대화로 돌아가기</button>
            <button onClick={() => generatePDFReport(r, analysisSourceFileName)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none",
              background: "var(--grad-pdf)", color: "var(--text-on-brand)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>📄 PDF 리포트</button>
            <button onClick={() => { const b = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b);
              const a = document.createElement("a"); a.href = u; a.download = `legal-review-${Date.now()}.json`; a.click(); URL.revokeObjectURL(u); }}
              style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none",
              background: "var(--brand-grad)", color: "var(--text-on-brand)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>📥 JSON</button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     CHAT VIEW
     ═══════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", display: "flex", flexDirection: "column",
      fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif" }}>

      {/* Ambient */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 600, height: 600, top: "-12%", right: "-10%", background: "var(--radial-brand)", filter: "blur(80px)" }}/>
        <div style={{ position: "absolute", width: 400, height: 400, bottom: "-8%", left: "-5%", background: "var(--radial-purple)", filter: "blur(70px)" }}/>
      </div>

      {/* Header */}
      <header style={{ position: "relative", zIndex: 2, padding: "16px 20px", borderBottom: "1px solid var(--surface-header-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-grad)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚖️</div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>SKT 법무 검토 에이전트</h1>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>6대 법령 기반 컴플라이언스 AI</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
            style={{
              background: "var(--surface-panel)",
              border: "1px solid var(--surface-border-08)",
              borderRadius: 8,
              padding: "5px 10px",
              color: "var(--text-meta)",
              fontSize: 14,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {history.length > 0 && (
            <button type="button" onClick={() => setShowHistory(!showHistory)} style={{ background: "var(--surface-panel)", border: "1px solid var(--surface-border-08)",
              borderRadius: 8, padding: "5px 12px", color: "var(--text-meta)", fontSize: 11, cursor: "pointer" }}>
              📁 {history.length}
            </button>
          )}
        </div>
      </header>

      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div style={{ position: "relative", zIndex: 10, padding: "0 20px" }}>
          <div style={{ ...glass({ padding: "12px 16px", borderRadius: 12, marginTop: 4 }) }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-meta)" }}>분석 히스토리</span>
              <button onClick={() => { saveHistory([]); setShowHistory(false); }} style={{ background: "none", border: "none", color: "var(--risk-high)", fontSize: 10, cursor: "pointer" }}>전체 삭제</button>
            </div>
            {history.slice(0, 10).map((h, i) => (
              <div key={i} onClick={() => { openAnalysis(h.result, h.fileName); setShowHistory(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 7, cursor: "pointer",
                  marginBottom: 2, background: "var(--surface-row)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-row-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-row)"; }}
                >
                <span style={{ fontSize: 10, padding: "2px 5px", borderRadius: 4, color: RC[h.result.overall_risk]?.text, background: RC[h.result.overall_risk]?.bg }}>
                  {RC[h.result.overall_risk]?.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.fileName}</p>
                </div>
                <span style={{ fontSize: 9, color: "var(--text-disabled)" }}>{fmtDate(h.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, position: "relative", zIndex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          {/* Welcome message */}
          {chatMessages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px 40px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.8 }}>⚖️</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px",
                background: "var(--hero-text-grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                무엇을 검토해 드릴까요?
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.7, maxWidth: 400, margin: "0 auto 28px" }}>
                계약 조항, 약관 내용, 정책 문구 등을<br/>텍스트로 바로 보내거나 파일을 첨부해 주세요
              </p>

              {/* Quick prompts */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500, margin: "0 auto" }}>
                {[
                  "개인정보 제3자 제공 시 필수 동의 항목은?",
                  "하도급 대금 지급기한 관련 규정 알려줘",
                  "이용약관에 일방적 변경 조항이 있으면 문제 돼?",
                  "통신비밀 보호 관련 SKT가 주의할 점은?",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => { setInput(prompt); void sendMessage(prompt); }}
                    style={{ background: "var(--bg-elev-1)", border: "1px solid var(--surface-border-07)",
                      borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "var(--text-secondary)",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s", lineHeight: 1.4 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-hover-bg)"; e.currentTarget.style.borderColor = "var(--accent-hover-border)"; e.currentTarget.style.color = "var(--brand-500)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elev-1)"; e.currentTarget.style.borderColor = "var(--surface-border-07)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Law chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 24 }}>
                {Object.values(LEGAL_DB).map((law) => (
                  <div key={law.id} style={{ display: "flex", alignItems: "center", gap: 4,
                    background: "var(--surface-row)", border: "1px solid var(--surface-header-border)",
                    borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "var(--text-disabled)" }}>
                    <span>{law.icon}</span>{law.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 14 }}>
              <div style={{ maxWidth: "85%", minWidth: 60 }}>
                {/* User bubble */}
                {msg.role === "user" && (
                  <div>
                    {msg.file && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-recommend-strong-bg)",
                        borderRadius: "12px 12px 4px 12px", padding: "6px 12px", marginBottom: 4, fontSize: 11, color: "var(--accent-recommend)" }}>
                        📎 {msg.file.name}
                      </div>
                    )}
                    <div style={{ background: "var(--brand-grad)", borderRadius: "18px 18px 4px 18px",
                      padding: "10px 16px", fontSize: 14, lineHeight: 1.6, color: "var(--text-on-brand)" }}>
                      {msg.text}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-disabled)", margin: "4px 8px 0 0", textAlign: "right" }}>{msg.time}</p>
                  </div>
                )}

                {/* Assistant bubble */}
                {msg.role === "assistant" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: "var(--brand-grad)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚖️</div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-meta)" }}>법무 에이전트</span>
                    </div>

                    {/* Text response */}
                    {msg.text && (
                      <div style={{ ...glass({ padding: "14px 18px", borderRadius: "4px 18px 18px 18px" }) }}>
                        <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0, color: "var(--text-assistant)", whiteSpace: "pre-wrap" }}>{msg.text}</p>
                      </div>
                    )}

                    {/* Analysis card */}
                    {msg.analysis && (
                      <div style={{ ...glass({ padding: "16px 18px", borderRadius: "4px 18px 18px 18px",
                        borderLeft: `3px solid ${RC[msg.analysis.overall_risk]?.border}` }) }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          <ScoreGauge score={msg.analysis.risk_score || 5} size={48} />
                          <div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: RC[msg.analysis.overall_risk]?.text,
                                background: RC[msg.analysis.overall_risk]?.bg, padding: "2px 7px", borderRadius: 4 }}>
                                리스크 {RC[msg.analysis.overall_risk]?.label}
                              </span>
                              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{msg.analysis.issues?.length || 0}건 이슈</span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                              {msg.analysis.summary?.slice(0, 100)}{msg.analysis.summary?.length > 100 ? "..." : ""}
                            </p>
                          </div>
                        </div>

                        {/* Top 3 issues preview */}
                        {msg.analysis.issues?.slice(0, 3).map((issue, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                            borderRadius: 7, background: "var(--surface-row)", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: RC[issue.risk_level]?.text, background: RC[issue.risk_level]?.bg,
                              padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>{RC[issue.risk_level]?.label}</span>
                            <span style={{ fontSize: 12, color: "var(--text-chip)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.title}</span>
                          </div>
                        ))}
                        {(msg.analysis.issues?.length || 0) > 3 && (
                          <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: "4px 0 0", textAlign: "center" }}>외 {msg.analysis.issues.length - 3}건</p>
                        )}

                        <button onClick={() => openAnalysis(msg.analysis, msg.sourceFileName)} style={{
                          display: "block", width: "100%", marginTop: 10, padding: "9px",
                          background: "var(--accent-button-bg)", border: "1px solid var(--accent-button-border)",
                          borderRadius: 8, color: "var(--brand-500)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                          📊 상세 리포트 보기
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: "var(--text-disabled)", margin: "4px 8px 0" }}>{msg.time}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
              <div style={{ ...glass({ padding: "14px 20px", borderRadius: "4px 18px 18px 18px" }) }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 1, 2].map((n) => (
                      <div key={n} style={{
                        width: 7, height: 7, borderRadius: "50%", background: "var(--brand-500)",
                        animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite`,
                      }}/>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-meta)", marginLeft: 6 }}>분석 중...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef}/>
        </div>
      </div>

      {/* Input bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
        background: "linear-gradient(transparent, var(--bg-base) 30%)", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Attached file preview */}
          {attachedFile && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent-attach-bg)", border: "1px solid var(--accent-attach-border)",
              borderRadius: 10, padding: "6px 12px", marginBottom: 8, fontSize: 12, color: "var(--accent-recommend)" }}>
              📎 {attachedFile.name}
              <button onClick={removeFile} style={{ background: "none", border: "none", color: "var(--risk-high)", fontSize: 14, cursor: "pointer", padding: 0, marginLeft: 4 }}>×</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {/* File attach button */}
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{
              width: 40, height: 40, borderRadius: 12, border: "1px solid var(--surface-border-08)",
              background: "var(--surface-panel)", color: "var(--text-meta)", fontSize: 18,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              +
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md,.csv"
              style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); e.target.value = ""; }} />

            {/* Text input */}
            <div style={{ flex: 1, position: "relative" }}>
              <textarea ref={textAreaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="계약 조항, 법률 질문, 또는 검토할 내용을 입력하세요..."
                rows={1}
                style={{
                  width: "100%", padding: "10px 48px 10px 16px", borderRadius: 14,
                  border: "1px solid var(--surface-border-10)", background: "var(--surface-panel)",
                  color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5, resize: "none",
                  outline: "none", fontFamily: "inherit", minHeight: 40, maxHeight: 160,
                  boxSizing: "border-box",
                }}/>
              <button onClick={sendMessage} disabled={loading || (!input.trim() && !fileContent)}
                style={{
                  position: "absolute", right: 6, bottom: 5, width: 32, height: 32, borderRadius: 10,
                  border: "none", cursor: loading ? "default" : "pointer",
                  background: (input.trim() || fileContent) && !loading ? "var(--brand-grad)" : "var(--surface-send-idle)",
                  color: "var(--text-on-brand)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}>↑</button>
            </div>
          </div>

          <p style={{ fontSize: 9, color: "var(--text-footer)", textAlign: "center", margin: "8px 0 0" }}>
            AI 사전 검토이며 법적 효력 없음 · 최종 법무 검토는 법무팀 진행
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        textarea::placeholder { color: var(--text-tertiary); }
        textarea:focus { border-color: var(--accent-focus-border); }
      `}</style>
    </div>
  );
}
