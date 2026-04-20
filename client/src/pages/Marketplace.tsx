import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { CATEGORIES } from "../../../shared/agents";
import NavBar from "../components/NavBar";
import BeastCard from "../components/BeastCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { Search, ChevronLeft, ChevronRight, Sparkles, TrendingUp, Zap, Star, Layers } from "lucide-react";

/** Horizontal scroll rail with prev/next buttons */
function ScrollRail({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };
  return (
    <div className={`relative group ${className ?? ""}`}>
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 bg-card border-2 border-border rounded-full flex items-center justify-center shadow-pop-sm opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 bg-card border-2 border-border rounded-full flex items-center justify-center shadow-pop-sm opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Curated collection card */
const COLLECTIONS = [
  {
    title: "Startup Essentials",
    description: "The 10 agents every early-stage startup needs to move fast",
    slugs: ["gmail-beast", "slack-beast", "notion-beast", "github-beast", "stripe-beast", "linear-beast", "hubspot-beast", "google-analytics-beast", "openai-beast", "zapier-beast"],
    color: "#E8541A",
    emoji: "🚀",
  },
  {
    title: "Dev Power Pack",
    description: "Automate your entire engineering workflow end-to-end",
    slugs: ["github-beast", "jira-beast", "linear-beast", "vercel-beast", "datadog-beast", "pagerduty-beast", "aws-beast", "docker-beast"],
    color: "#1A6EE8",
    emoji: "⚡",
  },
  {
    title: "Revenue Machine",
    description: "Close more deals and grow revenue on autopilot",
    slugs: ["salesforce-beast", "hubspot-beast", "stripe-beast", "shopify-beast", "mailchimp-beast", "intercom-beast"],
    color: "#2D9E5A",
    emoji: "💰",
  },
  {
    title: "Content Creator OS",
    description: "Publish everywhere and grow your audience automatically",
    slugs: ["twitter-beast", "instagram-beast", "youtube-beast", "tiktok-beast", "buffer-beast", "wordpress-beast"],
    color: "#9146FF",
    emoji: "🎨",
  },
];

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const { isAuthenticated } = useAuth();

  const agentsQuery = trpc.agents.list.useQuery({
    search: search || undefined,
    category: category === "All" ? undefined : category,
    limit: 80,
    offset: 0,
  });

  const featuredQuery = trpc.agents.featured.useQuery();
  const hotQuery = trpc.agents.hot.useQuery();
  const newQuery = trpc.agents.new.useQuery();

  const installationsQuery = trpc.installations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const installedSlugs = useMemo(
    () => new Set((installationsQuery.data ?? []).map((i) => i.agentSlug)),
    [installationsQuery.data]
  );

  const agents = agentsQuery.data?.items ?? [];
  const total = agentsQuery.data?.total ?? 0;
  const featured = featuredQuery.data ?? [];
  const hot = hotQuery.data ?? [];
  const newAgents = newQuery.data ?? [];

  const isFiltered = search !== "" || category !== "All";

  // Group by category for the full grid
  const byCategory = useMemo(() => {
    if (isFiltered) return null;
    const map: Record<string, typeof agents> = {};
    for (const a of agents) {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    }
    return map;
  }, [agents, isFiltered]);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      {/* Header */}
      <div className="border-b-2 border-border bg-secondary/30 py-8">
        <div className="container">
          <h1 className="font-display text-3xl md:text-4xl font-black text-foreground mb-2">
            Beast Bots Marketplace
          </h1>
          <p className="text-muted-foreground">
            {total > 0 ? total : "80"} AI agents across {CATEGORIES.length - 1} categories
          </p>

          {/* Search */}
          <div className="mt-5 flex gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search agents, platforms, capabilities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-card border-2 border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category rail */}
      <div className="border-b-2 border-border bg-card sticky top-14 z-40">
        <div className="container">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                  category === cat
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-12">
        {agentsQuery.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="shimmer rounded-xl h-40 border-2 border-border" />
            ))}
          </div>
        ) : isFiltered ? (
          /* ─── Filtered view — flat grid ─────────────────── */
          <>
            <p className="text-sm text-muted-foreground">
              {total} result{total !== 1 ? "s" : ""}
              {search ? ` for "${search}"` : ""}
              {category !== "All" ? ` in ${category}` : ""}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {agents.map((beast) => (
                <BeastCard key={beast.slug} beast={beast} installed={installedSlugs.has(beast.slug)} />
              ))}
            </div>
            {agents.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🤖</div>
                <h3 className="font-display font-bold text-lg text-foreground mb-1">No beasts found</h3>
                <p className="text-muted-foreground text-sm">Try a different search or category</p>
              </div>
            )}
          </>
        ) : (
          /* ─── Full marketplace view ──────────────────────── */
          <>
            {/* Featured rail */}
            {featured.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[#E8541A]" />
                  <h2 className="font-display text-xl font-bold text-foreground">Featured Beasts</h2>
                </div>
                <ScrollRail>
                  {featured.map((beast) => (
                    <div key={beast.slug} className="flex-shrink-0 w-52" style={{ scrollSnapAlign: "start" }}>
                      <BeastCard beast={beast} installed={installedSlugs.has(beast.slug)} />
                    </div>
                  ))}
                </ScrollRail>
              </section>
            )}

            {/* Trending rail */}
            {hot.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-[#E8541A]" />
                  <h2 className="font-display text-xl font-bold text-foreground">Trending Now 🔥</h2>
                </div>
                <ScrollRail>
                  {hot.map((beast) => (
                    <div key={beast.slug} className="flex-shrink-0 w-52" style={{ scrollSnapAlign: "start" }}>
                      <BeastCard beast={beast} installed={installedSlugs.has(beast.slug)} />
                    </div>
                  ))}
                </ScrollRail>
              </section>
            )}

            {/* New arrivals rail */}
            {newAgents.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-[#2D9E5A]" />
                  <h2 className="font-display text-xl font-bold text-foreground">New Arrivals ✨</h2>
                </div>
                <ScrollRail>
                  {newAgents.map((beast) => (
                    <div key={beast.slug} className="flex-shrink-0 w-52" style={{ scrollSnapAlign: "start" }}>
                      <BeastCard beast={beast} installed={installedSlugs.has(beast.slug)} />
                    </div>
                  ))}
                </ScrollRail>
              </section>
            )}

            {/* Curated Collections */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-foreground" />
                <h2 className="font-display text-xl font-bold text-foreground">Curated Collections</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {COLLECTIONS.map((col) => (
                  <button
                    key={col.title}
                    onClick={() => {
                      // Filter to first agent's category as a shortcut
                      const firstSlug = col.slugs[0];
                      if (firstSlug) setSearch(col.title.split(" ")[0]);
                    }}
                    className="pop-card bg-card rounded-xl p-4 text-left group cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 border-2 border-border"
                      style={{ backgroundColor: col.color + "20" }}
                    >
                      {col.emoji}
                    </div>
                    <h3 className="font-display font-bold text-sm text-foreground mb-1">{col.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{col.description}</p>
                    <div className="flex items-center gap-1 mt-3">
                      <Star className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{col.slugs.length} agents</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Full grid grouped by category */}
            {byCategory && (
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="font-display text-2xl font-black text-foreground">All Beasts</h2>
                  <span className="text-sm text-muted-foreground font-medium">({agents.length})</span>
                </div>
                <div className="space-y-10">
                  {Object.entries(byCategory).map(([cat, beasts]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display text-lg font-bold text-foreground">{cat}</h3>
                        <button
                          onClick={() => setCategory(cat)}
                          className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                        >
                          See all {beasts.length} →
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {beasts.map((beast) => (
                          <BeastCard key={beast.slug} beast={beast} installed={installedSlugs.has(beast.slug)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
