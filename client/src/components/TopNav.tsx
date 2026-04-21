type TopNavProps = {
  stats: {
    connectors: number;
    actions: number;
    tools: number;
    configuredConnectorCount: number;
    historyRuns: number;
    vaultEnabled: boolean;
    schedules: number;
    activeSchedules: number;
  };
};

export function TopNav({ stats }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--line)]/70 bg-[rgba(255,248,238,0.88)] backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--ink)] text-[var(--paper)] shadow-[4px_4px_0_0_var(--line)]">
            <span className="font-display text-lg font-black">BB</span>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[var(--muted)]">Founder Control Plane</p>
            <h1 className="font-display text-lg font-black text-[var(--ink)]">Bot Boss</h1>
          </div>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <a href="#connectors" className="nav-pill">
            Connectors
          </a>
          <a href="#vault" className="nav-pill">
            Vault
          </a>
          <a href="#missions" className="nav-pill">
            Missions
          </a>
          <a href="#schedules" className="nav-pill">
            Schedules
          </a>
          <a href="#console" className="nav-pill">
            Action Console
          </a>
          <a href="#history" className="nav-pill">
            History
          </a>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <div className="stat-pill">
            <span>{stats.connectors}</span>
            <small>connectors</small>
          </div>
          <div className="stat-pill">
            <span>{stats.actions}</span>
            <small>actions</small>
          </div>
          <div className="stat-pill">
            <span>{stats.tools}</span>
            <small>tools</small>
          </div>
          <div className="stat-pill">
            <span>{stats.historyRuns}</span>
            <small>runs</small>
          </div>
          <div className="stat-pill">
            <span>{stats.schedules}</span>
            <small>schedules</small>
          </div>
          <div className="stat-pill bg-[var(--ink)] text-[var(--paper)]">
            <span>{stats.configuredConnectorCount}</span>
            <small>live</small>
          </div>
          <div className="stat-pill">
            <span>{stats.activeSchedules}</span>
            <small>active</small>
          </div>
          <div className="stat-pill">
            <span>{stats.vaultEnabled ? "on" : "off"}</span>
            <small>vault</small>
          </div>
        </div>
      </div>
    </header>
  );
}