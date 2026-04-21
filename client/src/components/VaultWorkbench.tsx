import { useEffect, useMemo, useState } from "react";
import type { ConnectorId, ConnectorWithStatus } from "@shared/connectors";
import { CheckCircle2, FolderKey, LockKeyhole, ShieldAlert, Trash2 } from "lucide-react";

type VaultWorkbenchProps = {
  connectors: ConnectorWithStatus[];
  selectedConnectorId: ConnectorId;
  onSelect: (connectorId: ConnectorId) => void;
  onSave: (connectorId: ConnectorId, token: string) => void;
  onClear: (connectorId: ConnectorId) => void;
  savingConnectorId?: ConnectorId;
  clearingConnectorId?: ConnectorId;
};

function getVaultStateCopy(connector: ConnectorWithStatus) {
  if (connector.vaultLocked) {
    return "A saved secret exists, but Bot Boss cannot decrypt it until BOT_BOSS_VAULT_KEY is present at boot.";
  }
  if (connector.source === "vault") {
    return connector.updatedAt
      ? `This connector is managed inside Bot Boss and was last updated on ${new Date(connector.updatedAt).toLocaleString()}.`
      : "This connector is managed inside Bot Boss.";
  }
  if (connector.source === "env") {
    return `This connector is currently booting from ${connector.tokenEnv}. Save a token here if you want Bot Boss to manage it persistently.`;
  }
  return `No token is currently available. Save a token here or provide ${connector.tokenEnv} at boot.`;
}

export function VaultWorkbench({
  connectors,
  selectedConnectorId,
  onSelect,
  onSave,
  onClear,
  savingConnectorId,
  clearingConnectorId,
}: VaultWorkbenchProps) {
  const selectedConnector = useMemo(
    () => connectors.find((connector) => connector.id === selectedConnectorId) ?? connectors[0],
    [connectors, selectedConnectorId]
  );
  const [tokenValue, setTokenValue] = useState("");

  useEffect(() => {
    setTokenValue("");
  }, [selectedConnector?.id]);

  if (!selectedConnector) return null;

  const canSave = selectedConnector.vaultEnabled && tokenValue.trim().length > 0;
  const canClear = selectedConnector.hasStoredSecret;

  return (
    <section id="vault" className="paper-panel grid gap-6 p-5 lg:grid-cols-[0.92fr_1.08fr]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[var(--line)] bg-[var(--gold)] text-[var(--ink)] shadow-[4px_4px_0_0_var(--line)]">
            <FolderKey className="h-5 w-5" />
          </div>
          <div>
            <p className="eyebrow">Connector Vault</p>
            <h3 className="font-display text-2xl font-black text-[var(--ink)]">Encrypted secret storage</h3>
          </div>
        </div>

        <p className="mb-5 text-sm leading-6 text-[var(--muted)]">
          Save connector tokens inside Bot Boss so the app can operate without hard-coded process env values. Stored secrets are encrypted at rest in the local state file.
        </p>

        <div className="grid gap-3">
          {connectors.map((connector) => {
            const active = connector.id === selectedConnector.id;
            return (
              <button
                key={connector.id}
                className={`rounded-2xl border-2 px-4 py-3 text-left shadow-[4px_4px_0_0_var(--line)] transition ${
                  active
                    ? "border-[var(--line)] bg-[var(--ink)] text-[var(--paper)]"
                    : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:-translate-y-0.5"
                }`}
                onClick={() => onSelect(connector.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-black">{connector.label}</p>
                    <p className={`text-xs font-bold uppercase tracking-[0.16em] ${active ? "text-[rgba(255,248,238,0.7)]" : "text-[var(--muted)]"}`}>
                      {connector.source === "vault" ? "Managed in app" : connector.source === "env" ? "Boot env" : connector.vaultLocked ? "Vault locked" : "Not configured"}
                    </p>
                  </div>
                  {connector.configured ? <CheckCircle2 className={`h-4 w-4 ${active ? "text-[#89f0bb]" : "text-[var(--green)]"}`} /> : <ShieldAlert className={`h-4 w-4 ${active ? "text-[#ffcfbd]" : "text-[var(--orange)]"}`} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[2rem] border-2 border-[var(--line)] bg-[var(--surface)] p-5 shadow-[8px_8px_0_0_var(--line)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Selected Connector</p>
            <h4 className="mt-1 font-display text-3xl font-black text-[var(--ink)]">{selectedConnector.label}</h4>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)]/15 bg-[var(--paper)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
            {selectedConnector.vaultEnabled ? <LockKeyhole className="h-3.5 w-3.5 text-[var(--green)]" /> : <ShieldAlert className="h-3.5 w-3.5 text-[var(--orange)]" />}
            {selectedConnector.vaultEnabled ? "Vault ready" : "Vault disabled"}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--line)]/20 bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--ink)]">Current state</p>
          <p className="mt-2 leading-6">{getVaultStateCopy(selectedConnector)}</p>
          {selectedConnector.maskedToken ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Visible reference: {selectedConnector.maskedToken}</p> : null}
        </div>

        {!selectedConnector.vaultEnabled ? (
          <div className="mt-4 rounded-2xl border border-[var(--orange)]/20 bg-[rgba(239,106,61,0.08)] p-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--ink)]">Enable encrypted persistence</p>
            <p className="mt-2 leading-6">Set BOT_BOSS_VAULT_KEY to a long random value, restart the app, and Bot Boss will persist connector secrets encrypted at rest.</p>
          </div>
        ) : null}

        <div className="mt-5">
          <label className="field-label">Token or API key</label>
          <input
            type="password"
            className="field-input"
            placeholder={`Paste ${selectedConnector.label} credential`}
            value={tokenValue}
            onChange={(event) => setTokenValue(event.target.value)}
          />
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Bot Boss stores only the encrypted secret and a masked tail for operator verification. Raw secrets are never returned to the client after save.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="ink-button" disabled={!canSave || savingConnectorId === selectedConnector.id} onClick={() => onSave(selectedConnector.id, tokenValue)}>
            {savingConnectorId === selectedConnector.id ? "Saving..." : "Save to vault"}
          </button>
          <button className="ghost-button" disabled={!canClear || clearingConnectorId === selectedConnector.id} onClick={() => onClear(selectedConnector.id)}>
            {clearingConnectorId === selectedConnector.id ? "Clearing..." : "Clear saved secret"}
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}