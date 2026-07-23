import { mkdir, readFile, writeFile } from "node:fs/promises";

const outputPath = new URL("../data/weekly_snapshots.json", import.meta.url);
const CBOE_URL = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv";
const TICKERS = ["SPY", "RSP", "QQQ", "IWM"];

function vixStatus(high) {
  return high >= 30 ? "red" : high >= 27 ? "yellow" : "green";
}

function mondayOf(dateText) {
  const date = new Date(`${dateText}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function previousFriday() {
  const now = new Date();
  const hkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  hkt.setHours(12, 0, 0, 0);
  do hkt.setDate(hkt.getDate() - 1); while (hkt.getDay() !== 5);
  return hkt.toISOString().slice(0, 10);
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function normaliseDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Weekly-Market-Radar/1.0" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function fetchVix() {
  const rows = (await fetchText(CBOE_URL)).trim().split(/\r?\n/).slice(1);
  return rows.map((row) => {
    const [date, , high, , close] = row.split(",");
    return { date: normaliseDate(date), high: Number(high), close: Number(close) };
  }).filter((row) => row.date && Number.isFinite(row.high) && Number.isFinite(row.close));
}

async function fetchTicker(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=6mo&interval=1d&events=history`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`${ticker} returned HTTP ${response.status}`);
  const result = (await response.json()).chart?.result?.[0];
  if (!result) throw new Error(`${ticker} returned no chart data`);
  const closes = result.indicators.quote[0].close;
  return result.timestamp.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    close: closes[index],
  })).filter((row) => Number.isFinite(row.close));
}

function groupWeeks(rows, cutoff) {
  const weeks = new Map();
  for (const row of rows) {
    if (row.date > cutoff) continue;
    const key = mondayOf(row.date);
    const list = weeks.get(key) ?? [];
    list.push(row);
    weeks.set(key, list);
  }
  return weeks;
}

async function readExisting() {
  try { return JSON.parse(await readFile(outputPath, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return { snapshots: [] };
    throw error;
  }
}

async function main() {
  const cutoff = previousFriday();
  const [vixRows, ...tickerRows] = await Promise.all([fetchVix(), ...TICKERS.map(fetchTicker)]);
  const vixWeeks = groupWeeks(vixRows, cutoff);
  const tickerWeeks = Object.fromEntries(TICKERS.map((ticker, index) => [ticker, groupWeeks(tickerRows[index], cutoff)]));
  const existing = await readExisting();
  const previousByWeek = new Map(existing.snapshots.map((snapshot) => [snapshot.weekStart, snapshot]));
  const weekStarts = [...vixWeeks.keys()].sort().slice(-26);

  const snapshots = weekStarts.map((weekStart) => {
    const vix = vixWeeks.get(weekStart).sort((a, b) => a.date.localeCompare(b.date));
    const market = Object.fromEntries(TICKERS.map((ticker) => {
      const rows = (tickerWeeks[ticker].get(weekStart) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      return [ticker.toLowerCase(), rows.length ? round(rows.at(-1).close) : null];
    }));
    const prior = previousByWeek.get(weekStart) ?? {};
    const vixHigh = round(Math.max(...vix.map((row) => row.high)));
    return {
      ...prior,
      weekStart,
      weekEnd: vix.at(-1).date,
      vix: {
        high: vixHigh,
        averageClose: round(vix.reduce((sum, row) => sum + row.close, 0) / vix.length),
        latestClose: round(vix.at(-1).close),
        status: vixStatus(vixHigh),
        sourceDate: vix.at(-1).date,
      },
      market: {
        ...prior.market,
        ...market,
        rspSpy: market.rsp && market.spy ? round(market.rsp / market.spy, 4) : null,
        iwmQqq: market.iwm && market.qqq ? round(market.iwm / market.qqq, 4) : null,
        sourceDate: vix.at(-1).date,
      },
    };
  });

  if (new Set(snapshots.map((row) => row.weekStart)).size !== snapshots.length) throw new Error("Duplicate week detected");
  if (vixStatus(26.99) !== "green" || vixStatus(27) !== "yellow" || vixStatus(30) !== "red") throw new Error("VIX thresholds failed");
  if (!snapshots.length || snapshots.at(-1).weekEnd > cutoff) throw new Error("No complete weekly snapshot available");

  const result = {
    metadata: {
      title: "每週市場 Radar",
      timezone: "Asia/Hong_Kong",
      lastSuccessfulRefresh: new Date().toISOString(),
      latestCompleteWeek: snapshots.at(-1).weekEnd,
      vixSource: CBOE_URL,
      marketPriceSource: "https://finance.yahoo.com/",
      note: "ETF 價格為公開市場資料便利來源；重要結論須再以主要來源核對。",
    },
    snapshots,
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Updated ${snapshots.length} unique weeks through ${result.metadata.latestCompleteWeek}`);
}

await main();
