import { Beast } from "../../../shared/agents";
import { getMascotDataUrl } from "../lib/mascot";
import { Link } from "wouter";
import { Star, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  beast: Beast;
  installed?: boolean;
  compact?: boolean;
};

function formatInstalls(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

export default function BeastCard({ beast, installed, compact }: Props) {
  const mascotUrl = getMascotDataUrl(beast.slug, compact ? 64 : 80, beast.accentColor);

  return (
    <Link href={`/agent/${beast.slug}`}>
      <div
        className={cn(
          "pop-card bg-card rounded-xl cursor-pointer group relative overflow-hidden",
          compact ? "p-3" : "p-4"
        )}
      >
        {/* Accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl opacity-80"
          style={{ backgroundColor: beast.accentColor }}
        />

        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-1">
          {beast.hot && (
            <span className="badge-hot text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              🔥 HOT
            </span>
          )}
          {beast.new && (
            <span className="bg-[#2D9E5A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              NEW
            </span>
          )}
          {installed && (
            <span className="bg-[#1A6EE8] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              ✓
            </span>
          )}
        </div>

        {/* Mascot */}
        <div className="flex items-start gap-3">
          <div
            className="rounded-xl border-2 border-border flex-shrink-0 overflow-hidden bg-secondary"
            style={{ width: compact ? 52 : 64, height: compact ? 52 : 64 }}
          >
            <img
              src={mascotUrl}
              alt={beast.name}
              width={compact ? 52 : 64}
              height={compact ? 52 : 64}
              className="object-contain"
            />
          </div>

          <div className="flex-1 min-w-0 mt-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className={cn("font-display font-bold text-foreground truncate", compact ? "text-sm" : "text-base")}>
                {beast.name}
              </h3>
            </div>
            <p className={cn("text-muted-foreground leading-tight line-clamp-2", compact ? "text-xs" : "text-xs")}>
              {beast.tagline}
            </p>
          </div>
        </div>

        {/* Footer */}
        {!compact && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-[#F5C842] text-[#F5C842]" />
              <span className="text-xs font-semibold text-foreground">{beast.rating}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span className="text-xs">{formatInstalls(beast.installs)}</span>
            </div>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground"
            >
              {beast.category}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
