/**
 * Anthropic API 프록시 — API 키는 서버(환경 변수)에만 둡니다.
 * Vercel: 프로젝트 설정에 ANTHROPIC_API_KEY 추가
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. Vercel 환경 변수를 확인하세요.",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const {
    model = "claude-sonnet-4-20250514",
    max_tokens = 4096,
    system,
    messages,
  } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 배열이 필요합니다." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        ...(system != null ? { system } : {}),
        messages,
      }),
    });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Anthropic 응답 파싱 실패",
        detail: text.slice(0, 500),
      });
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: data.error?.message || data.error?.type || "Anthropic API 오류",
        detail: data,
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      error: e.message || "프록시 요청 실패",
    });
  }
}
