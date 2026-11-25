export function dualSource(providers: Iterable<string>): boolean {
  const s = new Set(providers);
  return s.has("FZR") && s.has("ERIS");
}

export function gameVisible(
  game: { active: boolean; compareApproved: boolean },
  activePackageProviders: Iterable<string>,
): boolean {
  if (!game.active) return false;
  if (!dualSource(activePackageProviders)) return true;
  return game.compareApproved;
}

export function visiblePackages<T extends { provider: string }>(
  game: { priority: string },
  packages: T[],
): T[] {
  if (!dualSource(packages.map((p) => p.provider))) return packages;
  const side = game.priority.startsWith("FZR") ? "FZR" : "ERIS";
  return packages.filter((p) => p.provider === side || p.provider === "MANUAL");
}
