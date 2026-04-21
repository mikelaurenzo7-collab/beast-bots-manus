import { ENV } from "./env";
import type { RunSynthesis } from "../../shared/history";

type SynthesisSection = {
  connectorLabel: string;
  title: string;
  ok: boolean;
  summary: string;
  error?: string;
};

type MissionSynthesisInput = {
  missionTitle: string;
  missionOutcome: string;
  payload: Record<string, unknown>;
  headline: string;
  narrative: string;
  sections: SynthesisSection[];
  recommendedNext: string[];
};

const DEFAULT_MODEL = "gpt-4.1-mini";

function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || ENV.openAIApiKey;
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || ENV.openAIModel || DEFAULT_MODEL;
}

function deriveVerdict(input: MissionSynthesisInput): RunSynthesis["operatorVerdict"] {
  const failedCount = input.sections.filter((section) => !section.ok).length;
  if (failedCount >= 2) return "blocked";
  if (failedCount === 1) return "watch";
  if (input.recommendedNext.some((item) => /fix|configure|invite|missing|rerun/i.test(item))) return "watch";
  return "clear";
}

export function buildHeuristicMissionSynthesis(input: MissionSynthesisInput): RunSynthesis {
  const successfulCount = input.sections.filter((section) => section.ok).length;
  const failedSections = input.sections.filter((section) => !section.ok).map((section) => section.connectorLabel);
  const verdict = deriveVerdict(input);
  const executiveSummaryParts = [
    `${input.missionTitle}: ${input.headline}.`,
    input.narrative,
    input.sections.length > 0
      ? `${successfulCount} of ${input.sections.length} mission sections completed cleanly${failedSections.length > 0 ? `; attention is still needed in ${failedSections.join(", ")}.` : "."}`
      : input.missionOutcome,
  ].filter(Boolean);

  return {
    executiveSummary: executiveSummaryParts.join(" "),
    operatorVerdict: verdict,
    nextMoves: input.recommendedNext.slice(0, 3),
    source: "heuristic",
    model: "heuristic",
  };
}

function normalizeNextMoves(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const nextMoves = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3);
  return nextMoves.length > 0 ? nextMoves : fallback;
}

function parseMissionSynthesis(content: string, fallback: RunSynthesis, model: string): RunSynthesis {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const parsed = JSON.parse(candidate) as Partial<RunSynthesis> & { nextMoves?: unknown };

  const summary = typeof parsed.executiveSummary === "string" && parsed.executiveSummary.trim() ? parsed.executiveSummary.trim() : fallback.executiveSummary;
  const verdict = parsed.operatorVerdict === "clear" || parsed.operatorVerdict === "watch" || parsed.operatorVerdict === "blocked"
    ? parsed.operatorVerdict
    : fallback.operatorVerdict;

  return {
    executiveSummary: summary,
    operatorVerdict: verdict,
    nextMoves: normalizeNextMoves(parsed.nextMoves, fallback.nextMoves),
    source: "openai",
    model,
  };
}

export async function generateMissionSynthesis(input: MissionSynthesisInput): Promise<RunSynthesis> {
  const fallback = buildHeuristicMissionSynthesis(input);
  const apiKey = getOpenAIApiKey();
  if (!apiKey || input.sections.length === 0) return fallback;

  const model = getOpenAIModel();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an operator-grade mission analyst for a founder control plane. Respond with strict JSON only. Return { executiveSummary: string, operatorVerdict: 'clear'|'watch'|'blocked', nextMoves: string[] }. Keep the summary concrete, concise, and grounded in the provided mission sections.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };

    const choice = json.choices?.[0]?.message?.content;
    const content = typeof choice === "string"
      ? choice
      : Array.isArray(choice)
        ? choice.map((item) => (item.type === "text" ? item.text ?? "" : "")).join("")
        : "";

    if (!content.trim()) return fallback;
    return parseMissionSynthesis(content, fallback, model);
  } catch (error) {
    console.warn("[llm] failed to synthesize mission output", error);
    return fallback;
  }
}