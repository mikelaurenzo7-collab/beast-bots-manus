import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getMascotDataUrl } from "../lib/mascot";
import NavBar from "../components/NavBar";
import BeastCard from "../components/BeastCard";
import { Link } from "wouter";
import { ArrowRight, Bot, Star, Zap, Shield, Sparkles, TrendingUp, Users } from "lucide-react";

const HERO_SLUGS = ["gmail-beast", "github-beast", "openai-beast", "slack-beast", "notion-beast", "shopify-beast"];

function FloatingMascot({ slug, style }: { slug: string; style: React.CSSProperties }) {
  const url = getMascotDataUrl(slug, 72);
  return (
    <div
      className="absolute rounded-2xl border-2 border-border bg-card shadow-pop-md overflow-hidden"
      style={{ width: 72, height: 72, ...style }}
    >
      <img src={url} alt={slug} width={72} height={72} />
    </div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const statsQuery = trpc.agents.stats.useQuery();
  const featuredQuery = trpc.agents.featured.useQuery();
  const hotQuery = trpc.agents.hot.useQuery();

  const stats = statsQuery.data;
  const featured = featuredQuery.data ?? [];
  const hot = hotQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 md:py-28">
        {/* Paper texture overlay */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`
          }}
        />

        {/* Floating mascots - desktop only */}
        <div className="hidden lg:block">
          <FloatingMascot slug="gmail-beast" style={{ top: "15%", left: "6%", transform: "rotate(-8deg)" }} />
          <FloatingMascot slug="github-beast" style={{ top: "55%", left: "3%", transform: "rotate(5deg)" }} />
          <FloatingMascot slug="slack-beast" style={{ top: "30%", left: "13%", transform: "rotate(-3deg)" }} />
          <FloatingMascot slug="openai-beast" style={{ top: "10%", right: "6%", transform: "rotate(7deg)" }} />
          <FloatingMascot slug="shopify-beast" style={{ top: "55%", right: "4%", transform: "rotate(-6deg)" }} />
          <FloatingMascot slug="notion-beast" style={{ top: "28%", right: "13%", transform: "rotate(4deg)" }} />
        </div>

        <div className="container relative text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-card border-2 border-border shadow-pop-sm rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#E8541A]" />
            <span className="text-xs font-semibold text-foreground">The App Store for AI Agents</span>
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-black text-foreground leading-[0.95] mb-6">
            Unleash your
            <br />
            <span className="italic text-[#E8541A]">Beast Bots</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Discover, install, and deploy 80+ AI agents that connect to every tool you use.
            Real OAuth. Real automation. Real results.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/marketplace">
              <button className="pop-btn bg-foreground text-background px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2">
                Browse Marketplace
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            {!isAuthenticated && (
              <a href={getLoginUrl()}>
                <button className="pop-btn bg-card text-foreground px-6 py-3 rounded-xl font-bold text-base">
                  Sign In Free
                </button>
              </a>
            )}
          </div>

          {/* Stats row */}
          {stats && (
            <div className="flex flex-wrap justify-center gap-6 mt-12">
              {[
                { label: "AI Agents", value: `${stats.total}+` },
                { label: "Total Installs", value: `${(stats.totalInstalls / 1000).toFixed(0)}k+` },
                { label: "Categories", value: `${stats.categories}` },
                { label: "Avg Rating", value: `${stats.avgRating}★` },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="font-display text-3xl font-black text-foreground">{value}</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Featured Beasts ──────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-12 border-t-2 border-border bg-secondary/30">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Featured Beasts</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Hand-picked for maximum impact</p>
              </div>
              <Link href="/marketplace">
                <button className="text-sm font-semibold text-foreground flex items-center gap-1 hover:gap-2 transition-all">
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {featured.slice(0, 10).map((beast) => (
                <BeastCard key={beast.slug} beast={beast} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Value Props ──────────────────────────────────── */}
      <section className="py-16 border-t-2 border-border">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Why Beast Bots?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Not just another automation tool. A living ecosystem of AI agents built for real workflows.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                color: "#F5C842",
                title: "Real OAuth Connections",
                desc: "Connect your actual accounts — Gmail, GitHub, Slack, Salesforce, and 30+ more. No fake demos, no mock data.",
              },
              {
                icon: Shield,
                color: "#2D9E5A",
                title: "AES-256 Token Security",
                desc: "Your OAuth tokens are encrypted with AES-256-GCM. Your credentials never leave our secure vault.",
              },
              {
                icon: Bot,
                color: "#7C3AED",
                title: "80 Specialized Agents",
                desc: "Each Beast Bot is purpose-built for its platform — not a generic wrapper. Deep integrations, real capabilities.",
              },
              {
                icon: TrendingUp,
                color: "#E8541A",
                title: "Activity Logs & Analytics",
                desc: "Track every run, monitor performance, and see exactly what your agents are doing in real time.",
              },
              {
                icon: Sparkles,
                color: "#1A6EE8",
                title: "BeastBot AI Assistant",
                desc: "Our AI concierge recommends the right agents for your workflow and helps you configure them perfectly.",
              },
              {
                icon: Users,
                color: "#E8186B",
                title: "14 Categories",
                desc: "From Communication to Finance, Development to Analytics — we cover every corner of your stack.",
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="pop-card bg-card rounded-xl p-5">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: color + "22", border: `2px solid ${color}` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-display font-bold text-base text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Hot Right Now ────────────────────────────────── */}
      {hot.length > 0 && (
        <section className="py-12 border-t-2 border-border bg-secondary/30">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
                  🔥 Hot Right Now
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Trending in the last 7 days</p>
              </div>
              <Link href="/marketplace">
                <button className="text-sm font-semibold text-foreground flex items-center gap-1 hover:gap-2 transition-all">
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {hot.map((beast) => (
                <div key={beast.slug} className="flex-shrink-0 w-56">
                  <BeastCard beast={beast} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="py-20 border-t-2 border-border">
        <div className="container">
          <div className="pop-card bg-foreground text-background rounded-2xl p-10 md:p-16 text-center relative overflow-hidden">
            {/* Decorative mascots */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 hidden md:block">
              <img src={getMascotDataUrl("openai-beast", 96)} alt="" width={96} height={96} />
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 hidden md:block">
              <img src={getMascotDataUrl("github-beast", 96)} alt="" width={96} height={96} />
            </div>

            <h2 className="font-display text-3xl md:text-5xl font-black mb-4 leading-tight">
              Ready to unleash your
              <br />
              <span className="italic">first Beast Bot?</span>
            </h2>
            <p className="text-background/70 text-lg mb-8 max-w-md mx-auto">
              Join thousands of teams automating their workflows with AI agents.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/marketplace">
                <button className="bg-background text-foreground px-8 py-3 rounded-xl font-bold text-base border-2 border-background shadow-pop-md hover:shadow-pop-lg transition-all">
                  Browse 80+ Agents
                </button>
              </Link>
              {!isAuthenticated && (
                <a href={getLoginUrl()}>
                  <button className="bg-transparent text-background px-8 py-3 rounded-xl font-bold text-base border-2 border-background/40 hover:border-background transition-all">
                    Sign In Free
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────── */}
      <footer className="border-t-2 border-border py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-background" />
            </div>
            <span className="font-display font-bold text-foreground">Beast Bots</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The App Store for AI Agents. Built with ❤️ for automation enthusiasts.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/marketplace">Marketplace</Link>
            {/* Privacy and Terms placeholders */}
          </div>
        </div>
      </footer>
    </div>
  );
}
