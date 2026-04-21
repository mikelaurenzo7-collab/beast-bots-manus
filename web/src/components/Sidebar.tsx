import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  ListChecks,
  Clock,
  Link2,
  Settings as SettingsIcon,
} from "lucide-react";
import { api } from "../lib/api";
import type { BotCatalogResponse } from "../lib/types";
import clsx from "clsx";

export function Sidebar() {
  const [location] = useLocation();
  const { data } = useQuery({
    queryKey: ["bot-catalog"],
    queryFn: () => api.get<BotCatalogResponse>("/v1/boss/catalog"),
  });

  const bots = data?.bots ?? [];

  return (
    <aside>
      <div style={{ padding: "4px 8px 16px", fontWeight: 700, fontSize: 18 }}>
        Bot Boss
      </div>

      <div className="nav-group">
        <NavLink href="/bots" label="All bots" icon={<LayoutGrid size={16} />} active={location === "/" || location === "/bots"} />
        <NavLink href="/recipes" label="Recipes" icon={<ListChecks size={16} />} active={location.startsWith("/recipes")} />
        <NavLink href="/history" label="Activity" icon={<Clock size={16} />} active={location.startsWith("/history")} />
        <NavLink href="/connections" label="Connections" icon={<Link2 size={16} />} active={location.startsWith("/connections")} />
        <NavLink href="/settings" label="Settings" icon={<SettingsIcon size={16} />} active={location.startsWith("/settings")} />
      </div>

      {bots.length > 0 && (
        <div className="nav-group">
          <div className="label">Your bots</div>
          {bots.map((b) => (
            <Link key={b.slug} href={`/bots/${b.slug}`}>
              <a
                className={clsx("nav-link", {
                  active: location === `/bots/${b.slug}`,
                })}
              >
                <span style={{ opacity: 0.8 }}>•</span>
                <span>{b.name}</span>
              </a>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}

function NavLink(props: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link href={props.href}>
      <a className={clsx("nav-link", { active: props.active })}>
        {props.icon}
        <span>{props.label}</span>
      </a>
    </Link>
  );
}
