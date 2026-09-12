export function normalizeEnclosureCodes(codes: string[]) {
  return codes.map((code) => code.trim().toUpperCase()).filter(Boolean);
}

export function findDuplicateEnclosureCodes(codes: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const code of normalizeEnclosureCodes(codes)) {
    if (seen.has(code)) duplicates.add(code);
    else seen.add(code);
  }

  return Array.from(duplicates);
}
