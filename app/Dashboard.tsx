"use client";

import { useMemo, useState, type ReactNode } from "react";

type Status = "green" | "yellow" | "red" | "unknown";
type Snapshot = {
  weekStart: string;
  weekEnd: string;
  vix: { high: number; averageClose: number; latestClose: number; status: Status; sourceDate: string };
  market: {
    spy: number | null; rsp: number | null; qqq: number | null; iwm: number | null;
    rspSpy: number | null; iwmQqq: number | null; sourceDate: string;
    weeklyChange?: Record<string, number>;
  };
  bubbleScore?: { score: number; availableMaximum: number; fullMaximum: number; stage: string; coverage: string; definition: string };
  breadthStatus?: Status;
  indicators?: Indicator[];
};
type Indicator = { group: string; name: string; value: string; status: Status; score: number | null; date: string | null; definition: string; source: string | null };
export type RadarData = { metadata: { lastSuccessfulRefresh: string; latestCompleteWeek: string; vixSource: string; marketPriceSource: string; note: string }; snapshots: Snapshot[] };

const LABEL: Record<Status, string> = { green: "正常", yellow: "留意", red: "警戒", unknown: "待更新" };
const RANGES = [13, 26, 52, 0] as const;

function fmtDate(date: string) {
  return new Intl.DateTimeFormat("zh-HK", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status}`}><i />{LABEL[status]}</span>;
}

function InfoBubble({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="info-bubble">
      <summary aria-label={`查看${label}詳情`}>i</summary>
      <div className="info-popover" role="tooltip"><strong>{label}</strong>{children}</div>
    </details>
  );
}

function Source({ date, definition, href }: { date?: string | null; definition: string; href?: string | null }) {
  return (
    <details className="source">
      <summary>資料來源與定義</summary>
      <p>{definition}{date ? ` 資料日期：${fmtDate(date)}。` : ""}</p>
      {href ? <a href={href} target="_blank" rel="noreferrer">開啟原始來源 ↗</a> : <p className="muted">未有足夠可靠數據，暫不顯示數值。</p>}
    </details>
  );
}

function linePath(values: number[], width: number, height: number, min: number, max: number) {
  const span = max - min || 1;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function VixChart({ rows }: { rows: Snapshot[] }) {
  const width = 760, height = 230, min = 10;
  const max = Math.max(32, ...rows.map((row) => row.vix.high)) + 1;
  const y = (value: number) => height - ((value - min) / (max - min)) * height;
  const paths = [
    ["high", rows.map((row) => row.vix.high), "#b45309"],
    ["average", rows.map((row) => row.vix.averageClose), "#245f87"],
    ["latest", rows.map((row) => row.vix.latestClose), "#152f46"],
  ] as const;
  return (
    <div className="chart-wrap" role="img" aria-label="最近每週 VIX 高位、平均收市及最後收市折線圖">
      <svg viewBox={`0 0 ${width} ${height + 34}`}>
        {[15, 20, 25].map((tick) => <g key={tick}><line className="gridline" x1="0" x2={width} y1={y(tick)} y2={y(tick)} /><text className="axis" x="4" y={y(tick) - 5}>{tick}</text></g>)}
        <rect x="0" y={y(30)} width={width} height={y(27) - y(30)} className="zone-yellow" />
        <line className="threshold threshold-27" x1="0" x2={width} y1={y(27)} y2={y(27)} />
        <line className="threshold threshold-30" x1="0" x2={width} y1={y(30)} y2={y(30)} />
        <text className="threshold-label" x={width - 2} y={y(27) - 5}>接近 30：27</text>
        <text className="threshold-label danger" x={width - 2} y={y(30) - 5}>警戒：30</text>
        {paths.map(([key, values, color]) => <path key={key} d={linePath(values, width, height, min, max)} fill="none" stroke={color} strokeWidth={key === "high" ? 3 : 2} />)}
        {rows.map((row, index) => {
          const x = rows.length === 1 ? width / 2 : (index / (rows.length - 1)) * width;
          return <circle key={row.weekStart} className="chart-point" cx={x} cy={y(row.vix.high)} r="4" tabIndex={0}><title>{`${fmtDate(row.weekEnd)}｜週高 ${row.vix.high.toFixed(2)}｜平均 ${row.vix.averageClose.toFixed(2)}｜最後 ${row.vix.latestClose.toFixed(2)}`}</title></circle>;
        })}
        <text className="axis" x="0" y={height + 25}>{fmtDate(rows[0].weekEnd)}</text>
        <text className="axis" textAnchor="end" x={width} y={height + 25}>{fmtDate(rows.at(-1)!.weekEnd)}</text>
      </svg>
      <div className="legend"><span><i className="legend-high" />週高</span><span><i className="legend-average" />平均收市</span><span><i className="legend-latest" />最後收市</span></div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values), max = Math.max(...values);
  return <svg className="spark" viewBox="0 0 180 48" aria-hidden="true"><path d={linePath(values, 180, 44, min, max)} fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>;
}

function Heatmap({ rows }: { rows: Snapshot[] }) {
  const recent = rows.slice(-13);
  const ratioStatus = (current: number | null, prior: number | null): Status => !current || !prior ? "unknown" : current >= prior ? "green" : "yellow";
  const heatRows = [
    { name: "VIX 週高", values: recent.map((row) => row.vix.status) },
    { name: "等權重 RSP/SPY", values: recent.map((row, index) => ratioStatus(row.market.rspSpy, recent[index - 1]?.market.rspSpy ?? null)) },
    { name: "小型股 IWM/QQQ", values: recent.map((row, index) => ratioStatus(row.market.iwmQqq, recent[index - 1]?.market.iwmQqq ?? null)) },
  ];
  return (
    <div className="heatmap">
      <div className="heat-dates"><span /><span>{fmtDate(recent[0].weekEnd)}</span><span>{fmtDate(recent.at(-1)!.weekEnd)}</span></div>
      {heatRows.map((row) => <div className="heat-row" key={row.name}><strong>{row.name}</strong><div className="heat-cells">{row.values.map((status, index) => <span key={index} className={`heat status-${status}`} title={`${fmtDate(recent[index].weekEnd)}：${LABEL[status]}`} />)}</div></div>)}
    </div>
  );
}

export default function Dashboard({ data }: { data: RadarData }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(13);
  const rows = useMemo(() => range ? data.snapshots.slice(-range) : data.snapshots, [data.snapshots, range]);
  const latest = data.snapshots.at(-1)!;
  const previous = data.snapshots.at(-2)!;
  const score = latest.bubbleScore!;
  const indicators = latest.indicators ?? [];
  const groups = ["市場結構", "基本面", "宏觀"];
  const vixChanged = latest.vix.status !== previous.vix.status;
  const change = latest.market.weeklyChange ?? {};
  const margin = indicators.find((item) => item.name === "Margin Debt");
  const ipo = indicators.find((item) => item.name === "IPO 活躍度");
  const weeklyMove = (row: Snapshot, key: "spy" | "rsp" | "qqq" | "iwm") => {
    const index = data.snapshots.findIndex((item) => item.weekStart === row.weekStart);
    const prior = data.snapshots[index - 1]?.market[key];
    const current = row.market[key];
    return current && prior ? ((current / prior) - 1) * 100 : null;
  };
  const moveText = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <main>
      <header className="hero">
        <div className="eyebrow">WEEKLY MARKET RISK MONITOR</div>
        <div className="hero-row"><div><h1>每週市場 Radar</h1><p>辨認風險累積，不預測短期升跌。</p></div><div className="update"><span>最後成功更新</span><strong>{fmtDate(data.metadata.latestCompleteWeek)}</strong><small>香港時間 · 上一完整交易週</small></div></div>
      </header>

      <section className="market-tape" aria-label="最新市場收市及週變化">
        {(["spy", "rsp", "qqq", "iwm"] as const).map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{latest.market[key]?.toFixed(2)}</strong><em className={(change[key] ?? 0) >= 0 ? "up" : "down"}>{moveText(change[key])}</em><InfoBubble label={`${key.toUpperCase()} 週變化`}><p>上一完整交易週最後收市值及相對前週變化。</p><small>資料日期 {fmtDate(latest.market.sourceDate)}</small></InfoBubble></div>)}
      </section>

      <section className="kpi-grid" aria-label="市場摘要">
        <article className="kpi"><div className="kpi-label"><span>市場階段</span><InfoBubble label="市場階段"><p>依泡沫分數區間判定；缺失資料不當作安全零分。</p></InfoBubble></div><strong>{score.stage}</strong><small>已量度部分仍屬正常區</small></article>
        <article className="kpi"><div className="kpi-label"><span>泡沫分數</span><InfoBubble label="泡沫分數"><p>{score.definition}</p><small>{score.coverage}</small></InfoBubble></div><strong>{score.score}<em> / {score.fullMaximum}</em></strong><small>可量度上限 {score.availableMaximum}</small></article>
        <article className="kpi"><div className="kpi-label"><span>VIX 週高</span><InfoBubble label="VIX 週高"><p>該週每日 VIX 日內高位的最大值；27 黃、30 紅。</p><small>平均 {latest.vix.averageClose.toFixed(2)} · 最後 {latest.vix.latestClose.toFixed(2)}</small></InfoBubble></div><strong>{latest.vix.high.toFixed(2)}</strong><StatusBadge status={latest.vix.status} /><small>距離 27：{(27 - latest.vix.high).toFixed(2)}</small></article>
        <article className="kpi"><div className="kpi-label"><span>市場廣度</span><InfoBubble label="市場廣度"><p>53.5% 美國股票高於 50 日線；股票範圍並非只限 S&amp;P 500。</p></InfoBubble></div><strong>中性</strong><StatusBadge status={latest.breadthStatus ?? "unknown"} /><small>等權重及小型股相對抗跌</small></article>
        <article className="kpi"><div className="kpi-label"><span>Margin Debt</span><InfoBubble label="Margin Debt"><p>{margin?.definition}</p><small>{margin?.date ? fmtDate(margin.date) : "待更新"}</small></InfoBubble></div><strong>{margin?.value.replace("（2026-05）", "") ?? "—"}</strong><StatusBadge status={margin?.status ?? "unknown"} /><small>最新月份 2026-05</small></article>
        <article className="kpi"><div className="kpi-label"><span>IPO</span><InfoBubble label="IPO 活躍度"><p>{ipo?.definition}</p><small>{ipo?.date ? fmtDate(ipo.date) : "待更新"}</small></InfoBubble></div><strong>48<em> 宗</em></strong><StatusBadge status={ipo?.status ?? "unknown"} /><small>Q2 集資 US$104.8B</small></article>
      </section>

      <aside className={`notice ${vixChanged ? "notice-alert" : ""}`}><strong>{vixChanged ? "VIX 狀態有變" : "VIX 狀態未變"}</strong><span>本週最高 {latest.vix.high.toFixed(2)}，距離黃色參考線 27 尚有 {(27 - latest.vix.high).toFixed(2)} 點。警告只反映規則，不是買賣建議。</span></aside>

      <section className="panel wide">
        <div className="section-head"><div><span className="section-index">01</span><h2>VIX 壓力雷達</h2><p>以週內最高值捕捉曾經出現的壓力，而非只看星期五。</p></div><StatusBadge status={latest.vix.status} /></div>
        <VixChart rows={rows} />
        <Source date={latest.vix.sourceDate} definition="週高＝每日最高位最大值；週平均＝官方每日收市算術平均；最後＝該週最後交易日收市。" href={data.metadata.vixSource} />
      </section>

      <div className="two-col">
        <section className="panel score-panel">
          <div className="section-head"><div><span className="section-index">02</span><h2>泡沫分數</h2><p>分數歷史由首個完整核對週開始累積。</p></div></div>
          <div className="score-scale" aria-label={`泡沫分數 ${score.score} 分`}><div className="scale-zones"><i /><i /><i /><i /><i /></div><span style={{ left: `${(score.score / score.fullMaximum) * 100}%` }}>{score.score}</span></div>
          <div className="scale-labels"><span>正常 0–4</span><span>留意 5–7</span><span>上升 8–10</span><span>亢奮 11–13</span><span>危急 14–15</span></div>
          <p className="callout">目前可核對項目得 {score.score}/{score.availableMaximum}；缺失項目沒有當作零分，因此此值不等同完整的 {score.fullMaximum} 分評估。</p>
          <Source definition={score.definition} />
        </section>
        <section className="panel">
          <div className="section-head"><div><span className="section-index">03</span><h2>市場結構</h2><p>比較市值加權與較廣泛市場的相對表現。</p></div></div>
          <div className="ratio-grid">
            <div><span>RSP / SPY</span><strong>{latest.market.rspSpy?.toFixed(4)}</strong><small>本週 RSP {change.rsp?.toFixed(2)}% · SPY {change.spy?.toFixed(2)}%</small><Sparkline values={rows.map((row) => row.market.rspSpy ?? 0)} /></div>
            <div><span>IWM / QQQ</span><strong>{latest.market.iwmQqq?.toFixed(4)}</strong><small>本週 IWM {change.iwm?.toFixed(2)}% · QQQ {change.qqq?.toFixed(2)}%</small><Sparkline values={rows.map((row) => row.market.iwmQqq ?? 0)} /></div>
          </div>
          <Source date={latest.market.sourceDate} definition="比率上升代表等權重或小型股相對大型科技改善；只反映相對表現，不代表整體市場必然上升。" href={data.metadata.marketPriceSource} />
        </section>
      </div>

      <section className="panel wide">
        <div className="section-head"><div><span className="section-index">04</span><h2>指標熱圖</h2><p>綠、黃、紅只表示規則狀態；灰色代表資料不足。</p></div></div>
        <Heatmap rows={data.snapshots} />
        <Source definition="VIX 依 27／30 規則；兩個市場比率以相對上週改善／轉弱顯示。比率熱圖是方向提示，不納入泡沫分數。" />
      </section>

      {groups.map((group, index) => <section className="panel wide" key={group}>
        <div className="section-head"><div><span className="section-index">{String(index + 5).padStart(2, "0")}</span><h2>{group}</h2><p>{group === "市場結構" ? "槓桿、IPO、廣度與動能。" : group === "基本面" ? "估值是否仍有盈利與現金流支持。" : "利率、信用、商品與通脹環境。"}</p></div></div>
        <div className="indicator-grid">{indicators.filter((item) => item.group === group).map((item) => <article className="indicator" key={item.name}><div><span>{item.name}</span><div className="indicator-actions"><StatusBadge status={item.status} /><InfoBubble label={item.name}><p>{item.definition}</p>{item.date && <small>資料日期：{fmtDate(item.date)}</small>}{item.source ? <a href={item.source} target="_blank" rel="noreferrer">原始來源 ↗</a> : <small>沒有足夠可靠數據。</small>}</InfoBubble></div></div><strong>{item.value}</strong><div className="indicator-meta"><small>{item.score !== null ? `泡沫分數 +${item.score}` : "不計分"}</small><small>{item.date ? fmtDate(item.date) : "待核對"}</small></div></article>)}</div>
      </section>)}

      <section className="panel wide">
        <div className="section-head history-head"><div><span className="section-index">08</span><h2>歷史紀錄</h2><p>同一週重跑會更新原紀錄，不會新增重複星期。</p></div><div className="filters" aria-label="歷史範圍">{RANGES.map((value) => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value || "全部"}{value ? "週" : ""}</button>)}</div></div>
        <div className="table-wrap"><table><thead><tr><th>交易週結束</th><th>VIX 高／均／末</th><th>SPY 週</th><th>RSP 週</th><th>QQQ 週</th><th>IWM 週</th><th>RSP/SPY</th><th>IWM/QQQ</th><th>狀態</th></tr></thead><tbody>{[...rows].reverse().map((row) => <tr key={row.weekStart}><td>{fmtDate(row.weekEnd)}</td><td title={`週高 ${row.vix.high.toFixed(2)}｜平均 ${row.vix.averageClose.toFixed(2)}｜最後 ${row.vix.latestClose.toFixed(2)}`}><strong>{row.vix.high.toFixed(2)}</strong> / {row.vix.averageClose.toFixed(2)} / {row.vix.latestClose.toFixed(2)}</td><td>{moveText(weeklyMove(row, "spy"))}</td><td>{moveText(weeklyMove(row, "rsp"))}</td><td>{moveText(weeklyMove(row, "qqq"))}</td><td>{moveText(weeklyMove(row, "iwm"))}</td><td>{row.market.rspSpy?.toFixed(4) ?? "—"}</td><td>{row.market.iwmQqq?.toFixed(4) ?? "—"}</td><td><StatusBadge status={row.vix.status} /></td></tr>)}</tbody></table></div>
      </section>

      <footer><strong>每週市場 Radar</strong><p>只供資料監察與教育用途，不構成投資建議。資料可能延遲；作出決定前請核對原始來源。</p><span>公開唯讀版本 · noindex · 最後完整週 {data.metadata.latestCompleteWeek}</span></footer>
    </main>
  );
}
