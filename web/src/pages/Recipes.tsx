import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Recipe } from "../lib/types";

export function RecipesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.get<{ recipes: Recipe[] }>("/v1/recipes"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });

  return (
    <div className="page">
      <h1>Recipes</h1>
      <div className="subtitle">
        Saved prompt + tool presets. Run on demand or on a schedule.
      </div>

      {isLoading && <div>Loading…</div>}
      {!isLoading && (data?.recipes.length ?? 0) === 0 && (
        <div className="empty">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No recipes yet</div>
          <div>Create one from any bot's chat.</div>
        </div>
      )}

      <div className="grid" style={{ gap: 10 }}>
        {(data?.recipes ?? []).map((r) => (
          <div key={r.id} className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <span className="chip">{r.triggerKind}</span>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{r.prompt.slice(0, 200)}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {r.tools.slice(0, 6).map((t) => (
                <span key={t} className="chip mono">
                  {t}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn danger" onClick={() => remove.mutate(r.id)}>
                Archive
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
