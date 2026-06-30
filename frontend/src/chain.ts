import { defineChain } from "viem";

// GenLayer Asimov Testnet — where the WealthLens contract is deployed.
export const GENLAYER_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 4221);
export const GENLAYER_RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://rpc-asimov.genlayer.com";
export const GENLAYER_NETWORK = "testnetAsimov" as const;

// asset-match (WealthLens) — deployed on testnet-asimov.
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ??
  "0x1aca6eE1D0913817665d3C72fEAcf35eacE3DC38") as `0x${string}`;

export const genLayerAsimov = defineChain({
  id: GENLAYER_CHAIN_ID,
  name: "GenLayer Asimov Testnet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: [GENLAYER_RPC_URL] }, public: { http: [GENLAYER_RPC_URL] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer-asimov.genlayer.com" } },
  testnet: true,
});
