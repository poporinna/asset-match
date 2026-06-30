import { createClient, createAccount } from "genlayer-js";
import { testnetAsimov } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS, GENLAYER_NETWORK } from "./chain";

type Hex = `0x${string}`;
const TIMEOUT_MS = 240_000;

export type Verdict = "CONSISTENT" | "DISCREPANCY" | "UNEXPLAINED_WEALTH" | "";

export interface Concurrence {
  property: boolean;
  corporate: boolean;
  onchain: boolean;
  court_tax: boolean;
  lifestyle: boolean;
  count: number;
}

export interface CaseView {
  reporter: string;
  subject: string;
  declaration: string;
  publicRecord: string;
  gapUnits: string;
  magnitude: number;
  bountyPaid: string;
  step: number;
  verdict: Verdict;
  concurrence: Concurrence;
  rationale: string;
}
export interface CaseRow extends CaseView { id: number; }

export interface Stats { reported: number; ruled: number; unexplained: number; }
export interface Pool { pool: string; paidOut: string; }

function readClient() { return createClient({ chain: testnetAsimov, account: createAccount() }); }
function writeClient(account: Hex) { return createClient({ chain: testnetAsimov, account }); }
async function ensureConnected(client: any) { try { if (typeof client.connect === "function") await client.connect(GENLAYER_NETWORK); } catch { /* noop */ } }
async function waitAccepted(client: any, hash: Hex) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Transaction timed out")), TIMEOUT_MS); });
  try { await Promise.race([client.waitForTransactionReceipt({ hash: hash as never, status: TransactionStatus.ACCEPTED, interval: 5000, retries: 64 }), timeout]); }
  finally { if (timer) clearTimeout(timer); }
}
function pick(obj: any, key: string, idx: number): any { if (obj == null) return undefined; if (Array.isArray(obj)) return obj[idx]; if (typeof obj === "object" && key in obj) return obj[key]; return undefined; }
function bool(v: any): boolean { if (typeof v === "boolean") return v; const s = String(v).toLowerCase(); return s === "true" || s === "1" || s === "yes"; }
async function write(account: Hex, functionName: string, args: any[], value = 0n): Promise<void> {
  const wc = writeClient(account); await ensureConnected(wc);
  const h = (await wc.writeContract({ address: CONTRACT_ADDRESS as Hex, functionName, args, value })) as Hex;
  await waitAccepted(wc, h);
}

// ---- Lifecycle: fund_pool, report_subject -> reconcile -> rule -> award_bounty ----

export async function fundPool(account: Hex, wei: bigint): Promise<void> { await write(account, "fund_pool", [], wei); }
export async function reportSubject(account: Hex, subject: string, declaration: string, publicRecord: string): Promise<number> {
  await write(account, "report_subject", [subject.trim(), declaration.trim(), publicRecord.trim()]);
  const s = await getStats();
  return s.reported - 1;
}
export async function reconcile(account: Hex, id: number): Promise<void> { await write(account, "reconcile", [id]); }
export async function rule(account: Hex, id: number): Promise<void> { await write(account, "rule", [id]); }
export async function awardBounty(account: Hex, id: number): Promise<void> { await write(account, "award_bounty", [id]); }

// ---- Views ----

function decodeConcurrence(c: any): Concurrence {
  return {
    property: bool(pick(c, "property", 0)),
    corporate: bool(pick(c, "corporate", 1)),
    onchain: bool(pick(c, "onchain", 2)),
    court_tax: bool(pick(c, "court_tax", 3)),
    lifestyle: bool(pick(c, "lifestyle", 4)),
    count: Number(pick(c, "count", 5) ?? 0),
  };
}

export async function getCase(id: number): Promise<CaseView> {
  const r: any = await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "get_case", args: [id] });
  return {
    reporter: String(pick(r, "reporter", 0) ?? ""),
    subject: String(pick(r, "subject", 1) ?? ""),
    declaration: String(pick(r, "declaration", 2) ?? ""),
    publicRecord: String(pick(r, "public_record", 3) ?? ""),
    gapUnits: String(pick(r, "gap_units", 4) ?? "0"),
    magnitude: Number(pick(r, "magnitude", 5) ?? 0),
    bountyPaid: String(pick(r, "bounty_paid", 6) ?? "0"),
    step: Number(pick(r, "step", 7) ?? 0),
    verdict: String(pick(r, "verdict", 8) ?? "") as Verdict,
    concurrence: decodeConcurrence(pick(r, "concurrence", 9)),
    rationale: String(pick(r, "rationale", 10) ?? ""),
  };
}

export async function getBountyEstimate(id: number): Promise<{ pct: number; estimate: string }> {
  const raw = String(await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "get_bounty_estimate", args: [id] }) ?? "");
  const out: any = { pct: 0, estimate: "0" };
  raw.split("|").forEach((kv) => { const [k, v] = kv.split("="); if (k === "pct") out.pct = Number(v) || 0; if (k === "estimate") out.estimate = v || "0"; });
  return out;
}
export async function describeBands(): Promise<string> {
  return String(await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "describe_bands", args: [] }) ?? "");
}

// get_pool_balance -> "pool||paid_out"
export async function getPool(): Promise<Pool> {
  const r: any = await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "get_pool_balance", args: [] });
  const p = String(r).split("||");
  return { pool: p[0] || "0", paidOut: p[1] || "0" };
}
// get_stats -> "reported||ruled||unexplained"
export async function getStats(): Promise<Stats> {
  const r: any = await readClient().readContract({ address: CONTRACT_ADDRESS as Hex, functionName: "get_stats", args: [] });
  const p = String(r).split("||").map((x) => Number(x) || 0);
  return { reported: p[0] || 0, ruled: p[1] || 0, unexplained: p[2] || 0 };
}

export async function listAll(maxRows = 80): Promise<CaseRow[]> {
  const { reported } = await getStats();
  if (reported === 0) return [];
  const ids: number[] = [];
  for (let i = reported - 1; i >= 0 && i >= reported - maxRows; i--) ids.push(i);
  const rows = await Promise.all(ids.map(async (id) => { try { const c = await getCase(id); return { id, ...c }; } catch { return null; } }));
  return rows.filter((r): r is CaseRow => r !== null);
}
