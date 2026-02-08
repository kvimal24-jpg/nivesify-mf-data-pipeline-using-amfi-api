# Nivesify Data Pipeline

**Daily AMFI Mutual Fund Analytics ETL Pipeline**

This repository contains the data infrastructure for Nivesify - a robust ETL pipeline that fetches, processes, and serves Indian mutual fund data from AMFI (Association of Mutual Funds in India).

## 🎯 Purpose

This is a **data-only repository** that:
- Fetches daily mutual fund performance data from AMFI API
- Generates comprehensive analytics (rankings, alpha, IR, percentiles)
- Outputs JSON files and Excel reports
- Uploads to Cloudflare R2 storage
- Serves data via Cloudflare Pages Functions API endpoint
- Designed to be consumed by frontend applications

## 📁 Structure

```
├── etl/
│   └── amfi_pipeline.js       # Main ETL pipeline
├── functions/
│   └── funds.js               # Cloudflare Pages Function API
├── .github/workflows/
│   └── daily_amfi.yml         # GitHub Actions workflow (already configured)
├── dist/                      # Generated output files (git-ignored)
└── requirements.txt           # Python dependencies (for auxiliary scripts)
```

## 🚀 Usage

### Running Locally

```bash
# Install dependencies
npm install

# Run ETL for yesterday's data (T-1, weekend-smart)
npm run etl

# Run ETL for specific date (YYYY-MM-DD format)
REPORT_DATE=2026-02-07 npm run etl
```

### Output Files

The pipeline generates files in the `dist/` directory:

1. **`amfi_raw_[date].json`** - Complete raw data snapshot
2. **`industry-and-category-insights.json`** - Aggregated market-level analytics
3. **`fund-analytics.json`** - Active fund rankings with composite scores
4. **`etf-analytics.json`** - ETF performance and tracking analysis
5. **`amfi_analysis_[date].xlsx`** - Excel workbook with all tabs
6. **`manifest.json`** - Metadata (dateTag, counts)

## 📊 Data Schema

### Fund Analytics Output
```json
{
  "Fund_Name": "HDFC Flexi Cap Fund - Direct Plan - Growth",
  "AMC": "HDFC Mutual Fund",
  "Category": "Equity",
  "Sub_Category": "Flexi Cap",
  "Current_AUM": 45000.5,
  "Fund_Return_3Y": 18.5,
  "Benchmark_Return_3Y": 15.2,
  "Alpha_3Y": 3.3,
  "IR_3Y": 1.2,
  "Composite_Score": 0.85,
  "Rank_in_SubCategory": 5,
  "Percentile_in_SubCategory": 92.3,
  "Flag_Top_10_Percent": "Yes"
}
```

## 🔌 API Endpoint

The data is served via Cloudflare Pages Function at:

```
GET /api/funds
```

**Response**: `fund-analytics.json` from R2 bucket  
**Cache**: 5 minutes (`max-age=300`)

### Usage from Frontend Application

```javascript
const response = await fetch('https://your-pages-domain.pages.dev/api/funds');
const funds = await response.json();

// Example: Get top equity funds
const topEquity = funds
  .filter(f => f.Category === 'Equity' && f.Flag_Top_10_Percent === 'Yes')
  .sort((a, b) => b.Composite_Score - a.Composite_Score)
  .slice(0, 10);
```

## ⚙️ Automated Pipeline (Already Configured)

### GitHub Actions Workflow

The repository has a **daily automated workflow** (`.github/workflows/daily_amfi.yml`) that:

1. **Runs daily** at 11:45 PM IST (6:15 PM UTC)
2. Fetches latest AMFI data
3. Generates all analytics
4. Uploads to R2 in **two locations**:
   - `data/latest/` - Always current (5-min cache)
   - `data/archive/[date]/` - Historical snapshots (immutable)

### Existing Secrets (Already Set Up)

The workflow uses these GitHub secrets:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

**✅ No additional setup needed - it's already running!**

## 📈 Analytics Features

### Active Funds
- **Composite Score**: Weighted combination of:
  - Alpha (3Y & 5Y): 50%
  - Information Ratio (3Y & 5Y): 50%
- **Percentile Rankings** within subcategory
- **Top 10% Flag** for quick filtering
- Safe normalization for small peer groups

### ETFs
- **Tracking Difference Analysis** (1Y, 3Y)
- **ETF Score**: 60% tracking accuracy + 40% AUM
- Rankings within same benchmark

### Category Insights
- Median AUM, Average Returns (1Y/3Y/5Y)
- Average Alpha & Information Ratio
- % of funds beating benchmark

## 🛡️ Error Handling

- **Retries with exponential backoff** (600ms → 1200ms → 2400ms)
- **HTML response detection** (AMFI returns HTML when busy)
- **Validation before upload** (prevents bad data deployments)
- **Exits with error** if no data fetched

## 🔧 Configuration

### Environment Variables

- `REPORT_DATE` (optional): Override date in YYYY-MM-DD format
  - Default: Previous trading day (T-1, weekend-smart)
  - Example: `REPORT_DATE=2026-02-07 npm run etl`

### Pipeline Settings (in amfi_pipeline.js)

```javascript
MAX_MATURITY = 2;           // Open/Close Ended
MAX_CATEGORY = 6;           // Equity, Debt, Hybrid, etc.
MAX_SUBCATEGORY = 70;       // Large Cap, Mid Cap, etc.
DELAY_MS = 400;             // Throttle between requests
MAX_ATTEMPTS = 4;           // Retry count
```

## 📝 Data Source

**AMFI Fund Performance API**  
`https://www.amfiindia.com/gateway/pollingsebi/api/amfi/fundperformance`

Data includes:
- Daily AUM, NAV
- Returns: 1Y, 3Y, 5Y, 10Y (Direct & Regular plans)
- Benchmark returns
- Information Ratio
- Category/Subcategory classifications

## 🤝 Integration Example

### From Your Frontend Application

```typescript
// Fetch all funds data
async function getFundsData() {
  const res = await fetch('https://nivesify-pipeline.pages.dev/api/funds');
  return await res.json();
}

// Filter and display top performers
async function displayTopFunds(category: string) {
  const funds = await getFundsData();
  
  const top = funds
    .filter(f => 
      f.Category === category && 
      f.Flag_Top_10_Percent === 'Yes' &&
      f.Current_AUM > 1000  // Min AUM filter
    )
    .sort((a, b) => b.Composite_Score - a.Composite_Score)
    .slice(0, 20);
    
  return top;
}

// Get category insights
async function getCategoryInsights() {
  const res = await fetch('https://nivesify-pipeline.pages.dev/api/insights');
  return await res.json();
}
```

## 📦 R2 Bucket Structure

```
mf-data-bucket/
├── data/
│   ├── latest/                          # Always current
│   │   ├── fund-analytics.json
│   │   ├── etf-analytics.json
│   │   ├── industry-and-category-insights.json
│   │   ├── manifest.json
│   │   └── amfi_analysis_[date].xlsx
│   └── archive/                         # Historical
│       ├── 2026-02-07/
│       ├── 2026-02-06/
│       └── ...
```

## 📄 License

Private - All rights reserved

---

**Last Updated**: February 2026  
**Maintained by**: Nivesify Team
