import type { ConnectorId } from "./connectors";

export type RunKind = "action" | "mission";

export type RunSynthesis = {
  executiveSummary: string;
  operatorVerdict: "clear" | "watch" | "blocked";
  nextMoves: string[];
  source: "heuristic" | "openai";
  model: string;
};

export type RunHistorySection = {
  title: string;
  connectorId?: ConnectorId;
  connectorLabel: string;
  ok: boolean;
  summary: string;
  error?: string;
};

export type RunHistoryEntry = {
  id: string;
  kind: RunKind;
  targetId: string;
  targetLabel: string;
  ok: boolean;
  summary: string;
  narrative?: string;
  error?: string;
  createdAt: string;
  durationMs: number;
  connectorIds: ConnectorId[];
  payload: Record<string, unknown>;
  sections: RunHistorySection[];
  synthesis?: RunSynthesis;
};