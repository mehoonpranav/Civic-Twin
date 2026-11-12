/**
 * Server-only AI helpers for CivicTwin.
 * Providers (first match wins):
 *   1. AI_API_KEY + AI_PROVIDER
 *   2. OPENAI_API_KEY / OPENROUTER_API_KEY / ANTHROPIC_API_KEY / VYCEAI_API_KEY
 */

export interface ChatMessage {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

type Provider = "openai" | "openrouter" | "anthropic" | "vyce" | "custom";

interface ResolvedAI {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function resolveAI(): ResolvedAI {
  const explicitKey = firstEnv("AI_API_KEY");
  const explicitProvider = (firstEnv("AI_PROVIDER") || "").toLowerCase() as Provider | "";
  const explicitModel = firstEnv("AI_MODEL");
  const explicitBase = firstEnv("AI_BASE_URL");

  if (explicitKey && (explicitProvider === "anthropic" || explicitBase?.includes("anthropic.com"))) {
    return {
      provider: "anthropic",
      apiKey: explicitKey,
      baseUrl: explicitBase || "https://api.anthropic.com",
      model: explicitModel || "claude-sonnet-4-5",
    };
  }

  if (explicitKey) {
    const provider: Provider =
      explicitProvider === "openrouter" || explicitProvider === "vyce" || explicitProvider === "custom"
        ? explicitProvider
        : explicitProvider === "openai"
          ? "openai"
          : explicitBase
            ? "custom"
            : "openai";
    const defaults: Record<Provider, { baseUrl: string; model: string }> = {
      openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
      openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
      vyce: { baseUrl: "https://vyceai.com/v1", model: "auto" },
      custom: { baseUrl: explicitBase || "https://api.openai.com/v1", model: "gpt-4o-mini" },
      anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
    };
    return {
      provider,
      apiKey: explicitKey,
      baseUrl: explicitBase || defaults[provider].baseUrl,
      model: explicitModel || defaults[provider].model,
    };
  }

  const openrouter = firstEnv("OPENROUTER_API_KEY");
  if (openrouter) {
    return {
      provider: "openrouter",
      apiKey: openrouter,
      baseUrl: "https://openrouter.ai/api/v1",
      model: explicitModel || "openai/gpt-4o-mini",
    };
  }

  const openai = firstEnv("OPENAI_API_KEY");
  if (openai) {
    return {
      provider: "openai",
      apiKey: openai,
      baseUrl: explicitBase || "https://api.openai.com/v1",
      model: explicitModel || "gpt-4o-mini",
    };
  }

  const anthropic = firstEnv("ANTHROPIC_API_KEY");
  if (anthropic) {
    return {
      provider: "anthropic",
      apiKey: anthropic,
      baseUrl: "https://api.anthropic.com",
      model: explicitModel || "claude-sonnet-4-5",
    };
  }

  const vyce = firstEnv("VYCEAI_API_KEY");
  if (vyce) {
    return {
      provider: "vyce",
      apiKey: vyce,
      baseUrl: "https://vyceai.com/v1",
      model: explicitModel || "auto",
    };
  }

  throw new Error(
    "NO_AI_KEY: set AI_API_KEY (recommended) or OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY on the Vercel project.",
  );
}

async function imageToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not download photo for AI (${res.status}). Check that the Storage bucket report-photos is public.`);
  }
  const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0] || "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > 4_500_000) {
    throw new Error("Photo is too large for AI triage. Use a smaller image.");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function withInlinedImages(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];
  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push(message);
      continue;
    }
    const content = [];
    for (const part of message.content) {
      if (part.type !== "image_url") {
        content.push(part);
        continue;
      }
      content.push({
        type: "image_url" as const,
        image_url: { url: await imageToDataUrl(part.image_url.url) },
      });
    }
    out.push({ role: message.role, content });
  }
  return out;
}

async function callOpenAICompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 1024 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content
        .map((b) =>
          typeof b === "string"
            ? b
            : typeof (b as { text?: unknown })?.text === "string"
              ? (b as { text: string }).text
              : "",
        )
        .join("")
    : content;
  if (typeof text !== "string" || !text.trim()) throw new Error("AI returned an empty response");
  return text;
}

function toAnthropicContent(content: ChatMessage["content"]) {
  if (typeof content === "string") return [{ type: "text" as const, text: content }];
  return content.map((part) => {
    if (part.type === "text") return { type: "text" as const, text: part.text };
    const url = part.image_url.url;
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return { type: "text" as const, text: "[unsupported image]" };
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: match[1], data: match[2] },
      };
    }
    return {
      type: "image" as const,
      source: { type: "url" as const, url },
    };
  });
}

async function callAnthropic(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter(Boolean)
    .join("\n");
  const converted = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "user" ? "user" : "user",
      content: toAnthropicContent(m.content),
    }));

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.2,
      ...(system ? { system } : {}),
      messages: converted,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new Error("AI returned an empty response");
  return text;
}

export async function callAI(messages: ChatMessage[]) {
  const cfg = resolveAI();
  const prepared = await withInlinedImages(messages);
  if (cfg.provider === "anthropic") {
    return callAnthropic(cfg.baseUrl, cfg.model, cfg.apiKey, prepared);
  }
  return callOpenAICompatible(cfg.baseUrl, cfg.model, cfg.apiKey, prepared);
}

export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate: string = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response was not valid JSON");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

export type PhotoRejectCode = "ok" | "nsfw" | "blank" | "unrelated" | "unclear";

export interface PhotoAnalysis {
  accepted: boolean;
  reject_code: PhotoRejectCode;
  warning: string;
  category: string;
  severity: string;
  impact_score: number;
  title: string;
  summary: string;
}

const REJECT_WARNING: Record<PhotoRejectCode, string> = {
  ok: "",
  nsfw: "This photo is not allowed. Upload a photo of a real city problem only.",
  blank: "This photo looks blank or empty. Take a clear picture of the actual problem.",
  unrelated:
    "This does not look like a civic issue. Upload a photo of the road, drain, flood, garbage, or streetlight.",
  unclear: "The photo is too unclear. Take a closer, well-lit shot of the problem.",
};

function rejectedAnalysis(code: PhotoRejectCode, warning?: string): PhotoAnalysis {
  return {
    accepted: false,
    reject_code: code,
    warning: warning || REJECT_WARNING[code],
    category: "other",
    severity: "low",
    impact_score: 0,
    title: "",
    summary: "",
  };
}

const CIVIC_HINT =
  /\b(pothole|pot[- ]hole|crater|flood|flooded|waterlog|standing water|underpass|submerged|puddle|garbage|trash|litter|dump|streetlight|street[- ]light|drain|drainage|manhole|sewer|road|asphalt|pavement|footpath|sidewalk)\b/i;

const REJECT_HINTS: { code: PhotoRejectCode; pattern: RegExp }[] = [
  { code: "nsfw", pattern: /\b(nude|naked|nsfw|porn|sex|sexual|genitals?|lingerie)\b/i },
  { code: "blank", pattern: /\b(blank image|empty frame|solid color|all[- ]white background|all[- ]black background)\b/i },
  {
    code: "unrelated",
    pattern:
      /\b(pizza|burger|sandwich|pasta|food on a plate|selfie|meme|bedroom|kitchen interior|puppy|kitten|pet portrait|flower bouquet)\b/i,
  },
];

function inferRejectFromText(text: string): PhotoRejectCode | null {
  if (CIVIC_HINT.test(text)) return null;
  for (const hint of REJECT_HINTS) {
    if (hint.pattern.test(text)) return hint.code;
  }
  return null;
}

async function moderatePhoto(imageUrl: string): Promise<{ ok: true } | { ok: false; code: PhotoRejectCode; warning: string }> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Look at the photo and say what is in it.

ACCEPT street problems: pothole, flooded/wet road, garbage on a street, broken streetlight, damaged pavement, blocked drain. People or cars in a flood photo are still ACCEPT.

REJECT only obvious junk: food, pizza, selfies, pets, indoor rooms, memes, blank frames, or sexual images.

A department officer will review this later, so if it might be a city problem, ACCEPT.

Reply with:
SEEN: <what you see>
VERDICT: ACCEPT
or
VERDICT: REJECT
CODE: nsfw|blank|unrelated`,
        },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];

  const text = await callAI(messages);
  const hinted = inferRejectFromText(text);
  const verdict = /VERDICT:\s*(ACCEPT|REJECT)/i.exec(text)?.[1]?.toUpperCase();
  const rawCode = /CODE:\s*(nsfw|blank|unrelated|unclear)/i.exec(text)?.[1]?.toLowerCase();

  if (CIVIC_HINT.test(text)) return { ok: true };
  if (hinted) return { ok: false, code: hinted, warning: REJECT_WARNING[hinted] };
  if (verdict === "REJECT" && rawCode && rawCode !== "unclear") {
    return { ok: false, code: rawCode as PhotoRejectCode, warning: REJECT_WARNING[rawCode as PhotoRejectCode] };
  }
  return { ok: true };
}

export async function analyzePhoto(input: {
  imageUrl: string;
  description?: string | undefined;
  locationName?: string | undefined;
}): Promise<PhotoAnalysis> {
  try {
    const gate = await moderatePhoto(input.imageUrl);
    if (!gate.ok) return rejectedAnalysis(gate.code, gate.warning);
  } catch (err) {
    console.error("[ai] moderatePhoto failed, continuing to classify:", err);
  }

  const prompt = `You are CivicTwin's civic-infrastructure analyst. Classify the MAIN subject of the photo. Pick exactly one category. Do not invent a different problem.

${input.locationName ? `Claimed location: ${input.locationName}.` : ""}
${input.description ? `Citizen note (may be wrong — trust the IMAGE only): "${input.description}".` : ""}

Decision rules — use the FIRST rule that matches:
1. "garbage" if the photo is mostly solid waste: trash bags, plastic, litter, dump, debris filling a drain/canal/street. A garbage-choked drain is STILL garbage, not waterlogging and not a pothole.
2. "waterlogging" only if a road, street, or underpass is under standing flood water. Wet trash or a damp drain is not waterlogging.
3. "pothole" only if there is a hole or crater in the road surface. Do not call garbage or water a pothole.
4. "drainage" if the main subject is a blocked manhole, open drain, or sewer opening WITHOUT a large waste dump.
5. "streetlight" if the main subject is a pole/lamp that is dead, tilted, or broken.
6. "road_damage" if pavement is cracked or broken with NO hole and NO garbage pile.
7. "other" for any other real civic problem.

Never label a trash dump as waterlogging or pothole. Never label a flooded street as garbage.

Set accepted=true for civic photos. Set accepted=false only for food, nudity, selfies, pets, or blank frames.

Respond with ONLY JSON (no markdown, no code fences):
{
  "accepted": true or false,
  "reject_code": "ok" | "nsfw" | "blank" | "unrelated" | "unclear",
  "warning": if rejected, one short sentence the citizen should see; else "",
  "category": one of the categories above, or "other" when rejected,
  "severity": "low" | "moderate" | "high" | "critical",
  "impact_score": integer 0-100, use 0 when rejected,
  "title": short title (max 9 words) or "" when rejected,
  "summary": one sentence for an officer, or "" when rejected
}`;

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: input.imageUrl } },
      ],
    },
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callAI(messages);
    try {
      const parsed = extractJson<PhotoAnalysis>(text);
      const rejectCode = (["ok", "nsfw", "blank", "unrelated", "unclear"] as const).includes(
        parsed.reject_code as PhotoRejectCode,
      )
        ? (parsed.reject_code as PhotoRejectCode)
        : parsed.accepted === false
          ? "unrelated"
          : "ok";
      const hardReject = parsed.accepted === false && (rejectCode === "nsfw" || rejectCode === "blank" || rejectCode === "unrelated");
      const accepted = !hardReject;
      if (!accepted) {
        return rejectedAnalysis(
          rejectCode === "ok" ? "unrelated" : rejectCode,
          String(parsed.warning || ""),
        );
      }
      const blob = `${parsed.category ?? ""} ${parsed.title ?? ""} ${parsed.summary ?? ""}`.toLowerCase();
      let category = String(parsed.category ?? "other");
      if (/\b(garbage|trash|waste|litter|plastic bags?|dump|debris|refuse|rubbish|junk)\b/.test(blob)) {
        category = "garbage";
      } else if (/\b(pothole|pot[- ]hole|crater|hole in (the )?road)\b/.test(blob)) {
        category = "pothole";
      } else if (/\b(flood|flooded|waterlog|standing water|submerged|underpass)\b/.test(blob)) {
        category = "waterlogging";
      } else if (/\b(streetlight|street[- ]light|lamp post|dead (street)?light)\b/.test(blob)) {
        category = "streetlight";
      } else if (/\b(manhole|blocked drain|sewer|drainage)\b/.test(blob)) {
        category = "drainage";
      } else if (/\b(crack|broken pavement|road damage)\b/.test(blob)) {
        category = "road_damage";
      }
      const allowed = new Set(["pothole", "waterlogging", "garbage", "streetlight", "road_damage", "drainage", "other"]);
      if (!allowed.has(category)) category = "other";
      return {
        accepted: true,
        reject_code: "ok",
        warning: "",
        category,
        severity: accepted ? (parsed.severity ?? "moderate") : "low",
        impact_score: accepted
          ? Math.max(0, Math.min(100, Math.round(Number(parsed.impact_score) || 50)))
          : 0,
        title: accepted ? String(parsed.title ?? "Civic issue") : "",
        summary: accepted ? String(parsed.summary ?? "") : "",
      };
    } catch (err) {
      lastError = err;
      console.error(`[ai] analyzePhoto attempt ${attempt + 1} returned non-JSON:`, text.slice(0, 400));
      messages.push({
        role: "user",
        content:
          "Your previous reply was not valid JSON. Respond with ONLY the JSON object — no prose, no code fences.",
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI response was not valid JSON");
}

export interface ResolutionVerdict {
  resolved: boolean;
  confidence: number;
  verdict: string;
}

export async function verifyResolution(input: {
  beforeUrl: string;
  afterUrl: string;
  category: string;
}): Promise<ResolutionVerdict> {
  const prompt = `You are CivicTwin's resolution verifier for municipal work orders.
The FIRST image shows a reported civic problem (category: ${input.category}). The SECOND image is the officer's claimed resolution photo.
Decide whether the second image shows the same location with the problem genuinely fixed.
Respond with ONLY a JSON object:
{
  "resolved": true or false,
  "confidence": integer 0-100,
  "verdict": one plain-text sentence (no markdown) explaining your decision, written for an audit log
}`;

  const text = await callAI([
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: input.beforeUrl } },
        { type: "image_url", image_url: { url: input.afterUrl } },
      ],
    },
  ]);
  const parsed = extractJson<ResolutionVerdict>(text);
  return {
    resolved: Boolean(parsed.resolved),
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
    verdict: String(parsed.verdict ?? ""),
  };
}

export async function summarizeIssue(input: {
  title: string;
  category: string;
  locationName: string;
  reports: { description: string | null; severity: string; created_at: string }[];
}): Promise<string> {
  const reportLines = input.reports
    .map(
      (r, i) =>
        `${i + 1}. [${r.severity}] ${r.description ?? "No description"} (${r.created_at.slice(0, 10)})`,
    )
    .join("\n");

  const text = await callAI([
    {
      role: "user",
      content: `You are briefing a municipal ward officer. Summarize this civic issue in at most 3 sentences: current situation, urgency drivers, and recommended action. Be concrete and factual.
IMPORTANT: Respond in plain prose only. No markdown, no asterisks, no bold, no headings, no bullet lists.

Issue: ${input.title}
Category: ${input.category}
Location: ${input.locationName}
Citizen reports:
${reportLines}`,
    },
  ]);
  return text.trim();
}
