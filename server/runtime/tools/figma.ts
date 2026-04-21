import { z } from "zod";
import { registerTool } from "../registry";
import type { Tool, ToolContext, ToolResult } from "../types";

const PROVIDER = "figma";
const BASE = "https://api.figma.com/v1";

async function figma<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Figma ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// ─── list_projects ────────────────────────────────────────────────────────────

const listProjectsInput = z.object({
  teamId: z.string().describe("Figma team id — find it in the URL of your team page"),
});

type Project = { id: string; name: string };

const listProjects: Tool<z.infer<typeof listProjectsInput>> = {
  name: `${PROVIDER}.list_projects`,
  label: "List Figma projects",
  provider: PROVIDER,
  description: "List Figma projects under a team. Needs the team id (visible in the team URL).",
  input: listProjectsInput,
  async run({ token, input }: ToolContext<z.infer<typeof listProjectsInput>>): Promise<ToolResult> {
    try {
      const json = await figma<{ projects: Project[] }>(token, `/teams/${encodeURIComponent(input.teamId)}/projects`);
      const summary =
        json.projects.length === 0
          ? "No projects in this team."
          : `Found ${json.projects.length} project${json.projects.length === 1 ? "" : "s"}: ${json.projects
              .slice(0, 5)
              .map((p) => p.name)
              .join(", ")}`;
      return { ok: true, summary, data: json.projects };
    } catch (e) {
      return { ok: false, summary: "Failed to list projects", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// ─── get_file ─────────────────────────────────────────────────────────────────

const getFileInput = z.object({
  fileKey: z.string().describe("Figma file key — the hash after figma.com/file/"),
});

type FigmaFile = {
  name: string;
  lastModified: string;
  editorType?: string;
  role?: string;
  document?: { children?: { name: string; type: string }[] };
};

const getFile: Tool<z.infer<typeof getFileInput>> = {
  name: `${PROVIDER}.get_file`,
  label: "Inspect Figma file",
  provider: PROVIDER,
  description: "Fetch metadata and top-level page names for a Figma file.",
  input: getFileInput,
  async run({ token, input }: ToolContext<z.infer<typeof getFileInput>>): Promise<ToolResult> {
    try {
      const file = await figma<FigmaFile>(token, `/files/${encodeURIComponent(input.fileKey)}?depth=1`);
      const pages = (file.document?.children ?? []).map((c) => c.name);
      return {
        ok: true,
        summary: `${file.name} (${pages.length} page${pages.length === 1 ? "" : "s"}). Last modified ${file.lastModified}`,
        data: { name: file.name, lastModified: file.lastModified, pages },
      };
    } catch (e) {
      return { ok: false, summary: "Failed to inspect file", error: e instanceof Error ? e.message : String(e) };
    }
  },
};

registerTool(listProjects);
registerTool(getFile);
