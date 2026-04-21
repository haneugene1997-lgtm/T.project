"use client";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";

/* ═══════════════════════════════════════════════
   UI용 법령 DB (표시용)
   ═══════════════════════════════════════════════ */
const LEGAL_DB = {
  pipa: { id: "pipa", name: "개인정보 보호법", icon: "🔒", color: "#007aff" },
  telecom: { id: "telecom", name: "전기통신사업법", icon: "📡", color: "#5856d6" },
  ict: { id: "ict", name: "정보통신망법", icon: "🌐", color: "#34c759" },
  fair: { id: "fair", name: "공정거래법", icon: "⚖️", color: "#ff9500" },
  labor: { id: "labor", name: "근로기준법", icon: "👷", color: "#ff2d55" },
  subcon: { id: "subcon", name: "하도급법", icon: "🤝", color: "#af52de" },
};

const RC = {
  high: { bg: "rgba(255,59,48,0.12)", border: "rgba(255,59,48,0.4)", text: "#ff3b30", label: "높음" },
  medium: { bg: "rgba(255,159,10,0.12)", border: "rgba(255,159,10,0.4)", text: "#ff9f0a", label: "중간" },
  low: { bg: "rgba(48,209,88,0.12)", border: "rgba(48,209,88,0.4)", text: "#30d158", label: "낮음" },
};
const VT = {
  omission: { label: "누락", color: "#ff9f0a" },
  active_violation: { label: "위반", color: "#ff3b30" },
  ambiguity: { label: "모호", color: "#5ac8fa" },
};

const glass = (x = {}) => ({
  background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, ...x,
});

/* ═══════════════════════════════════════════════
   Sub Components
   ═══════════════════════════════════════════════ */
function ScoreGauge({ score, size = 64 }) {
  const r = (size - 6) / 2, c = Math.PI * 2 * r, pct = score / 10;
  const color = score >= 7 ? "#ff3b30" : score >= 4 ? "#ff9f0a" : "#30d158";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.14, color: "#636366" }}>/10</span>
      </div>
    </div>
  );
}

function RadarChart({ lawStats, size = 220 }) {
  const laws = Object.entries(lawStats);
  if (laws.length < 3) return null;
  const cx = size / 2, cy = size / 2, maxR = size * 0.35;
  const n = laws.length, step = (Math.PI * 2) / n;
  const pt = (i, val) => { const a = step * i - Math.PI / 2; return [cx + (val / 10) * maxR * Math.cos(a), cy + (val / 10) * maxR * Math.sin(a)]; };
  const poly = laws.map(([, s], i) => pt(i, s.maxScore || 0).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", margin: "0 auto" }}>
      {[2.5, 5, 7.5, 10].map((lv) => (
        <polygon key={lv} points={Array.from({ length: n }, (_, i) => pt(i, lv).join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
      ))}
      <polygon points={poly} fill="rgba(0,122,255,0.1)" stroke="#007aff" strokeWidth="1.5" strokeLinejoin="round"/>
      {laws.map(([id], i) => {
        const law = LEGAL_DB[id], a = step * i - Math.PI / 2, lr = maxR + 24;
        return <text key={id} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)}
          textAnchor="middle" dominantBaseline="middle" fill={law?.color || "#888"} fontSize="10" fontWeight="600">
          {law?.icon}{law?.name?.slice(0, 3)}
        </text>;
      })}
    </svg>
  );
}

/* PDF 리포트 */
function generatePDFReport(result) {
  const riskColor = RC[result.overall_risk]?.text || "#ff9f0a";
  const now = new Date().toLocaleString("ko-KR");
  const issueRows = (result.issues || []).map((issue, i) => `<tr><td style="text-align:center;font-weight:700">${i+1}</td>
    <td><strong>${issue.title}</strong><br/><span style="font-size:11px;color:#666">${issue.description}</span></td>
    <td style="text-align:center"><span style="color:${RC[issue.risk_level]?.text};font-weight:700">${RC[issue.risk_level]?.label}</span></td>
    <td style="font-size:12px">${issue.related_law}<br/>${issue.clause}</td>
    <td style="font-size:12px">${issue.recommendation}</td></tr>`).join("");
  const checkRows = (result.checklist || []).map((item) => {
    const icon = { pass: "✅", fail: "❌", warning: "⚠️" }[item.status] || "➖";
    return `<tr><td style="text-align:center">${icon}</td><td>${item.item}</td><td style="font-size:12px">${item.article || ""}</td><td style="font-size:12px">${item.note || ""}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>법무 검토 리포트</title>
<style>@page{size:A4;margin:20mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Pretendard',-apple-system,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.7}
.header{display:flex;justify-content:space-between;border-bottom:3px solid #007aff;padding-bottom:14px;margin-bottom:20px}.header h1{font-size:20px;color:#007aff}
.meta{text-align:right;font-size:11px;color:#666}.summary-box{background:#f5f7fa;border-radius:8px;padding:16px;margin-bottom:18px;border-left:4px solid ${riskColor}}
h2{font-size:15px;margin:24px 0 10px;border-bottom:1px solid #e5e5ea;padding-bottom:5px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
th{background:#f0f2f5;padding:7px;text-align:left;border-bottom:2px solid #d1d5db}td{padding:7px;border-bottom:1px solid #e5e5ea;vertical-align:top}
.footer{margin-top:28px;border-top:1px solid #e5e5ea;padding-top:10px;font-size:10px;color:#999;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header"><div><h1>⚖️ SKT 법무 컴플라이언스 검토 리포트</h1></div>
<div class="meta"><p>${now}</p><p style="margin-top:5px;font-size:14px;font-weight:700;color:${riskColor}">리스크 ${RC[result.overall_risk]?.label} (${result.risk_score}/10)</p></div></div>
<div class="summary-box"><strong>📋 요약</strong><br/>${result.summary}${result.needs_legal_review?`<br/><br/><strong style="color:#d97706">⚠️ 법무팀 검토 권고:</strong> ${result.legal_review_reason||""}`:""}</div>
${result.priority_actions?.length?`<div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:18px"><strong>🚨 우선 시정</strong><ul>${result.priority_actions.map(a=>`<li style="color:#dc2626">${a}</li>`).join("")}</ul></div>`:""}
<h2>📌 이슈 (${result.issues?.length||0}건)</h2><table><thead><tr><th>#</th><th>이슈</th><th>리스크</th><th>법령</th><th>권고</th></tr></thead><tbody>${issueRows}</tbody></table>
<h2>✅ 체크리스트</h2><table><thead><tr><th>상태</th><th>항목</th><th>조항</th><th>비고</th></tr></thead><tbody>${checkRows}</tbody></table>
<div class="footer"><p>⚠️ AI 사전 검토이며 법적 효력 없음 · SKT Legal Compliance Agent v3.5 · ${now}</p></div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
}

/* ═══════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════ */
export default function SKTLegalChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [analysisTab, setAnalysisTab] = useState("dashboard");
  const [filterLaw, setFilterLaw] = useState("all");
  const [expandedIssues, setExpandedIssues] = useState({});

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    if (textAreaRef.current) { textAreaRef.current.style.height = "auto"; textAreaRef.current.style.height = Math.min(textAreaRef.current.scrollHeight, 160) + "px"; }
  }, [input]);

  const handleFileSelect = useCallback((f) => {
    if (!f || f.size > 10 * 1024 * 1024) return;
    const ext = f.name.split(".").pop().toLowerCase();
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

  const sendMessage = async (textOverride) => {
    if (loading) return;
    const text = (textOverride != null ? String(textOverride) : input).trim();
    if (!text && !fileContent) return;

    const userMsg = {
      role: "user", text: text || `📎 ${attachedFile?.name} 분석 요청`,
      file: attachedFile ? { ...attachedFile } : null,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput(""); setLoading(true);

    try {
      // 서버 API Route 호출
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || "이 문서를 법무 컴플라이언스 관점에서 분석해주세요.",
          fileData: fileContent?.data || null,
          fileType: fileContent?.type || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `서버 오류 ${res.status}`);

      const assistantMsg = {
        role: "assistant",
        text: data.text || null,
        analysis: data.analysis || null,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: `⚠️ 오류: ${err.message}`,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setLoading(false); setAttachedFile(null); setFileContent(null);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const openAnalysis = (a) => { setActiveAnalysis(a); setAnalysisTab("dashboard"); setFilterLaw("all"); setExpandedIssues({}); };

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
    if (!activeAnalysis?.checklist) return { pass: 0, fail: 0, warning: 0 };
    const s = { pass: 0, fail: 0, warning: 0 };
    activeAnalysis.checklist.forEach((c) => { if (s[c.status] !== undefined) s[c.status]++; });
    return s;
  }, [activeAnalysis]);

  /* ═══ ANALYSIS DETAIL VIEW ═══ */
  if (activeAnalysis) {
    const r = activeAnalysis;
    return (
      <div style={{ minHeight: "100vh", background: "#08080d", color: "#e5e5ea",
        fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
          <button onClick={() => setActiveAnalysis(null)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "7px 16px", color: "#007aff", fontSize: 13, cursor: "pointer", marginBottom: 20 }}>← 대화로 돌아가기</button>

          <div style={{ ...glass({ padding: "20px 24px", marginBottom: 16 }), borderLeft: `3px solid ${RC[r.overall_risk]?.border}`,
            display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <ScoreGauge score={r.risk_score || 5} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: RC[r.overall_risk]?.text,
                  background: RC[r.overall_risk]?.bg, border: `1px solid ${RC[r.overall_risk]?.border}`,
                  padding: "2px 8px", borderRadius: 5 }}>리스크 {RC[r.overall_risk]?.label}</span>
                {r.needs_legal_review && <span style={{ fontSize: 11, color: "#ff9f0a", background: "rgba(255,159,10,0.1)", padding: "2px 7px", borderRadius: 5 }}>법무팀 검토 권고</span>}
              </div>
              <p style={{ fontSize: 13, color: "#b0b0b8", margin: 0, lineHeight: 1.7 }}>{r.summary}</p>
            </div>
          </div>

          {r.priority_actions?.length > 0 && (
            <div style={{ ...glass({ padding: "12px 16px", marginBottom: 14, borderLeft: "3px solid rgba(255,59,48,0.35)" }) }}>
              <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 6px", color: "#ff6961" }}>🚨 우선 시정</p>
              {r.priority_actions.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#e5e5ea", lineHeight: 1.5, marginBottom: 3 }}>• {a}</div>)}
            </div>
          )}

          {r.needs_legal_review && r.legal_review_reason && (
            <div style={{ ...glass({ padding: "10px 14px", marginBottom: 14, background: "rgba(255,159,10,0.04)", border: "1px solid rgba(255,159,10,0.1)" }) }}>
              <span style={{ fontSize: 12, color: "#d4a04a" }}>💡 <strong>법무팀 검토 사유:</strong> {r.legal_review_reason}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 3, marginBottom: 16, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3 }}>
            {[{ key: "dashboard", label: "대시보드" }, { key: "issues", label: `이슈 (${filteredIssues.length})` }, { key: "checklist", label: `체크리스트` }].map((tab) => (
              <button key={tab.key} onClick={() => setAnalysisTab(tab.key)} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none",
                background: analysisTab === tab.key ? "rgba(0,122,255,0.12)" : "transparent",
                color: analysisTab === tab.key ? "#007aff" : "#636366", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                {tab.label}</button>
            ))}
          </div>

          {analysisTab === "dashboard" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 16 }}>
                {["high", "medium", "low"].map((lv) => (
                  <div key={lv} style={{ background: RC[lv].bg, border: `1px solid ${RC[lv].border}`, borderRadius: 10, padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: RC[lv].text }}>{r.issues?.filter((i) => i.risk_level === lv).length || 0}</div>
                    <div style={{ fontSize: 10, color: "#8e8e93" }}>리스크 {RC[lv].label}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...glass({ padding: "12px 16px", marginBottom: 16 }) }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6 }}>체크리스트</p>
                <div style={{ display: "flex", gap: 5, height: 7, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
                  {checkStats.pass > 0 && <div style={{ flex: checkStats.pass, background: "#30d158", borderRadius: 3 }}/>}
                  {checkStats.warning > 0 && <div style={{ flex: checkStats.warning, background: "#ff9f0a", borderRadius: 3 }}/>}
                  {checkStats.fail > 0 && <div style={{ flex: checkStats.fail, background: "#ff3b30", borderRadius: 3 }}/>}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "#8e8e93" }}>
                  <span>✅ {checkStats.pass}</span><span>⚠️ {checkStats.warning}</span><span>❌ {checkStats.fail}</span>
                </div>
              </div>
              {Object.keys(lawStats).length >= 3 && (
                <div style={{ ...glass({ padding: "14px" }) }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6, textAlign: "center" }}>법령별 리스크</p>
                  <RadarChart lawStats={lawStats} />
                </div>
              )}
            </div>
          )}

          {analysisTab === "issues" && (
            <div>
              {Object.keys(lawStats).length > 1 && (
                <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setFilterLaw("all")} style={{ ...glass({ padding: "4px 9px", fontSize: 10, cursor: "pointer",
                    color: filterLaw === "all" ? "#007aff" : "#636366" }) }}>전체</button>
                  {Object.keys(lawStats).map((id) => {
                    const law = LEGAL_DB[id]; if (!law) return null;
                    return <button key={id} onClick={() => setFilterLaw(filterLaw === id ? "all" : id)} style={{ ...glass({ padding: "4px 9px", fontSize: 10, cursor: "pointer",
                      color: filterLaw === id ? law.color : "#636366" }) }}>{law.icon} {lawStats[id].count}</button>;
                  })}
                </div>
              )}
              {filteredIssues.map((issue, i) => {
                const vt = VT[issue.violation_type], exp = expandedIssues[issue.id] !== false;
                return (
                  <div key={i} style={{ ...glass({ padding: exp ? "16px 20px" : "10px 20px", marginBottom: 8, borderLeft: `3px solid ${RC[issue.risk_level]?.border}` }) }}>
                    <div onClick={() => setExpandedIssues((p) => ({ ...p, [issue.id]: !exp }))} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: RC[issue.risk_level]?.text, background: RC[issue.risk_level]?.bg, padding: "2px 6px", borderRadius: 4 }}>{RC[issue.risk_level]?.label} ({issue.severity_score}/10)</span>
                      {vt && <span style={{ fontSize: 9, color: vt.color, background: `${vt.color}12`, padding: "1px 5px", borderRadius: 3 }}>{vt.label}</span>}
                      <span style={{ fontSize: 10, color: "#48484a" }}>{LEGAL_DB[issue.related_law_id]?.icon} {issue.clause}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#48484a" }}>{exp ? "▲" : "▼"}</span>
                    </div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, margin: "6px 0 0" }}>{issue.title}</h3>
                    {exp && <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 12, color: "#a0a0a8", margin: "0 0 8px", lineHeight: 1.7 }}>{issue.description}</p>
                      <div style={{ background: "rgba(0,122,255,0.05)", borderRadius: 7, padding: "7px 10px", fontSize: 11, color: "#64b5f6", lineHeight: 1.5 }}>💡 {issue.recommendation}</div>
                      {issue.sample_clause && <div style={{ marginTop: 5, background: "rgba(48,209,88,0.05)", borderRadius: 7, padding: "7px 10px", fontSize: 10, color: "#30d158" }}>✏️ {issue.sample_clause}</div>}
                    </div>}
                  </div>
                );
              })}
            </div>
          )}

          {analysisTab === "checklist" && (() => {
            const groups = {};
            (r.checklist || []).forEach((item) => { const cat = item.category || "other"; if (!groups[cat]) groups[cat] = []; groups[cat].push(item); });
            return Object.entries(groups).map(([cat, items]) => {
              const law = LEGAL_DB[cat];
              return <div key={cat} style={{ marginBottom: 12 }}>
                {law && <div style={{ display: "flex", gap: 4, marginBottom: 5 }}><span style={{ fontSize: 12 }}>{law.icon}</span><span style={{ fontSize: 11, fontWeight: 600, color: law.color }}>{law.name}</span></div>}
                {items.map((item, i) => {
                  const st = { pass: { i: "✅", b: "rgba(48,209,88,0.06)" }, fail: { i: "❌", b: "rgba(255,59,48,0.06)" }, warning: { i: "⚠️", b: "rgba(255,159,10,0.06)" } }[item.status] || { i: "➖", b: "rgba(142,142,147,0.03)" };
                  return <div key={i} style={{ display: "flex", gap: 8, background: st.b, borderRadius: 7, padding: "8px 12px", marginBottom: 3 }}>
                    <span style={{ fontSize: 13 }}>{st.i}</span>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 12, margin: 0 }}>{item.item}</p>{item.note && <p style={{ fontSize: 10, color: "#636366", margin: "2px 0 0" }}>{item.note}</p>}</div>
                  </div>;
                })}
              </div>;
            });
          })()}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={() => setActiveAnalysis(null)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#e5e5ea", fontSize: 12, cursor: "pointer" }}>← 대화</button>
            <button onClick={() => generatePDFReport(r)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#ff9500,#ff2d55)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>📄 PDF</button>
            <button onClick={() => { const b = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b);
              const a = document.createElement("a"); a.href = u; a.download = `legal-review-${Date.now()}.json`; a.click(); URL.revokeObjectURL(u); }}
              style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#007aff,#5e5ce6)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>📥 JSON</button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══ CHAT VIEW ═══ */
  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#e5e5ea", display: "flex", flexDirection: "column",
      fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: 600, height: 600, top: "-12%", right: "-10%", background: "radial-gradient(circle,rgba(0,122,255,0.06) 0%,transparent 70%)", filter: "blur(80px)" }}/>
        <div style={{ position: "absolute", width: 400, height: 400, bottom: "-8%", left: "-5%", background: "radial-gradient(circle,rgba(94,92,230,0.04) 0%,transparent 70%)", filter: "blur(70px)" }}/>
      </div>

      <header style={{ position: "relative", zIndex: 2, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#007aff,#5e5ce6)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚖️</div>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>SKT 법무 검토 에이전트</h1>
          <p style={{ fontSize: 11, color: "#636366", margin: 0 }}>6대 법령 기반 컴플라이언스 AI</p>
        </div>
      </header>

      <div style={{ flex: 1, position: "relative", zIndex: 1, overflowY: "auto", padding: "20px 20px 120px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px 40px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.8 }}>⚖️</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 10px",
                background: "linear-gradient(135deg,#fff,#8e8ea0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                무엇을 검토해 드릴까요?
              </h2>
              <p style={{ fontSize: 13, color: "#636366", lineHeight: 1.7, maxWidth: 400, margin: "0 auto 28px" }}>
                계약 조항, 약관 내용, 정책 문구 등을<br/>텍스트로 바로 보내거나 파일을 첨부해 주세요
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500, margin: "0 auto" }}>
                {[
                  "개인정보 제3자 제공 시 필수 동의 항목은?",
                  "하도급 대금 지급기한 관련 규정 알려줘",
                  "이용약관에 일방적 변경 조항이 있으면 문제 돼?",
                  "통신비밀 보호 관련 SKT가 주의할 점은?",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => { setInput(prompt); void sendMessage(prompt); }}
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#a0a0a8",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s", lineHeight: 1.4 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,122,255,0.08)"; e.currentTarget.style.color = "#007aff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#a0a0a8"; }}>
                    {prompt}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 24 }}>
                {Object.values(LEGAL_DB).map((law) => (
                  <div key={law.id} style={{ display: "flex", alignItems: "center", gap: 4,
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "#48484a" }}>
                    <span>{law.icon}</span>{law.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 14 }}>
              <div style={{ maxWidth: "85%", minWidth: 60 }}>
                {msg.role === "user" && (
                  <div>
                    {msg.file && <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,122,255,0.15)", borderRadius: "12px 12px 4px 12px", padding: "6px 12px", marginBottom: 4, fontSize: 11, color: "#64b5f6" }}>📎 {msg.file.name}</div>}
                    <div style={{ background: "linear-gradient(135deg,#007aff,#5856d6)", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", fontSize: 14, lineHeight: 1.6, color: "#fff" }}>{msg.text}</div>
                    <p style={{ fontSize: 10, color: "#48484a", margin: "4px 8px 0 0", textAlign: "right" }}>{msg.time}</p>
                  </div>
                )}
                {msg.role === "assistant" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#007aff,#5e5ce6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⚖️</div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#8e8e93" }}>법무 에이전트</span>
                    </div>
                    {msg.text && (
                      <div style={{ ...glass({ padding: "14px 18px", borderRadius: "4px 18px 18px 18px" }) }}>
                        <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0, color: "#d1d1d6", whiteSpace: "pre-wrap" }}>{msg.text}</p>
                      </div>
                    )}
                    {msg.analysis && (
                      <div style={{ ...glass({ padding: "16px 18px", borderRadius: "4px 18px 18px 18px", borderLeft: `3px solid ${RC[msg.analysis.overall_risk]?.border}` }) }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                          <ScoreGauge score={msg.analysis.risk_score || 5} size={48} />
                          <div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: RC[msg.analysis.overall_risk]?.text, background: RC[msg.analysis.overall_risk]?.bg, padding: "2px 7px", borderRadius: 4 }}>리스크 {RC[msg.analysis.overall_risk]?.label}</span>
                              <span style={{ fontSize: 10, color: "#636366" }}>{msg.analysis.issues?.length || 0}건</span>
                            </div>
                            <p style={{ fontSize: 12, color: "#a0a0a8", margin: 0, lineHeight: 1.5 }}>{msg.analysis.summary?.slice(0, 100)}...</p>
                          </div>
                        </div>
                        {msg.analysis.issues?.slice(0, 3).map((issue, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: RC[issue.risk_level]?.text, background: RC[issue.risk_level]?.bg, padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>{RC[issue.risk_level]?.label}</span>
                            <span style={{ fontSize: 12, color: "#c7c7cc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.title}</span>
                          </div>
                        ))}
                        <button onClick={() => openAnalysis(msg.analysis)} style={{
                          display: "block", width: "100%", marginTop: 10, padding: "9px",
                          background: "rgba(0,122,255,0.1)", border: "1px solid rgba(0,122,255,0.2)",
                          borderRadius: 8, color: "#007aff", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                          📊 상세 리포트 보기
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: "#48484a", margin: "4px 8px 0" }}>{msg.time}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
              <div style={{ ...glass({ padding: "14px 20px", borderRadius: "4px 18px 18px 18px" }) }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 1, 2].map((n) => <div key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: "#007aff", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }}/>)}
                  </div>
                  <span style={{ fontSize: 12, color: "#8e8e93", marginLeft: 6 }}>분석 중...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef}/>
        </div>
      </div>

      {/* Input */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10,
        background: "linear-gradient(transparent, #08080d 30%)", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {attachedFile && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(0,122,255,0.08)", border: "1px solid rgba(0,122,255,0.18)",
              borderRadius: 10, padding: "6px 12px", marginBottom: 8, fontSize: 12, color: "#64b5f6" }}>
              📎 {attachedFile.name}
              <button onClick={() => { setAttachedFile(null); setFileContent(null); }} style={{ background: "none", border: "none", color: "#ff3b30", fontSize: 14, cursor: "pointer", padding: 0 }}>×</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <button onClick={() => fileInputRef.current?.click()} style={{
              width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)", color: "#8e8e93", fontSize: 18,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt,.doc,.docx,.md,.csv"
              style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); e.target.value = ""; }} />
            <div style={{ flex: 1, position: "relative" }}>
              <textarea ref={textAreaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="계약 조항, 법률 질문, 또는 검토할 내용을 입력하세요..." rows={1}
                style={{ width: "100%", padding: "10px 48px 10px 16px", borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  color: "#e5e5ea", fontSize: 14, lineHeight: 1.5, resize: "none",
                  fontFamily: "inherit", minHeight: 40, maxHeight: 160, boxSizing: "border-box" }}/>
              <button onClick={sendMessage} disabled={loading || (!input.trim() && !fileContent)}
                style={{ position: "absolute", right: 6, bottom: 5, width: 32, height: 32, borderRadius: 10, border: "none",
                  cursor: loading ? "default" : "pointer",
                  background: (input.trim() || fileContent) && !loading ? "linear-gradient(135deg,#007aff,#5e5ce6)" : "rgba(255,255,255,0.06)",
                  color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
            </div>
          </div>
          <p style={{ fontSize: 9, color: "#3a3a3c", textAlign: "center", margin: "8px 0 0" }}>
            AI 사전 검토이며 법적 효력 없음 · 최종 법무 검토는 법무팀 진행
          </p>
        </div>
      </div>
    </div>
  );
}
