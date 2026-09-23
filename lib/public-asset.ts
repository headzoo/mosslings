/** Bump when replacing files under public/ without renaming them. */
export const MOSSLINGS_PUBLIC_ASSET_VERSION = "2";

/** Cache-bust a file from public/mosslings so dev and prod pick up art swaps. */
export function mosslingsPublicAsset(path: string): string {
  const base = path.startsWith("/mosslings/") ? path : `/mosslings/${path}`;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}v=${MOSSLINGS_PUBLIC_ASSET_VERSION}`;
}
