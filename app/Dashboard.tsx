"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
type Detail = {
  summary: string;
  logic: string;
  theory: string;
  references: { label: string; href: string }[];
};
export type RadarData = { metadata: { lastSuccessfulRefresh: string; latestCompleteWeek: string; vixSource: string; marketPriceSource: string; note: string }; snapshots: Snapshot[] };

const LABEL: Record<Status, string> = { green: "正常", yellow: "留意", red: "警戒", unknown: "待更新" };
const RANGES = [13, 26, 52, 0] as const;

function fmtDate(date: string) {
  return new Intl.DateTimeFormat("zh-HK", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status}`}><i />{LABEL[status]}</span>;
}

function InfoBubble({ label, detail, onOpen, children }: { label: string; detail: Detail; onOpen: (label: string, detail: Detail) => void; children: ReactNode }) {
  return (
    <span className="info-bubble">
      <button type="button" aria-label={`查看${label}詳情`} aria-haspopup="dialog" onClick={(event) => { event.currentTarget.blur(); onOpen(label, detail); }}>i</button>
      <div className="info-popover" role="tooltip"><strong>{label}</strong>{children}</div>
    </span>
  );
}

function DetailSheet({ active, onClose }: { active: { label: string; detail: Detail } | null; onClose: () => void }) {
  useEffect(() => {
    if (!active) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [active, onClose]);
  if (!active) return null;
  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>INDICATOR NOTES</span><h2 id="detail-title">{active.label}</h2></div><button type="button" onClick={onClose} aria-label="關閉詳細說明">×</button></header>
        <div className="detail-section"><h3>概要</h3><p>{active.detail.summary}</p></div>
        <div className="detail-section"><h3>計分邏輯</h3><p>{active.detail.logic}</p></div>
        <div className="detail-section"><h3>背景理論</h3><p>{active.detail.theory}</p></div>
        <div className="detail-section"><h3>支持參考</h3><ul>{active.detail.references.map((reference) => <li key={reference.href}><a href={reference.href} target="_blank" rel="noreferrer">{reference.label} ↗</a></li>)}</ul></div>
        <p className="detail-caveat">分數是本 Radar 的監察規則，不是學術定律或自動買賣訊號。</p>
      </section>
    </div>
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
  const width = 440, height = 128, min = 10;
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
        {[15, 20, 25].map((tick) => <g key={tick}><line className="gridline" x1="0" x2={width} y1={y(tick)} y2={y(tick)} /><text className="axis" x="4" y={y(tick) - 4}>{tick}</text></g>)}
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

const REFS = {
  vix: { label: "Cboe：VIX 定義與計算", href: "https://www.cboe.com/tradable_products/vix/faqs" },
  equalWeight: { label: "S&P DJI：S&P 500 Equal Weight 方法", href: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-equal-weight-index/" },
  margin: { label: "FINRA：Margin Statistics", href: "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics" },
  ipo: { label: "SEC：IPO 統計與定義", href: "https://www.sec.gov/data-research/statistics-data-visualizations/initial-public-offerings-ipos" },
  options: { label: "Cboe：Options Market Statistics", href: "https://www.cboe.com/markets/us/options/market-statistics" },
  yieldCurve: { label: "New York Fed：Yield Curve Leading Indicator", href: "https://www.newyorkfed.org/research/capital_markets/ycfaq" },
  fred: { label: "Federal Reserve Economic Data（FRED）", href: "https://fred.stlouisfed.org/" },
  filings: { label: "SEC EDGAR：公司申報文件", href: "https://www.sec.gov/edgar/search/" },
};

function indicatorDetail(item: Indicator): Detail {
  const specific: Record<string, { theory: string; reference: { label: string; href: string } }> = {
    "VIX 與市場高位": { theory: "VIX 是由 SPX options 推算的未來 30 日預期波幅。市場高位配合低波幅可反映安逸情緒，但不能單獨證明泡沫。", reference: REFS.vix },
    "市場廣度": { theory: "指數上升若由更多股票共同參與，結構通常較廣；等權重指數可減少少數 mega-cap 對市值加權指數的主導。", reference: REFS.equalWeight },
    "Margin Debt": { theory: "孖展債務代表以借貸承擔股票風險的規模。快速增長會放大上升，也可能在跌市觸發去槓桿，但總額會隨市場規模長期上升。", reference: REFS.margin },
    "IPO 活躍度": { theory: "新股宗數與集資額常被用作風險胃納及發行人估值窗口的代理；熱度高不代表每隻新股都被高估。", reference: REFS.ipo },
    "SPY 三個月升幅": { theory: "短期 momentum 可反映價格加速與追逐行為，但趨勢亦可能由盈利改善支持，因此只作輕量輔助訊號。", reference: REFS.equalWeight },
    "Equity Put/Call": { theory: "Put/Call ratio 以期權成交結構觀察避險與投機情緒；極端低值可能代表安逸，但必須使用一致的 equity-only 口徑。", reference: REFS.options },
    "非 Mega-cap 盈利支持": { theory: "若升市得到更廣泛盈利增長支持，價格上升較不依賴估值擴張；預測值仍可能被分析員下調。", reference: REFS.filings },
    "科技估值": { theory: "估值倍數把價格與預期盈利連結；應同時比較增長、利率及自身歷史，而不是用單一 P/E 判斷泡沫。", reference: REFS.filings },
    "AI CapEx／收入／現金流": { theory: "資本開支只有在收入、毛利或自由現金流逐步回報時才較可持續；不同公司的會計分類不可直接相加。", reference: REFS.filings },
    "孳息曲線與信用": { theory: "10Y–3M term spread 可作領先景氣訊號；信用利差則反映企業融資風險溢價。兩者均不是精確擇時工具。", reference: REFS.yieldCurve },
    "板塊輪動、油價及通脹": { theory: "輪動可顯示升市是否擴散；油價會影響通脹與企業成本，但傳導受需求、匯率及基數效應影響。", reference: REFS.fred },
  };
  const background = specific[item.name] ?? { theory: "此項用作交叉檢查市場風險，必須與價格、盈利及宏觀資料一併解讀。", reference: REFS.fred };
  const references = [background.reference, ...(item.source ? [{ label: "本期數據來源", href: item.source }] : [])].filter((reference, index, all) => all.findIndex((candidate) => candidate.href === reference.href) === index);
  return {
    summary: `${item.value}。${item.definition}`,
    logic: item.score === null ? "目前不計入泡沫總分；資料不足或此項仍屬質化交叉核對。" : `本週按已核對規則計 +${item.score} 分。狀態為「${LABEL[item.status]}」；門檻由 radar_parameters.md 管理。`,
    theory: background.theory,
    references,
  };
}

export default function Dashboard({ data }: { data: RadarData }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(13);
  const [activeDetail, setActiveDetail] = useState<{ label: string; detail: Detail } | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
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
  const openDetail = (label: string, detail: Detail) => setActiveDetail({ label, detail });
  const priceDetail = (ticker: string): Detail => ({
    summary: `${ticker} 顯示上一完整交易週最後收市值及相對前週變化。`,
    logic: "只作市場背景，不直接計入泡沫分數；相對強弱由 RSP/SPY 與 IWM/QQQ 另行觀察。",
    theory: "價格指數是結果而非原因。比較大型股、等權重及小型股，有助分辨升跌是否由少數大型公司主導。",
    references: [{ label: "本期市場價格來源", href: data.metadata.marketPriceSource }, REFS.equalWeight],
  });
  const vixDetail: Detail = {
    summary: `本週最高 ${latest.vix.high.toFixed(2)}、平均收市 ${latest.vix.averageClose.toFixed(2)}、最後收市 ${latest.vix.latestClose.toFixed(2)}。`,
    logic: "本 Radar 規則：週高低於 27 為綠色；27–29.99 為黃色；30 或以上為紅色。只在狀態相對上週改變時發出醒目提醒。",
    theory: "VIX 由 SPX options 價格推算未來 30 日預期波幅。它反映波幅預期，不直接預測市場方向；27／30 是本監察系統的風險門檻，不是 Cboe 的買賣建議。",
    references: [REFS.vix, { label: "本期 VIX 數據來源", href: data.metadata.vixSource }],
  };
  const scoreDetail: Detail = {
    summary: `目前得 ${score.score}/${score.availableMaximum} 個可量度分數；完整框架上限 ${score.fullMaximum}。${score.coverage}。`,
    logic: "總分是各已核對指標分數相加。正常 0–4、留意 5–7、風險上升 8–10、亢奮 11–13、危急 14–15；缺失資料不當作 0 分，並同時顯示可量度上限。",
    theory: "泡沫通常不是單一數字，而是槓桿、發行熱度、狹窄升市、動能、估值與基本面脫節等訊號同時累積。組合分數用來維持觀察紀律，不代表精確崩跌機率。",
    references: [REFS.margin, REFS.equalWeight, REFS.ipo, REFS.vix],
  };
  const breadthDetail: Detail = {
    summary: "以高於 50 日線的股票比例、RSP/SPY 及 IWM/QQQ 交叉觀察升市參與度。",
    logic: "本週市場廣度計 +1 分並顯示黃色；比率熱圖只顯示改善或轉弱方向，本身不重複計分。",
    theory: "市值加權指數可被少數 mega-cap 推動；等權重和小型股相對表現提供另一個市場參與度視角。",
    references: [REFS.equalWeight, ...(indicators.find((item) => item.name === "市場廣度")?.source ? [{ label: "本期廣度數據來源", href: indicators.find((item) => item.name === "市場廣度")!.source! }] : [])],
  };
  useEffect(() => {
    if (!unlocked) return;
    let timer = window.setTimeout(lock, 10_000);
    let lastReset = 0;
    function lock() {
      setUnlocked(false);
      setActiveDetail(null);
      setPasscode("");
    }
    function activity() {
      const now = Date.now();
      if (now - lastReset < 250) return;
      lastReset = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, 10_000);
    }
    const events = ["mousemove", "pointermove", "pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    const visibility = () => document.hidden && lock();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [unlocked]);

  if (!unlocked) {
    return (
      <main className="lock-shell">
        <form className="lock-card" onSubmit={(event) => {
          event.preventDefault();
          if (passcode === "0000") {
            setPasscodeError("");
            setPasscode("");
            setUnlocked(true);
          } else {
            setPasscodeError("密碼不正確");
          }
        }}>
          <span className="lock-eyebrow">WEEKLY MARKET RISK MONITOR</span>
          <h1>輸入密碼</h1>
          <p>內容會在連續 10 秒沒有操作後自動隱藏。</p>
          <label htmlFor="radar-passcode">4 位數字密碼</label>
          <input id="radar-passcode" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" autoFocus value={passcode} aria-invalid={Boolean(passcodeError)} aria-describedby="passcode-message" onChange={(event) => { setPasscode(event.target.value.replace(/\D/g, "").slice(0, 4)); setPasscodeError(""); }} />
          <button type="submit">開啟 Dashboard</button>
          <span id="passcode-message" className={passcodeError ? "lock-error" : "lock-note"} aria-live="polite">{passcodeError || "滑鼠移動、點擊、鍵盤、捲動及觸控均視為操作。"}</span>
        </form>
      </main>
    );
  }

  return (
    <main>
      <header className="hero">
        <div className="eyebrow">WEEKLY MARKET RISK MONITOR</div>
        <div className="update"><span>最後成功更新</span><strong>{fmtDate(data.metadata.latestCompleteWeek)}</strong><small>香港時間 · 上一完整交易週</small></div>
      </header>

      <section className="market-tape" aria-label="最新市場收市及週變化">
        {(["spy", "rsp", "qqq", "iwm"] as const).map((key) => <div key={key}><span>{key.toUpperCase()}</span><strong>{latest.market[key]?.toFixed(2)}</strong><em className={(change[key] ?? 0) >= 0 ? "up" : "down"}>{moveText(change[key])}</em><InfoBubble label={`${key.toUpperCase()} 週變化`} detail={priceDetail(key.toUpperCase())} onOpen={openDetail}><p>上一完整交易週最後收市值及相對前週變化。</p><small>資料日期 {fmtDate(latest.market.sourceDate)} · 點擊看方法</small></InfoBubble></div>)}
      </section>

      <section className="kpi-grid" aria-label="市場摘要">
        <article className="kpi"><div className="kpi-label"><span>市場階段</span><InfoBubble label="市場階段" detail={scoreDetail} onOpen={openDetail}><p>依泡沫分數區間判定；缺失資料不當作安全零分。</p><small>點擊查看完整計分框架</small></InfoBubble></div><strong>{score.stage}</strong><small>已量度部分仍屬正常區</small></article>
        <article className="kpi"><div className="kpi-label"><span>泡沫分數</span><InfoBubble label="泡沫分數" detail={scoreDetail} onOpen={openDetail}><p>{score.definition}</p><small>{score.coverage} · 點擊看理論</small></InfoBubble></div><strong>{score.score}<em> / {score.fullMaximum}</em></strong><small>可量度上限 {score.availableMaximum}</small></article>
        <article className="kpi"><div className="kpi-label"><span>VIX 週高</span><InfoBubble label="VIX 週高" detail={vixDetail} onOpen={openDetail}><p>週內日中最高值；27 黃、30 紅。</p><small>平均 {latest.vix.averageClose.toFixed(2)} · 最後 {latest.vix.latestClose.toFixed(2)} · 點擊看方法</small></InfoBubble></div><strong>{latest.vix.high.toFixed(2)}</strong><StatusBadge status={latest.vix.status} /><small>距離 27：{(27 - latest.vix.high).toFixed(2)}</small></article>
        <article className="kpi"><div className="kpi-label"><span>市場廣度</span><InfoBubble label="市場廣度" detail={breadthDetail} onOpen={openDetail}><p>53.5% 美國股票高於 50 日線，並比較等權重與小型股。</p><small>點擊查看廣度理論</small></InfoBubble></div><strong>中性</strong><StatusBadge status={latest.breadthStatus ?? "unknown"} /><small>等權重及小型股相對抗跌</small></article>
        <article className="kpi"><div className="kpi-label"><span>Margin Debt</span><InfoBubble label="Margin Debt" detail={margin ? indicatorDetail(margin) : scoreDetail} onOpen={openDetail}><p>{margin?.definition}</p><small>{margin?.date ? fmtDate(margin.date) : "待更新"} · 點擊看理論</small></InfoBubble></div><strong>{margin?.value.replace("（2026-05）", "") ?? "—"}</strong><StatusBadge status={margin?.status ?? "unknown"} /><small>最新月份 2026-05</small></article>
        <article className="kpi"><div className="kpi-label"><span>IPO</span><InfoBubble label="IPO 活躍度" detail={ipo ? indicatorDetail(ipo) : scoreDetail} onOpen={openDetail}><p>{ipo?.definition}</p><small>{ipo?.date ? fmtDate(ipo.date) : "待更新"} · 點擊看理論</small></InfoBubble></div><strong>48<em> 宗</em></strong><StatusBadge status={ipo?.status ?? "unknown"} /><small>Q2 集資 US$104.8B</small></article>
      </section>

      <aside className={`notice ${vixChanged ? "notice-alert" : ""}`}><strong>{vixChanged ? "VIX 狀態有變" : "VIX 狀態未變"}</strong><span>本週最高 {latest.vix.high.toFixed(2)}，距離黃色參考線 27 尚有 {(27 - latest.vix.high).toFixed(2)} 點。警告只反映規則，不是買賣建議。</span></aside>

      <div className="insight-grid">
        <section className="panel vix-panel">
          <div className="section-head"><div><span className="section-index">01</span><h2>VIX 壓力雷達</h2><p>週高、平均與最後收市。</p></div><StatusBadge status={latest.vix.status} /></div>
          <VixChart rows={rows} />
          <button className="detail-link" type="button" onClick={() => openDetail("VIX 壓力雷達", vixDetail)}>計分、理論與來源 →</button>
        </section>
        <section className="panel score-panel">
          <div className="section-head"><div><span className="section-index">02</span><h2>泡沫分數</h2><p>分數歷史由首個完整核對週開始累積。</p></div></div>
          <div className="score-scale" aria-label={`泡沫分數 ${score.score} 分`}><div className="scale-zones"><i /><i /><i /><i /><i /></div><span style={{ left: `${(score.score / score.fullMaximum) * 100}%` }}>{score.score}</span></div>
          <div className="scale-labels"><span>正常 0–4</span><span>留意 5–7</span><span>上升 8–10</span><span>亢奮 11–13</span><span>危急 14–15</span></div>
          <p className="callout">目前可核對項目得 {score.score}/{score.availableMaximum}；缺失項目沒有當作零分，因此此值不等同完整的 {score.fullMaximum} 分評估。</p>
          <button className="detail-link" type="button" onClick={() => openDetail("泡沫分數", scoreDetail)}>計分、理論與來源 →</button>
        </section>
        <section className="panel">
          <div className="section-head"><div><span className="section-index">03</span><h2>市場結構</h2><p>比較市值加權與較廣泛市場的相對表現。</p></div></div>
          <div className="ratio-grid">
            <div><span>RSP / SPY</span><strong>{latest.market.rspSpy?.toFixed(4)}</strong><small>本週 RSP {change.rsp?.toFixed(2)}% · SPY {change.spy?.toFixed(2)}%</small><Sparkline values={rows.map((row) => row.market.rspSpy ?? 0)} /></div>
            <div><span>IWM / QQQ</span><strong>{latest.market.iwmQqq?.toFixed(4)}</strong><small>本週 IWM {change.iwm?.toFixed(2)}% · QQQ {change.qqq?.toFixed(2)}%</small><Sparkline values={rows.map((row) => row.market.iwmQqq ?? 0)} /></div>
          </div>
          <button className="detail-link" type="button" onClick={() => openDetail("市場結構", breadthDetail)}>方法、理論與來源 →</button>
        </section>
      </div>

      <section className="panel wide">
        <div className="section-head"><div><span className="section-index">04</span><h2>指標熱圖</h2><p>綠、黃、紅只表示規則狀態；灰色代表資料不足。</p></div></div>
        <Heatmap rows={data.snapshots} />
        <Source definition="VIX 依 27／30 規則；兩個市場比率以相對上週改善／轉弱顯示。比率熱圖是方向提示，不納入泡沫分數。" />
      </section>

      {groups.map((group, index) => <section className="panel wide" key={group}>
        <div className="section-head"><div><span className="section-index">{String(index + 5).padStart(2, "0")}</span><h2>{group}</h2><p>{group === "市場結構" ? "槓桿、IPO、廣度與動能。" : group === "基本面" ? "估值是否仍有盈利與現金流支持。" : "利率、信用、商品與通脹環境。"}</p></div></div>
        <div className="indicator-grid">{indicators.filter((item) => item.group === group).map((item) => <article className="indicator" key={item.name}><div><span>{item.name}</span><div className="indicator-actions"><StatusBadge status={item.status} /><InfoBubble label={item.name} detail={indicatorDetail(item)} onOpen={openDetail}><p>{item.definition}</p>{item.date && <small>資料日期：{fmtDate(item.date)}</small>}<small>點擊查看計分、理論與來源</small></InfoBubble></div></div><strong>{item.value}</strong><div className="indicator-meta"><small>{item.score !== null ? `泡沫分數 +${item.score}` : "不計分"}</small><small>{item.date ? fmtDate(item.date) : "待核對"}</small></div></article>)}</div>
      </section>)}

      <section className="panel wide">
        <div className="section-head history-head"><div><span className="section-index">08</span><h2>歷史紀錄</h2><p>同一週重跑會更新原紀錄，不會新增重複星期。</p></div><div className="filters" aria-label="歷史範圍">{RANGES.map((value) => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value || "全部"}{value ? "週" : ""}</button>)}</div></div>
        <div className="table-wrap"><table><thead><tr><th>交易週結束</th><th>VIX 高／均／末</th><th>SPY 週</th><th>RSP 週</th><th>QQQ 週</th><th>IWM 週</th><th>RSP/SPY</th><th>IWM/QQQ</th><th>狀態</th></tr></thead><tbody>{[...rows].reverse().map((row) => <tr key={row.weekStart}><td>{fmtDate(row.weekEnd)}</td><td title={`週高 ${row.vix.high.toFixed(2)}｜平均 ${row.vix.averageClose.toFixed(2)}｜最後 ${row.vix.latestClose.toFixed(2)}`}><strong>{row.vix.high.toFixed(2)}</strong> / {row.vix.averageClose.toFixed(2)} / {row.vix.latestClose.toFixed(2)}</td><td>{moveText(weeklyMove(row, "spy"))}</td><td>{moveText(weeklyMove(row, "rsp"))}</td><td>{moveText(weeklyMove(row, "qqq"))}</td><td>{moveText(weeklyMove(row, "iwm"))}</td><td>{row.market.rspSpy?.toFixed(4) ?? "—"}</td><td>{row.market.iwmQqq?.toFixed(4) ?? "—"}</td><td><StatusBadge status={row.vix.status} /></td></tr>)}</tbody></table></div>
      </section>

      <DetailSheet active={activeDetail} onClose={() => setActiveDetail(null)} />
      <footer><strong>Radar</strong><p>只供資料監察與教育用途，不構成投資建議。資料可能延遲；作出決定前請核對原始來源。</p><span>公開唯讀版本 · noindex · 最後完整週 {data.metadata.latestCompleteWeek}</span></footer>
    </main>
  );
}
