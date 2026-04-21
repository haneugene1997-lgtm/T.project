/**
 * Gemini API 프록시 — API 키는 서버(환경 변수)에만 둡니다.
 * Vercel: 프로젝트 설정에 GEMINI_API_KEY 추가
 *
 * Node(req,res) 대신 Edge(Request)를 쓰면 POST JSON 본문이 항상 request.json()으로 파싱됩니다.
 * (Vercel Node 런타임에서 req.body가 비는 이슈 회피)
 */
export const config = { runtime: "edge" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return json(
      {
        error: "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Vercel 환경 변수를 확인하세요.",
      },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const {
    model = process.env.GEMINI_MODEL || "gemini-1.5-flash",
    max_tokens = 4096,
    system,
    messages,
  } = body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json(
      {
        error: "messages 배열이 필요합니다.",
        code: "MISSING_MESSAGES",
        hint: "요청 본문이 비었거나, 브라우저가 예전 프론트(JS)를 캐시한 경우입니다. Cmd+Shift+R(강력 새로고침) 후 다시 시도해 주세요.",
      },
      400
    );
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

    /* 무료 등급은 모델마다 한도가 0인 경우가 많아, 1.5 Flash 계열을 먼저 시도 */
    const candidates = [
      ...new Set([
        model,
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
      ]),
    ].filter(Boolean);
    let availableModelNames = [];
    try {
      const modelsRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
      );
      const modelsJson = await modelsRes.json();
      availableModelNames = (modelsJson?.models || [])
        .filter((m) => (m?.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m?.name || "").replace(/^models\//, ""));
    } catch {
      // 모델 목록 조회 실패 시에도 하드코딩 후보로 계속 시도
    }
    const fallbackModels = [...new Set([...candidates, ...availableModelNames])];
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
        return json(
          {
            error: "Gemini 응답 파싱 실패",
            detail: text.slice(0, 500),
          },
          502
        );
      }
      const errLower = String(data?.error?.message || "").toLowerCase();
      const isModelNotFound = r.status === 404 || errLower.includes("not found");
      if (!isModelNotFound) break;
    }

    if (!r.ok) {
      const lower = String(data?.error?.message || "").toLowerCase();
      const isQuotaIssue =
        r.status === 429 ||
        lower.includes("quota") ||
        lower.includes("resource_exhausted") ||
        lower.includes("billing") ||
        lower.includes("exceeded") ||
        lower.includes("insufficient");
      return json(
        {
          error: isQuotaIssue
            ? "Gemini 쿼터/한도 문제입니다. AI Studio 비율 제한에서 해당 모델 RPM·RPD가 0이면 무료로는 호출이 불가합니다. Vercel 환경변수 GEMINI_MODEL을 gemini-1.5-flash처럼 한도가 있는 모델로 두거나, 결제를 활성화하세요. (스튜디오 사용량 0과 별개로, 실패 요청도 여기서 막힐 수 있습니다.)"
            : data.error?.message || data.error?.status || "Gemini API 오류",
          detail: data,
        },
        r.status
      );
    }

    const responseText = (data.candidates || [])
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("");

    return json({
      ...data,
      model: usedModel,
      content: [{ type: "text", text: responseText }],
    });
  } catch (e) {
    return json(
      {
        error: e.message || "프록시 요청 실패",
      },
      500
    );
  }
}
