export function normalizeEnclosureCodes(codes: string[]) {
  return codes
    .map((code) =>
      code
        .trim()
        .replace(/[\u2014\u2013\uFF0D\u2015]/g, "-")
        .toUpperCase()
    )
    .filter(Boolean);
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

export function validateEnclosureCodes(codes: string[]): { valid: boolean; error?: string; normalized: string[] } {
  const normalized = normalizeEnclosureCodes(codes);
  if (normalized.length === 0) {
    return { valid: false, error: "请至少填写一个有效的围网编号", normalized: [] };
  }
  for (const code of normalized) {
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(code)) {
      return { valid: false, error: `围网编号「${code}」格式不规范，仅支持字母、数字、中文及连接符`, normalized };
    }
    if (code.length > 30) {
      return { valid: false, error: `围网编号「${code}」长度不能超过 30 个字符`, normalized };
    }
  }
  const duplicates = findDuplicateEnclosureCodes(normalized);
  if (duplicates.length > 0) {
    return { valid: false, error: `围网编号自身重复：${duplicates.join("、")}，不得重复输入`, normalized };
  }
  return { valid: true, normalized };
}
