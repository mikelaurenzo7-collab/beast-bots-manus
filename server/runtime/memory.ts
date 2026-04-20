import { invokeLLM } from "../_core/llm";
import { bulkSaveMemories } from "../db";

const EXTRACTION_PROMPT =
  'You are a memory extraction assistant. Given this conversation, extract up to 5 important facts, preferences, or habits about the USER (not the bot). Return ONLY a JSON array: [{"key":"...","value":"..."}]. If nothing notable, return [].';

export async function extractAndSaveMemories(
  userId: number,
  agentSlug: string | null,
  conversation: { role: string; content: string }[]
): Promise<void> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: conversation
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n"),
        },
      ],
    });
    const raw = response.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return;
    const memories = parsed.filter(
      (m): m is { key: string; value: string } =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as Record<string, unknown>).key === "string" &&
        typeof (m as Record<string, unknown>).value === "string"
    );
    if (memories.length === 0) return;
    await bulkSaveMemories(userId, agentSlug, memories);
  } catch (error) {
    // Memory extraction must never throw or fail the main chat turn
    console.error("[memory extraction]", error);
  }
}
