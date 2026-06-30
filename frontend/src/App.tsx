import { useState, useRef, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  fundPool, reportSubject, reconcile, rule, awardBounty,
  getCase, getBountyEstimate, getPool, getStats, listAll,
  CaseView, CaseRow, Stats, Pool, Concurrence,
} from "./contractService";
import { CONTRACT_ADDRESS } from "./chain";

type Hex = `0x${string}`;
const STEP_LABEL = ["reported", "reconciled", "ruled", "awarded"];
const toWei = (g: string): bigint => { try { return parseEther((g || "0").trim()); } catch { return 0n; } };
const gen = (wei: string): string => { try { return formatEther(BigInt(wei || "0")); } catch { return wei || "0"; } };
const usd = (n: string): string => { const x = Number(n || "0"); return Number.isFinite(x) ? "$" + x.toLocaleString() : "$" + n; };

function WalletControl() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        if (!connected) return <button className="wbtn" onClick={openConnectModal} type="button">Connect Wallet</button>;
        if (chain?.unsupported) return <button className="wbtn wbtn-warn" onClick={openChainModal} type="button">Wrong network</button>;
        return <button className="wchip" onClick={openAccountModal} type="button"><span className="wdot" />{account.displayName}</button>;
      }}
    </ConnectButton.Custom>
  );
}

function VantaRipple() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let fx: any; let alive = true;
    (async () => {
      const THREE: any = await import("three");
      const V: any = (await import("vanta/dist/vanta.ripple.min")).default;
      if (!alive || !ref.current) return;
      fx = V({ el: ref.current, THREE, mouseControls: true, touchControls: true, gyroControls: false, minHeight: 200.0, minWidth: 200.0, scale: 1.0, backgroundColor: 0x070605, color: 0xe2541f });
    })();
    return () => { alive = false; try { fx && fx.destroy(); } catch {} };
  }, []);
  return <div className="cells" ref={ref} aria-hidden="true" />;
}

const SOURCES: { key: keyof Concurrence; label: string }[] = [
  { key: "property", label: "Property registry" },
  { key: "corporate", label: "Corporate filings" },
  { key: "onchain", label: "On-chain holdings" },
  { key: "court_tax", label: "Court & tax records" },
  { key: "lifestyle", label: "Lifestyle signals" },
];

export function App() {
  const { address, isConnected } = useAccount();
  const acct = address as Hex | undefined;
  const [subject, setSubject] = useState("");
  const [declaration, setDeclaration] = useState("");
  const [url, setUrl] = useState("");
  const [funding, setFunding] = useState("10");

  const [rows, setRows] = useState<CaseRow[]>([]);
  const [stats, setStats] = useState<Stats>({ reported: 0, ruled: 0, unexplained: 0 });
  const [pool, setPool] = useState<Pool>({ pool: "0", paidOut: "0" });
  const [selId, setSelId] = useState<number | null>(null);
  const [sel, setSel] = useState<CaseView | null>(null);
  const [estimate, setEstimate] = useState<{ pct: number; estimate: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refreshAll() {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const [s, p, l] = await Promise.all([getStats(), getPool(), listAll(80)]);
      setStats(s); setPool(p); setRows(l);
      if (selId != null) { try { setSel(await getCase(selId)); } catch { /* keep */ } }
    } catch { /* offline */ }
  }
  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, 12000);
    const onVis = () => { if (!document.hidden) refreshAll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  async function select(id: number) {
    setSelId(id);
    try { setSel(await getCase(id)); } catch { setSel(null); }
    try { setEstimate(await getBountyEstimate(id)); } catch { setEstimate(null); }
  }
  async function act<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label); setError("");
    try { return await fn(); } catch (e: any) { setError((e?.message || String(e)).slice(0, 160)); return undefined; }
    finally { setBusy(null); refreshAll(); }
  }
  async function onReport() {
    if (!acct) return;
    if (subject.trim().length < 2) return setError("Subject is required.");
    if (declaration.trim().length < 2) return setError("Declared net worth is required.");
    if (!/^https?:\/\//.test(url.trim())) return setError("Public record URL must start with http(s)://");
    const id = await act("Reporting the subject", () => reportSubject(acct, subject, declaration, url));
    if (id != null) { setSubject(""); setDeclaration(""); setUrl(""); setSelId(id); }
  }
  async function onFund() { if (!acct) return; if (toWei(funding) <= 0n) return setError("Amount must be > 0 GEN."); await act("Funding the bounty pool", () => fundPool(acct, toWei(funding))); }
  async function onReconcile() { if (!acct || selId == null) return; await act("Reconciling against public records", () => reconcile(acct, selId)); }
  async function onRule() { if (!acct || selId == null) return; await act("Ruling on the gap", () => rule(acct, selId)); }
  async function onAward() { if (!acct || selId == null) return; await act("Awarding the bounty", () => awardBounty(acct, selId)); }

  const v = sel?.verdict || "";
  const stripState = busy ? "RUN" : v ? v : "IDLE";
  const conc = sel?.concurrence;

  return (
    <div className="lab">
      <div className="scope">
        <VantaRipple />
        <div className="readout-top">
          <span className="rt-label">SUBJECT FIELD</span>
          <span className="rt-status">{busy ? "RECONCILING" : sel ? STEP_LABEL[sel.step].toUpperCase() : "IDLE"}</span>
        </div>
      </div>

      <div className="console">
        <header className="bar">
          <span className="brand"><span className="led" />wealth::lens</span>
          <WalletControl />
        </header>

        <section className="lede">
          <span className="kicker">asset-declaration reconciliation</span>
          <h1>Report the gap. Let the panel reconcile it.</h1>
          <p>
            Name a subject, record their declared net worth, and point at a public record. GenLayer
            validators fetch that record on chain, reconcile the declaration against property,
            corporate, on-chain, court/tax, and lifestyle signals, and rule the case CONSISTENT,
            DISCREPANCY, or UNEXPLAINED_WEALTH — paying a bounty scaled to the unexplained gap.
          </p>
        </section>

        <div className="stat-line">
          <span>reported <b>{stats.reported}</b></span>
          <span>ruled <b>{stats.ruled}</b></span>
          <span>unexplained <b>{stats.unexplained}</b></span>
          <span>pool <b>{gen(pool.pool)}</b> GEN</span>
          <span>paid out <b>{gen(pool.paidOut)}</b> GEN</span>
        </div>

        <section className="panel">
          <div className="panel-grid">
            <div className="specimen">
              <label className="fld">
                <span>Subject name</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. J. Doe / Acme Holdings Ltd" />
              </label>
              <label className="fld">
                <span>Declared net worth / assets</span>
                <textarea value={declaration} onChange={(e) => setDeclaration(e.target.value)} placeholder="Declared $1.2M: primary residence, one vehicle, modest brokerage…" />
              </label>
              <label className="fld">
                <span>Public record <em>- validators fetch this on chain</em></span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://records.example.gov/entity/12830" />
              </label>
              <button className="run" disabled={!isConnected || !!busy} onClick={onReport}>
                {busy === "Reporting the subject" ? "Reporting…" : "Report subject"}
              </button>
              {!isConnected && <span className="note">Connect a wallet on GenLayer Asimov to report.</span>}
              {error && <p className="err">{error}</p>}
              <label className="fld" style={{ marginTop: 22 }}>
                <span>Fund the bounty pool (GEN)</span>
                <input value={funding} onChange={(e) => setFunding(e.target.value)} placeholder="10" />
              </label>
              <button className="run alt" disabled={!isConnected || !!busy} onClick={onFund}>Fund pool</button>
            </div>

            <fieldset className="flags">
              <legend>Corroborating sources</legend>
              {SOURCES.map((s) => {
                const lit = !!(conc && conc[s.key]);
                return (
                  <div key={s.key} className={"flag" + (lit ? " lit" : "")}>
                    <span className="flag-box" />
                    <span className="flag-label">{s.label}</span>
                  </div>
                );
              })}
              {conc && <span className="note">{conc.count}/5 independent sources corroborate the declaration.</span>}
              {!sel && <span className="note">Select a reconciled case to light its corroborating sources.</span>}
            </fieldset>
          </div>
        </section>

        {rows.length > 0 && (
          <>
            <p className="sect-h">Reported cases</p>
            <div className="cases">
              {rows.map((c) => (
                <button key={c.id} type="button" className={"crow " + (selId === c.id ? "on" : "")} onClick={() => select(c.id)}>
                  <span className="cid">#{c.id}</span>
                  <span className="csub"><b>{c.subject}</b><i>{STEP_LABEL[c.step]} · gap {usd(c.gapUnits)} · mag {c.magnitude}</i></span>
                  <span className={"cv v-" + (c.verdict || "")}>{c.verdict || "pending"}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {sel && selId != null && (
          <div className="lifebtns">
            {sel.step === 0 && <button className="run small" disabled={!!busy} onClick={onReconcile}>Reconcile #{selId}</button>}
            {sel.step === 1 && <button className="run small" disabled={!!busy} onClick={onRule}>Rule #{selId}</button>}
            {sel.step === 2 && <button className="run small" disabled={!!busy} onClick={onAward}>Award bounty #{selId}</button>}
            {sel.step === 3 && <span className="note">Awarded — bounty {gen(sel.bountyPaid)} GEN paid for the unexplained gap.</span>}
          </div>
        )}

        <section className={"strip strip-" + stripState} aria-live="polite">
          {busy ? (
            <div className="strip-body">
              <span className="strip-bar"><i /></span>
              <span className="strip-msg">{busy}…</span>
            </div>
          ) : sel ? (
            <div className="strip-body">
              <div className="strip-verdict">
                <span className="strip-word">{v || "PENDING"}</span>
                <span className="strip-score">{sel.magnitude}<i>/100 gap magnitude</i></span>
              </div>
              <div className="gapline">
                <span>declared gap <b>{usd(sel.gapUnits)}</b></span>
                {estimate && <span>bounty estimate <b>{gen(estimate.estimate)}</b> GEN ({estimate.pct}%)</span>}
                {Number(sel.bountyPaid) > 0 && <span>paid <b>{gen(sel.bountyPaid)}</b> GEN</span>}
              </div>
              <p className="strip-reason">{sel.rationale || "Advance the case through reconcile → rule → award to print the verdict."}</p>
              <span className="strip-foot">Verdict logged on-chain · Asimov 4221</span>
            </div>
          ) : (
            <div className="strip-body">
              <span className="strip-idle">READOUT STANDBY</span>
              <p className="strip-reason">The reconciliation verdict, gap magnitude, and bounty print across this strip once a case is ruled.</p>
            </div>
          )}
        </section>

        <footer className="foot">
          <span className="brand small"><span className="led" />wealth::lens</span>
          <span className="mono">{CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)} · verdicts logged on-chain</span>
        </footer>
      </div>
    </div>
  );
}
