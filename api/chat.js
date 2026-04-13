/**
 * Gemini API 프록시 — API 키는 서버(환경 변수)에만 둡니다.
 * Vercel: 프로젝트 설정에 GEMINI_API_KEY 추가
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Vercel 환경 변수를 확인하세요.",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const {
    model = process.env.GEMINI_MODEL || "gemini-1.5-flash",
    max_tokens = 4096,
    system,
    messages,
  } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 배열이 필요합니다." });
  }

  try {
    const toGeminiParts = (content) => {
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (item?.type === "text") return { text: item.text || "" };
            if (
              item?.type === "document" &&
              item?.source?.type === "base64" &&
              item?.source?.media_type &&
              item?.source?.data
            ) {
              return {
                inline_data: {
                  mime_type: item.source.media_type,
                  data: item.source.data,
                },
              };
            }
            return null;
          })
          .filter(Boolean);
      }
      return [{ text: String(content ?? "") }];
    };

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(m.content),
    }));

    const requestBody = {
      ...(system != null
        ? {
            systemInstruction: {
              role: "system",
              parts: [{ text: system }],
            },
          }
        : {}),
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature: 0.2,
      },
    };

    const fallbackModels = [model, "gemini-1.5-flash", "gemini-1.5-flash-latest"];
    let r;
    let data;
    let usedModel = model;
    for (const m of fallbackModels) {
      if (!m) continue;
      usedModel = m;
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );
      const text = await r.text();
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(502).json({
          error: "Gemini 응답 파싱 실패",
          detail: text.slice(0, 500),
        });
      }
      const errLower = String(data?.error?.message || "").toLowerCase();
      const isModelNotFound = r.status === 404 || errLower.includes("not found");
      if (!isModelNotFound) break;
    }

    if (!r.ok) {
      const lower = String(data?.error?.message || "").toLowerCase();
      const isQuotaIssue =
        lower.includes("quota") ||
        lower.includes("billing") ||
        lower.includes("exceeded") ||
        lower.includes("insufficient");
      return res.status(r.status).json({
        error: isQuotaIssue
          ? "Gemini API 사용량/결제 한도에 도달했습니다. Google AI Studio 또는 GCP 결제/쿼터를 확인해주세요."
          : data.error?.message || data.error?.status || "Gemini API 오류",
        detail: data,
      });
    }

    const responseText = (data.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("");

    // 기존 프론트 호환을 위해 Anthropic 형태(content[])로 감싸서 반환
    return res.status(200).json({
      ...data,
      model: usedModel,
      content: [{ type: "text", text: responseText }],
    });
  } catch (e) {
    return res.status(500).json({
      error: e.message || "프록시 요청 실패",
    });
  }
}
