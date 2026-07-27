/** @typedef {"green" | "yellow" | "red" | "unknown"} Status */

const RANK = { unknown: -1, green: 0, yellow: 1, red: 2 };

/**
 * 把每週指標整理成長期價值投資者適用的五面向警報。
 * @param {{ name: string, status: Status, value: string }[]} indicators
 */
export function buildValueAlert(indicators) {
  const find = (name) => indicators.find((item) => item.name === name);
  const combine = (names, requireAll = false) => {
    const items = names.map(find).filter(Boolean);
    if (!items.length || (requireAll && items.length !== names.length) || (requireAll && items.some((item) => item.status === "unknown"))) return "unknown";
    return items.filter((item) => item.status !== "unknown").sort((a, b) => RANK[b.status] - RANK[a.status])[0]?.status ?? "unknown";
  };
  const signals = [
    { name: "價格 vs 內在價值", status: combine(["科技估值"]), evidence: find("科技估值")?.value ?? "資料不足" },
    { name: "槓桿與被迫沽售", status: combine(["Margin Debt"]), evidence: find("Margin Debt")?.value ?? "資料不足" },
    { name: "投機與發行熱度", status: combine(["IPO 活躍度", "Equity Put/Call"]), evidence: find("IPO 活躍度")?.value ?? find("Equity Put/Call")?.value ?? "資料不足" },
    { name: "敘事 vs 現金流", status: combine(["AI CapEx／收入／現金流", "非 Mega-cap 盈利支持"], true), evidence: find("AI CapEx／收入／現金流")?.value ?? "資料不足" },
    { name: "集中度與市場廣度", status: combine(["市場廣度"]), evidence: find("市場廣度")?.value ?? "資料不足" },
  ];
  const known = signals.filter((signal) => signal.status !== "unknown");
  const reds = known.filter((signal) => signal.status === "red").length;
  const yellows = known.filter((signal) => signal.status === "yellow").length;
  const criticalRed = signals.some((signal) => ["價格 vs 內在價值", "敘事 vs 現金流"].includes(signal.name) && signal.status === "red");
  /** @type {Status} */
  const status = known.length < 3 ? "unknown" : reds >= 2 && criticalRed ? "red" : reds >= 1 || yellows >= 2 ? "yellow" : "green";
  return { status, score: reds * 2 + yellows, known: known.length, total: signals.length, signals };
}
