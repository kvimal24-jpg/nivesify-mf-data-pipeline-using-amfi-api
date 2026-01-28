/**
 * AMFI DAILY MUTUAL FUND ANALYTICS PIPELINE
 * Cloud-ready (GitHub Actions), single-pass ETL → JSON + Excel
 * - Auto T-1 (weekend-smart), with REPORT_DATE override via env
 * - Robust fetch(): retries + backoff + HTML guard
 * - Safe normalization & ranking for small peer groups
 * - Writes 3 JSONs + Excel + manifest.json (for the workflow)
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/* ================= CONFIG ================= */

// AMFI JSON endpoint used by the fund-performance page
const AMFI_URL = 'https://www.amfiindia.com/gateway/pollingsebi/api/amfi/fundperformance';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0',
  'Origin': 'https://www.amfiindia.com',
  'Referer': 'https://www.amfiindia.com/otherdata/fund-performance'
};

// Bounds
const MAX_MATURITY = 2;
const MAX_CATEGORY = 7;
const MAX_SUBCATEGORY = 70;
const ETF_SUBCATEGORY_CODE = 38;
const MFID = 0;

// Throttling & retries
const DELAY_MS = 400;
const MAX_ATTEMPTS = 4;
const INITIAL_BACKOFF_MS = 600;

// Output dir
const OUT_DIR = path.join(process.cwd(), 'dist');
fs.mkdirSync(OUT_DIR, { recursive: true });

/* ================= LABEL MAPS ================= */
const MATURITY_MAP = { 1: 'Open Ended', 2: 'Close Ended' };
const CATEGORY_MAP = {
  1: 'Equity', 2: 'Debt', 3: 'Hybrid', 4: 'Solution Oriented', 5: 'Other', 6: 'Other', 7: 'Other'
};
const SUBCATEGORY_MAP = {
  1:'Large Cap',2:'Large & Mid Cap',3:'Flexi Cap',4:'Multi Cap',5:'Mid Cap',
  6:'Small Cap',7:'Value',8:'ELSS',9:'Contra',10:'Dividend Yield',11:'Focused',12:'Sectoral / Thematic',
  13:'Long Duration',14:'Medium to Long Duration',15:'Short Duration',16:'Medium Duration',17:'Money Market',
  18:'Low Duration',19:'Ultra Short Duration',20:'Liquid',21:'Overnight',22:'Dynamic Bond',23:'Corporate Bond',
  24:'Credit Risk',25:'Banking & PSU',26:'Floater',27:'FMP',28:'Gilt',29:'Gilt – 10Y',
  30:'Aggressive Hybrid',31:'Conservative Hybrid',32:'Equity Savings',33:'Arbitrage',
  34:'Multi Asset Allocation',35:'Balanced Advantage',40:'Balanced Hybrid',
  36:'Children’s Fund',37:'Retirement Fund',38:'Index / ETF',39:'FoFs (Overseas)'
};

/* ================= HELPERS ================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isFiniteNum = (x) => Number.isFinite(x);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const avg = (arr) => (arr.length ? sum(arr) / arr.length : null);
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const groupBy = (arr, k) => arr.reduce((o, x) => ((o[x[k]] ??= []).push(x), o), {});
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function safeNormalize(value, min, max) {
  if (!isFiniteNum(value) || !isFiniteNum(min) || !isFiniteNum(max) || min >= max) return 0;
  return (value - min) / (max - min);
}

// T-1 trading day: Sat/Sun roll back to Friday; (holiday handling can be added later)
function getPreviousTradingDay(base = new Date()) {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  const w = d.getUTCDay(); // 0 Sun, 6 Sat
  if (w === 0) d.setUTCDate(d.getUTCDate() - 2); // Sun -> Fri
  if (w === 6) d.setUTCDate(d.getUTCDate() - 1); // Sat -> Fri
  return d;
}
function ymd(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function dmyShort(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getUTCDate()).padStart(2,'0')}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

// Robust fetch with retries/backoff and HTML response guard
async function fetchJSON(payload) {
  let backoff = INITIAL_BACKOFF_MS;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(AMFI_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(payload)
      });

      // Retry on 429/5xx
      if (!res.ok && (res.status === 429 || (res.status >= 500 && res.status < 600))) {
        throw new Error(`HTTP ${res.status}`);
      }

      const text = await res.text();
      if (text.trim().startsWith('<')) {
        // AMFI sometimes returns HTML when busy
        throw new Error('HTML response');
      }
      const json = JSON.parse(text);
      return json;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`fetch failed after ${attempt} attempts:`, err.message);
        return null;
      }
      await sleep(backoff);
      backoff *= 2;
    }
  }
  return null;
}

async function run() {
  console.log('STARTING AMFI PIPELINE');

  // Determine REPORT_DATE (T-1 by default) or override via env
  let reportDate;
  if (process.env.REPORT_DATE) {
    // Expecting YYYY-MM-DD
    const [Y,M,D] = process.env.REPORT_DATE.split('-').map(Number);
    reportDate = new Date(Date.UTC(Y, M - 1, D));
  } else {
    reportDate = getPreviousTradingDay(new Date());
  }
  const REPORT_DATE_DMY = dmyShort(reportDate);  // e.g., 23-Jan-2026
  const DATE_TAG = ymd(reportDate);              // e.g., 2026-01-23
  console.log(`Using REPORT_DATE=${REPORT_DATE_DMY} (DATE_TAG=${DATE_TAG})`);

  /* ===== RAW DATA ===== */
  const RAW = [];

  for (let m = 1; m <= MAX_MATURITY; m++) {
    for (let c = 1; c <= MAX_CATEGORY; c++) {
      for (let s = 1; s <= MAX_SUBCATEGORY; s++) {
        const payload = { maturityType: m, category: c, subCategory: s, mfid: MFID, reportDate: REPORT_DATE_DMY };
        const res = await fetchJSON(payload);
        if (res?.data?.length) {
          res.data.forEach((r) =>
            RAW.push({
              Report_Date: REPORT_DATE_DMY,
              Maturity_Type: MATURITY_MAP[m],
              Category: CATEGORY_MAP[c],
              Sub_Category: SUBCATEGORY_MAP[s],
              Sub_Category_Code: s,
              ...r
            })
          );
          console.log('Fetched', m, c, s, res.data.length);
        }
        await sleep(DELAY_MS);
      }
    }
  }

  if (RAW.length === 0) {
    console.error('No RAW data returned. Aborting to avoid overwriting good data.');
    process.exit(1);
  }

  // Optional: write raw snapshot (handy for debugging)
  fs.writeFileSync(path.join(OUT_DIR, `amfi_raw_${DATE_TAG}.json`), JSON.stringify(RAW, null, 2));

  /* ===== TAB: INDUSTRY & CATEGORY INSIGHTS ===== */
  const INSIGHTS = [];
  function build(level, rows, extra = {}) {
    const aum = rows.map((r) => r.dailyAUM).filter(isFiniteNum);
    const r1 = rows.map((r) => r.return1YearDirect).filter(isFiniteNum);
    const r3 = rows.map((r) => r.return3YearDirect).filter(isFiniteNum);
    const r5 = rows.map((r) => r.return5YearDirect).filter(isFiniteNum);
    const br3 = rows.map((r) => r.return3YearBenchmark).filter(isFiniteNum);
    const alpha3 = rows
      .filter((r) => isFiniteNum(r.return3YearDirect) && isFiniteNum(r.return3YearBenchmark))
      .map((r) => r.return3YearDirect - r.return3YearBenchmark);
    const ir3 = rows.map((r) => r.ir3YrDirect).filter(isFiniteNum);

    INSIGHTS.push({
      Level: level,
      Category_Name: extra.Category_Name ?? null,
      Sub_Category_Name: extra.Sub_Category_Name ?? null,
      Number_of_Schemes: rows.length,
      Total_AUM: aum.length ? sum(aum) : 0,
      Median_AUM: median(aum),
      Avg_1Y_Return: avg(r1),
      Avg_3Y_Return: avg(r3),
      Avg_5Y_Return: avg(r5),
      Avg_Benchmark_Return_3Y: avg(br3),
      Avg_Alpha_3Y: avg(alpha3),
      Avg_IR_3Y: avg(ir3),
      Pct_Funds_Beating_Benchmark_3Y: alpha3.length ? (alpha3.filter((x) => x > 0).length / alpha3.length) * 100 : null
    });
  }

  build('Industry', RAW);
  Object.entries(groupBy(RAW, 'Category')).forEach(([k, v]) => build('Category', v, { Category_Name: k }));
  Object.entries(groupBy(RAW, 'Sub_Category')).forEach(([k, v]) =>
    build('Sub-Category', v, { Category_Name: v[0].Category, Sub_Category_Name: k })
  );

  /* ===== TAB: FUND ANALYTICS (ACTIVE) ===== */
  const FUND_ANALYTICS = [];
  const ACTIVE = RAW.filter((r) => r.Sub_Category_Code !== ETF_SUBCATEGORY_CODE);

  Object.entries(groupBy(ACTIVE, 'Sub_Category')).forEach(([sub, rows]) => {
    // Eligible rows for range calc
    const eligible = rows.filter(
      (r) => isFiniteNum(r.return3YearDirect) && isFiniteNum(r.return3YearBenchmark) && isFiniteNum(r.ir3YrDirect)
    );

    const a3Arr = eligible.map((r) => r.return3YearDirect - r.return3YearBenchmark).filter(isFiniteNum);
    const a5Arr = eligible.map((r) => (isFiniteNum(r.return5YearDirect) && isFiniteNum(r.return5YearBenchmark))
      ? (r.return5YearDirect - r.return5YearBenchmark) : NaN).filter(isFiniteNum);
    const i3Arr = eligible.map((r) => r.ir3YrDirect).filter(isFiniteNum);
    const i5Arr = eligible.map((r) => r.ir5YrDirect).filter(isFiniteNum);

    const a3min = Math.min(...a3Arr), a3max = Math.max(...a3Arr);
    const a5min = Math.min(...a5Arr), a5max = Math.max(...a5Arr);
    const i3min = Math.min(...i3Arr), i3max = Math.max(...i3Arr);
    const i5min = Math.min(...i5Arr), i5max = Math.max(...i5Arr);

    rows.forEach((r) => {
      const alpha3 = isFiniteNum(r.return3YearDirect) && isFiniteNum(r.return3YearBenchmark)
        ? r.return3YearDirect - r.return3YearBenchmark : null;
      const alpha5 = isFiniteNum(r.return5YearDirect) && isFiniteNum(r.return5YearBenchmark)
        ? r.return5YearDirect - r.return5YearBenchmark : null;

      const n1 = safeNormalize(alpha3, a3min, a3max);
      const n2 = safeNormalize(alpha5, a5min, a5max);
      const n3 = safeNormalize(r.ir3YrDirect, i3min, i3max);
      const n4 = safeNormalize(r.ir5YrDirect, i5min, i5max);

      const ok = isFiniteNum(r.return3YearDirect) && isFiniteNum(r.ir3YrDirect);
      const score = ok ? 0.25 * (n1 + n2 + n3 + n4) : 0;

      FUND_ANALYTICS.push({
        Fund_Name: r.schemeName,
        AMC: r.amc ?? null,
        Category: r.Category,
        Sub_Category: sub,
        Benchmark_Name: r.benchmark,
        Maturity_Type: r.Maturity_Type,
        Current_AUM: r.dailyAUM,
        Fund_Return_1Y: r.return1YearDirect,
        Benchmark_Return_1Y: r.return1YearBenchmark,
        Alpha_1Y: isFiniteNum(r.return1YearDirect) && isFiniteNum(r.return1YearBenchmark)
          ? r.return1YearDirect - r.return1YearBenchmark : null,
        Fund_Return_3Y: r.return3YearDirect,
        Benchmark_Return_3Y: r.return3YearBenchmark,
        Alpha_3Y: alpha3,
        Fund_Return_5Y: r.return5YearDirect,
        Benchmark_Return_5Y: r.return5YearBenchmark,
        Alpha_5Y: alpha5,
        IR_1Y: r.ir1YrDirect,
        IR_3Y: r.ir3YrDirect,
        IR_5Y: r.ir5YrDirect,
        Composite_Score: score
      });
    });
  });

  Object.values(groupBy(FUND_ANALYTICS, 'Sub_Category')).forEach((arr) => {
    arr.sort((a, b) => (b.Composite_Score ?? 0) - (a.Composite_Score ?? 0));
    const n = arr.length;
    arr.forEach((r, i) => {
      r.Rank_in_SubCategory = i + 1;
      r.Percentile_in_SubCategory = 100 * (1 - i / n);
      r.Flag_Top_10_Percent = i < Math.ceil(n * 0.10) ? 'Yes' : 'No';
    });
  });

  /* ===== TAB: ETF ANALYTICS ===== */
  const ETF_ANALYTICS = [];
  Object.entries(groupBy(RAW.filter((r) => r.Sub_Category_Code === ETF_SUBCATEGORY_CODE), 'benchmark')).forEach(
    ([bench, rows]) => {
      const td = rows
        .map((r) => Math.abs((r.return3YearDirect ?? NaN) - (r.return3YearBenchmark ?? NaN)))
        .filter(isFiniteNum);
      const aums = rows.map((r) => r.dailyAUM).filter(isFiniteNum);

      const tmin = Math.min(...td), tmax = Math.max(...td);
      const amin = Math.min(...aums), amax = Math.max(...aums);

      rows.forEach((r) => {
        const td3 = Math.abs((r.return3YearDirect ?? NaN) - (r.return3YearBenchmark ?? NaN));
        const tscore = 1 - safeNormalize(td3, tmin, tmax);
        const ascore = safeNormalize(r.dailyAUM, amin, amax);
        const score = 0.6 * tscore + 0.4 * ascore;

        ETF_ANALYTICS.push({
          ETF_Name: r.schemeName,
          AMC: r.amc ?? null,
          Benchmark_Name: bench,
          Fund_AUM: r.dailyAUM,
          Fund_Return_1Y: r.return1YearDirect,
          Benchmark_Return_1Y: r.return1YearBenchmark,
          Tracking_Diff_1Y: isFiniteNum(r.return1YearDirect) && isFiniteNum(r.return1YearBenchmark)
            ? r.return1YearDirect - r.return1YearBenchmark : null,
          Fund_Return_3Y: r.return3YearDirect,
          Benchmark_Return_3Y: r.return3YearBenchmark,
          Tracking_Diff_3Y: isFiniteNum(r.return3YearDirect) && isFiniteNum(r.return3YearBenchmark)
            ? r.return3YearDirect - r.return3YearBenchmark : null,
          ETF_Score: isFiniteNum(score) ? score : 0
        });
      });
    }
  );

  Object.values(groupBy(ETF_ANALYTICS, 'Benchmark_Name')).forEach((arr) => {
    arr.sort((a, b) => (b.ETF_Score ?? 0) - (a.ETF_Score ?? 0));
    const n = arr.length;
    arr.forEach((r, i) => {
      r.Rank_within_Benchmark = i + 1;
      r.Percentile_within_Benchmark = 100 * (1 - i / n);
    });
  });

  /* ===== WRITE JSONS + EXCEL ===== */
  const writeJSON = (name, obj) =>
    fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(obj, null, 2));

  writeJSON('industry-and-category-insights.json', INSIGHTS);
  writeJSON('fund-analytics.json', FUND_ANALYTICS);
  writeJSON('etf-analytics.json', ETF_ANALYTICS);

  // manifest for the workflow
  writeJSON('manifest.json', {
    dateTag: DATE_TAG,
    reportDate: REPORT_DATE_DMY,
    counts: {
      raw: RAW.length,
      insights: INSIGHTS.length,
      funds: FUND_ANALYTICS.length,
      etfs: ETF_ANALYTICS.length
    }
  });

  // Validation before we ship
  if (FUND_ANALYTICS.length === 0 && ETF_ANALYTICS.length === 0) {
    console.error('No analytics rows produced. Aborting upload.');
    process.exit(1);
  }

  // Excel workbook (for review)
  const wb = new ExcelJS.Workbook();
  const addSheet = (n, rows) => {
    const ws = wb.addWorksheet(n);
    const cols = Object.keys(rows[0] || {});
    ws.columns = cols.map((k) => ({ header: k, key: k }));
    rows.forEach((x) => ws.addRow(x));
  };

  addSheet('Raw_Data', RAW);
  addSheet('Industry_and_Category_Insights', INSIGHTS);
  addSheet('Fund_Analytics', FUND_ANALYTICS);
  addSheet('ETF_Analytics', ETF_ANALYTICS);

  await wb.xlsx.writeFile(path.join(OUT_DIR, `amfi_analysis_${DATE_TAG}.xlsx`));
  console.log('PIPELINE COMPLETE');
}

run().catch((e) => {
  console.error('UNCAUGHT ERROR:', e);
  process.exit(1);
});
