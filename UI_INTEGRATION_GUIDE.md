# NIVESIFY DATA PIPELINE - UI INTEGRATION GUIDE

**Complete Technical Documentation for AI Assistants**  
**Version**: 1.0 | **Date**: February 2026

---

## 📡 SECTION 1: CONNECTING TO CLOUDFLARE R2 & FETCHING DATA

### 1.1 Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  GitHub Actions │ ───> │  Cloudflare R2   │ <─── │  Your Frontend  │
│  (Daily ETL)    │      │  (Data Storage)  │      │  Application    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                              ↑
                              │
                         (API Endpoint)
                    /api/funds (Cloudflare Function)
```

### 1.2 Data Location

**R2 Bucket**: `mf-data-bucket`

**R2 Storage Structure**:
```
mf-data-bucket/
├── data/
│   ├── latest/                              # Always current (5-min cache)
│   │   ├── fund-analytics.json             # PRIMARY: Active fund rankings
│   │   ├── etf-analytics.json              # ETF performance data
│   │   ├── industry-and-category-insights.json  # Market overview
│   │   ├── manifest.json                   # Metadata (timestamp, counts)
│   │   ├── amfi_raw.json                   # Raw data snapshot
│   │   └── amfi_analysis.xlsx              # Excel report (optional)
│   └── archive/                             # Historical snapshots
│       ├── 2026-02-07/                     # All files from that date
│       ├── 2026-02-06/
│       └── ...
```

### 1.3 Connection Methods

#### **Method A: Direct R2 Public URL (Recommended)**

If your R2 bucket has public access enabled:

```javascript
// Base URL (replace with your actual domain)
const R2_BASE_URL = 'https://pub-xxxxxxx.r2.dev/data/latest';

// Fetch fund analytics
async function fetchFundAnalytics() {
  const response = await fetch(`${R2_BASE_URL}/fund-analytics.json`);
  if (!response.ok) throw new Error('Failed to fetch fund data');
  return await response.json();
}

// Fetch ETF analytics
async function fetchETFAnalytics() {
  const response = await fetch(`${R2_BASE_URL}/etf-analytics.json`);
  return await response.json();
}

// Fetch market insights
async function fetchMarketInsights() {
  const response = await fetch(`${R2_BASE_URL}/industry-and-category-insights.json`);
  return await response.json();
}

// Fetch metadata
async function fetchManifest() {
  const response = await fetch(`${R2_BASE_URL}/manifest.json`);
  return await response.json();
}
```

#### **Method B: Via Cloudflare Pages Function (Already Deployed)**

Your repo already has a Cloudflare Function at `/functions/funds.js`:

```javascript
// API Endpoint (deployed via Cloudflare Pages)
const API_BASE = 'https://your-project.pages.dev/api';

async function fetchFundAnalytics() {
  const response = await fetch(`${API_BASE}/funds`);
  return await response.json();
}
```

**Note**: You'll need to create similar endpoints for other files (etf-analytics, insights) by adding:
- `/functions/etfs.js`
- `/functions/insights.js`
- `/functions/manifest.js`

#### **Method C: Workers + Custom Domain (Advanced)**

If you want custom caching, CORS, or rate limiting:

```javascript
// Cloudflare Worker example
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Route handling
    let file = 'fund-analytics.json';
    if (url.pathname.includes('/etfs')) file = 'etf-analytics.json';
    if (url.pathname.includes('/insights')) file = 'industry-and-category-insights.json';
    
    // Fetch from R2
    const object = await env.MF_DATA_BUCKET.get(`data/latest/${file}`);
    if (!object) return new Response('Not Found', { status: 404 });
    
    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  },
};
```

### 1.4 Error Handling & Caching

```javascript
// Production-ready fetch with error handling
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        cache: 'no-cache', // or 'force-cache' for aggressive caching
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validation
      if (!Array.isArray(data) && !data.length) {
        throw new Error('Invalid data format');
      }
      
      return data;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Client-side caching (localStorage)
async function getCachedData(key, fetchFn, maxAge = 300000) { // 5 minutes
  const cached = localStorage.getItem(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < maxAge) {
      return data;
    }
  }
  
  const fresh = await fetchFn();
  localStorage.setItem(key, JSON.stringify({
    data: fresh,
    timestamp: Date.now(),
  }));
  return fresh;
}

// Usage
const funds = await getCachedData('fund-analytics', fetchFundAnalytics);
```

### 1.5 CORS Considerations

If fetching from a different domain, ensure CORS is enabled:

**In your Cloudflare Function** (`functions/funds.js`):
```javascript
export async function onRequest(context) {
  const r2 = context.env.MF_DATA_BUCKET;
  const object = await r2.get('data/latest/fund-analytics.json');
  
  if (!object) {
    return new Response('Not found', { status: 404 });
  }
  
  const json = await object.text();
  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*', // ← Add this for CORS
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
```

---

## 📊 SECTION 2: DETAILED DATA STRUCTURE & FIELD DEFINITIONS

### 2.1 File: `fund-analytics.json` (PRIMARY - Active Funds)

**Description**: Complete analytics for all active mutual funds with composite scoring, alpha calculations, and percentile rankings.

**Array Size**: ~2,000-3,000 fund records  
**Update Frequency**: Daily at 11:45 PM IST  
**Use Cases**: Fund screener, rankings, comparison, portfolio analysis

#### **Schema**:

```typescript
interface FundAnalytics {
  // IDENTIFICATION
  Fund_Name: string;                    // "HDFC Flexi Cap Fund - Direct Plan - Growth"
  AMC: string;                          // "HDFC Mutual Fund"
  Category: string;                     // "Equity", "Debt", "Hybrid"
  Sub_Category: string;                 // "Flexi Cap", "Large Cap", "Long Duration", etc.
  Benchmark_Name: string;               // "NIFTY 500 - TRI"
  Maturity_Type: string;                // "Open Ended" or "Close Ended"
  
  // ASSETS UNDER MANAGEMENT
  Current_AUM: number;                  // Daily AUM in Crores (e.g., 45234.67)
  
  // RETURNS (Direct Plan)
  Fund_Return_1Y: number | null;        // 1-Year return % (e.g., 18.5)
  Fund_Return_3Y: number | null;        // 3-Year CAGR %
  Fund_Return_5Y: number | null;        // 5-Year CAGR %
  
  // BENCHMARK RETURNS
  Benchmark_Return_1Y: number | null;   // Benchmark 1Y %
  Benchmark_Return_3Y: number | null;   // Benchmark 3Y %
  Benchmark_Return_5Y: number | null;   // Benchmark 5Y %
  
  // ALPHA CALCULATIONS (Fund Return - Benchmark Return)
  Alpha_1Y: number | null;              // 1-Year Alpha (can be negative)
  Alpha_3Y: number | null;              // 3-Year Alpha
  Alpha_5Y: number | null;              // 5-Year Alpha
  
  // INFORMATION RATIO (Risk-Adjusted Performance)
  IR_1Y: number | null;                 // 1-Year IR (higher is better)
  IR_3Y: number | null;                 // 3-Year IR
  IR_5Y: number | null;                 // 5-Year IR
  
  // COMPOSITE SCORING & RANKING
  Composite_Score: number;              // 0-1 scale (e.g., 0.85)
                                        // Formula: 0.25 * (normalized alpha3Y + alpha5Y + IR3Y + IR5Y)
  Rank_in_SubCategory: number;          // Rank within sub-category (1 = best)
  Percentile_in_SubCategory: number;    // Percentile 0-100 (100 = top)
  Flag_Top_10_Percent: "Yes" | "No";   // Quick filter for top performers
}
```

#### **Example Record**:

```json
{
  "Fund_Name": "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
  "AMC": "PPFAS Mutual Fund",
  "Category": "Equity",
  "Sub_Category": "Flexi Cap",
  "Benchmark_Name": "NIFTY 500 - TRI",
  "Maturity_Type": "Open Ended",
  "Current_AUM": 78234.56,
  "Fund_Return_1Y": 22.3,
  "Benchmark_Return_1Y": 18.5,
  "Alpha_1Y": 3.8,
  "Fund_Return_3Y": 19.2,
  "Benchmark_Return_3Y": 16.7,
  "Alpha_3Y": 2.5,
  "Fund_Return_5Y": 21.4,
  "Benchmark_Return_5Y": 17.8,
  "Alpha_5Y": 3.6,
  "IR_1Y": 1.3,
  "IR_3Y": 1.5,
  "IR_5Y": 1.8,
  "Composite_Score": 0.87,
  "Rank_in_SubCategory": 2,
  "Percentile_in_SubCategory": 95.4,
  "Flag_Top_10_Percent": "Yes"
}
```

#### **Usage Examples**:

```javascript
// Get top 10 equity funds
const topEquity = funds
  .filter(f => f.Category === 'Equity' && f.Flag_Top_10_Percent === 'Yes')
  .sort((a, b) => b.Composite_Score - a.Composite_Score)
  .slice(0, 10);

// Find high-alpha performers (>3% Alpha 5Y)
const highAlpha = funds.filter(f => 
  f.Alpha_5Y !== null && f.Alpha_5Y > 3
);

// Category-wise aggregation
const byCategory = funds.reduce((acc, fund) => {
  if (!acc[fund.Category]) acc[fund.Category] = [];
  acc[fund.Category].push(fund);
  return acc;
}, {});

// Filter by AUM (liquid funds only, > 1000 Cr)
const liquidFunds = funds.filter(f => 
  f.Current_AUM > 1000 && f.Sub_Category === 'Liquid'
);
```

---

### 2.2 File: `etf-analytics.json` (ETFs & Index Funds)

**Description**: Passive fund analysis with tracking difference and benchmark matching.

**Array Size**: ~300-500 ETF/Index fund records  
**Update Frequency**: Daily  
**Use Cases**: Passive fund selection, tracking error analysis

#### **Schema**:

```typescript
interface ETFAnalytics {
  // IDENTIFICATION
  ETF_Name: string;                     // Full scheme name
  AMC: string;                          // AMC name
  Benchmark_Name: string;               // Index being tracked
  
  // AUM
  Fund_AUM: number;                     // AUM in Crores
  
  // RETURNS
  Fund_Return_1Y: number | null;        // 1-Year return %
  Benchmark_Return_1Y: number | null;   // Benchmark 1Y %
  Tracking_Diff_1Y: number | null;      // Fund - Benchmark (closer to 0 is better)
  
  Fund_Return_3Y: number | null;        // 3-Year CAGR %
  Benchmark_Return_3Y: number | null;   // Benchmark 3Y %
  Tracking_Diff_3Y: number | null;      // 3Y tracking difference
  
  // SCORING
  ETF_Score: number;                    // Score = 0.6 * trackingAccuracy + 0.4 * aumScore
                                        // Higher is better
  Rank_within_Benchmark: number;        // Rank among funds tracking same index
  Percentile_within_Benchmark: number;  // Percentile 0-100
}
```

#### **Example Record**:

```json
{
  "ETF_Name": "Nippon India ETF Nifty 50",
  "AMC": "Nippon India Mutual Fund",
  "Benchmark_Name": "Nifty 50 - TRI",
  "Fund_AUM": 4567.89,
  "Fund_Return_1Y": 18.2,
  "Benchmark_Return_1Y": 18.5,
  "Tracking_Diff_1Y": -0.3,
  "Fund_Return_3Y": 16.8,
  "Benchmark_Return_3Y": 17.1,
  "Tracking_Diff_3Y": -0.3,
  "ETF_Score": 0.92,
  "Rank_within_Benchmark": 1,
  "Percentile_within_Benchmark": 100
}
```

#### **Usage Examples**:

```javascript
// Get best Nifty 50 trackers
const nifty50 = etfs
  .filter(e => e.Benchmark_Name.includes('Nifty 50'))
  .sort((a, b) => b.ETF_Score - a.ETF_Score)
  .slice(0, 5);

// Find ETFs with low tracking error (<0.5%)
const lowTE = etfs.filter(e => 
  Math.abs(e.Tracking_Diff_3Y || 999) < 0.5
);

// Group by benchmark
const byBenchmark = etfs.reduce((acc, etf) => {
  if (!acc[etf.Benchmark_Name]) acc[etf.Benchmark_Name] = [];
  acc[etf.Benchmark_Name].push(etf);
  return acc;
}, {});
```

---

### 2.3 File: `industry-and-category-insights.json` (Market Overview)

**Description**: Aggregated statistics at Industry, Category, and Sub-Category levels.

**Array Size**: ~50-100 records  
**Update Frequency**: Daily  
**Use Cases**: Market dashboard, category comparison, trend analysis

#### **Schema**:

```typescript
interface CategoryInsights {
  // HIERARCHY
  Level: "Industry" | "Category" | "Sub-Category";
  Category_Name: string | null;        // e.g., "Equity", "Debt"
  Sub_Category_Name: string | null;    // e.g., "Large Cap", "Liquid"
  
  // STATISTICS
  Number_of_Schemes: number;           // Total funds in this category
  Total_AUM: number;                   // Sum of all AUM (Crores)
  Median_AUM: number | null;           // Median AUM
  
  // PERFORMANCE AVERAGES
  Avg_1Y_Return: number | null;        // Average 1Y return across all funds
  Avg_3Y_Return: number | null;        // Average 3Y return
  Avg_5Y_Return: number | null;        // Average 5Y return
  
  // BENCHMARK COMPARISON
  Avg_Benchmark_Return_3Y: number | null;  // Avg benchmark 3Y return
  Avg_Alpha_3Y: number | null;             // Avg alpha (fund - benchmark)
  Avg_IR_3Y: number | null;                // Avg Information Ratio
  
  // SUCCESS RATE
  Pct_Funds_Beating_Benchmark_3Y: number | null;  // % of funds with positive alpha
                                                   // (0-100 scale)
}
```

#### **Example Records**:

```json
[
  {
    "Level": "Industry",
    "Category_Name": null,
    "Sub_Category_Name": null,
    "Number_of_Schemes": 2143,
    "Total_AUM": 4567823.45,
    "Median_AUM": 342.56,
    "Avg_1Y_Return": 14.2,
    "Avg_3Y_Return": 12.8,
    "Avg_5Y_Return": 11.6,
    "Avg_Benchmark_Return_3Y": 12.1,
    "Avg_Alpha_3Y": 0.7,
    "Avg_IR_3Y": 0.45,
    "Pct_Funds_Beating_Benchmark_3Y": 52.3
  },
  {
    "Level": "Category",
    "Category_Name": "Equity",
    "Sub_Category_Name": null,
    "Number_of_Schemes": 876,
    "Total_AUM": 2345678.90,
    "Median_AUM": 567.89,
    "Avg_1Y_Return": 18.5,
    "Avg_3Y_Return": 16.2,
    "Avg_5Y_Return": 14.8,
    "Avg_Benchmark_Return_3Y": 15.7,
    "Avg_Alpha_3Y": 0.5,
    "Avg_IR_3Y": 0.38,
    "Pct_Funds_Beating_Benchmark_3Y": 48.2
  },
  {
    "Level": "Sub-Category",
    "Category_Name": "Equity",
    "Sub_Category_Name": "Large Cap",
    "Number_of_Schemes": 42,
    "Total_AUM": 123456.78,
    "Median_AUM": 2345.67,
    "Avg_1Y_Return": 16.8,
    "Avg_3Y_Return": 14.5,
    "Avg_5Y_Return": 13.2,
    "Avg_Benchmark_Return_3Y": 14.8,
    "Avg_Alpha_3Y": -0.3,
    "Avg_IR_3Y": 0.12,
    "Pct_Funds_Beating_Benchmark_3Y": 35.7
  }
]
```

#### **Usage Examples**:

```javascript
// Get industry-wide metrics
const industryMetrics = insights.find(i => i.Level === 'Industry');

// Category comparison
const categories = insights
  .filter(i => i.Level === 'Category')
  .sort((a, b) => b.Avg_Alpha_3Y - a.Avg_Alpha_3Y);

// Find best-performing sub-categories
const bestSubs = insights
  .filter(i => i.Level === 'Sub-Category')
  .filter(i => i.Pct_Funds_Beating_Benchmark_3Y > 50)
  .sort((a, b) => b.Avg_Alpha_3Y - a.Avg_Alpha_3Y);

// Dashboard stats
const equityInsights = insights.find(i => 
  i.Level === 'Category' && i.Category_Name === 'Equity'
);
```

---

### 2.4 File: `manifest.json` (Metadata)

**Description**: Pipeline metadata and data freshness indicator.

#### **Schema**:

```typescript
interface Manifest {
  dateTag: string;         // "2026-02-07" (YYYY-MM-DD)
  reportDate: string;      // "07-Feb-2026" (DD-MMM-YYYY)
  counts: {
    raw: number;           // Total raw records fetched
    insights: number;      // Number of insight records
    funds: number;         // Number of active funds
    etfs: number;          // Number of ETFs
  }
}
```

#### **Example**:

```json
{
  "dateTag": "2026-02-07",
  "reportDate": "07-Feb-2026",
  "counts": {
    "raw": 8234,
    "insights": 87,
    "funds": 2143,
    "etfs": 456
  }
}
```

#### **Usage**:

```javascript
// Display data freshness
const manifest = await fetchManifest();
document.getElementById('last-updated').textContent = 
  `Data as of ${manifest.reportDate} (${manifest.counts.funds} funds analyzed)`;

// Validation check
if (funds.length !== manifest.counts.funds) {
  console.warn('Data mismatch detected!');
}
```

---

## 🎨 SECTION 3: BUILDING A UI LIKE THE REFERENCE SAMPLE

### 3.1 Reference Architecture Analysis

The provided sample (`Googlescript UI sample`) demonstrates a sophisticated mutual fund screener with:

1. **Multi-Tab Navigation**: Index Analysis, Passive Funds, Active Funds, Admin
2. **Active Funds Module** (Most Complex):
   - Overview with category performance heatmap
   - Category Lab for deep analysis
   - Advanced Screener with multi-criteria filtering
   - Fund Dossier (detailed fund page)
   - AMC View (fund house analysis)
   - My Shortlist (user favorites)
3. **Visual Design**: Glass morphism, gradient cards, responsive layout
4. **Data Processing**: Client-side filtering, sorting, scoring

### 3.2 Tech Stack Recommendations

#### **Option A: Modern React/Next.js Stack** (Recommended)

```bash
# Tech Stack
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui
- State: Zustand or React Context
- Tables: TanStack Table (React Table v8)
- Charts: Recharts or Chart.js
- Icons: Lucide React
```

####**Option B: Vue.js Stack**

```bash
- Framework: Nuxt 3
- Styling: Tailwind CSS + Headless UI
- State: Pinia
- Tables: TanStack Table Vue
```

#### **Option C: Vanilla JS (Like Sample)**

```bash
- Framework: None (plain HTML/CSS/JS)
- Styling: Bootstrap 5 + Custom CSS
- Tables: DataTables.js
- jQuery for DOM manipulation
```

### 3.3 Core Components to Build

#### **Component 1: Data Fetcher (Service Layer)**

```typescript
// services/fundData.ts
const API_BASE = 'https://your-pages.dev/api';

export class FundDataService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTime = 5 * 60 * 1000; // 5 minutes

  async getFunds(): Promise<FundAnalytics[]> {
    return this.getCached('funds', () =>
      fetch(`${API_BASE}/funds`).then(r => r.json())
    );
  }

  async getETFs(): Promise<ETFAnalytics[]> {
    return this.getCached('etfs', () =>
      fetch(`${API_BASE}/etfs`).then(r => r.json())
    );
  }

  async getInsights(): Promise<CategoryInsights[]> {
    return this.getCached('insights', () =>
      fetch(`${API_BASE}/insights`).then(r => r.json())
    );
  }

  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTime) {
      return cached.data;
    }
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

#### **Component 2: Fund Screener (React Example)**

```tsx
// components/FundScreener.tsx
import { useState, useMemo } from 'react';
import { FundAnalytics } from '@/types';

interface Filters {
  category: string;
  minAlpha3Y: number | null;
  minReliability: number | null;
  topPerformersOnly: boolean;
}

export function FundScreener({ funds }: { funds: FundAnalytics[] }) {
  const [filters, setFilters] = useState<Filters>({
    category: 'ALL',
    minAlpha3Y: null,
    minReliability: null,
    topPerformersOnly: false,
  });

  const filtered = useMemo(() => {
    return funds.filter(fund => {
      if (filters.category !== 'ALL' && fund.Category !== filters.category) return false;
      if (filters.minAlpha3Y !== null && (fund.Alpha_3Y || 0) < filters.minAlpha3Y) return false;
      if (filters.topPerformersOnly && fund.Flag_Top_10_Percent !== 'Yes') return false;
      return true;
    }).sort((a, b) => b.Composite_Score - a.Composite_Score);
  }, [funds, filters]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="px-4 py-2 border rounded"
        >
          <option value="ALL">All Categories</option>
          <option value="Equity">Equity</option>
          <option value="Debt">Debt</option>
          <option value="Hybrid">Hybrid</option>
        </select>

        <input
          type="number"
          placeholder="Min Alpha 3Y (%)"
          onChange={(e) => setFilters({ ...filters, minAlpha3Y: parseFloat(e.target.value) || null })}
          className="px-4 py-2 border rounded"
        />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.topPerformersOnly}
            onChange={(e) => setFilters({ ...filters, topPerformersOnly: e.target.checked })}
          />
          Top 10% Only
        </label>
      </div>

      {/* Results */}
      <div className="text-sm text-gray-600">{filtered.length} funds found</div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Fund Name</th>
            <th className="p-2 text-right">AUM (Cr)</th>
            <th className="p-2 text-right">Alpha 3Y</th>
            <th className="p-2 text-right">IR 3Y</th>
            <th className="p-2 text-right">Score</th>
            <th className="p-2 text-right">Rank</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((fund, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50 cursor-pointer">
              <td className="p-2">{fund.Fund_Name}</td>
              <td className="p-2 text-right font-mono">{fund.Current_AUM.toFixed(2)}</td>
              <td className={`p-2 text-right font-mono ${fund.Alpha_3Y && fund.Alpha_3Y > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fund.Alpha_3Y?.toFixed(2) || '-'}%
              </td>
              <td className="p-2 text-right font-mono">{fund.IR_3Y?.toFixed(2) || '-'}</td>
              <td className="p-2 text-right font-mono font-bold">{fund.Composite_Score.toFixed(3)}</td>
              <td className="p-2 text-right">{fund.Rank_in_SubCategory}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### **Component 3: Category Dashboard**

```tsx
// components/CategoryDashboard.tsx
import { CategoryInsights } from '@/types';

export function CategoryDashboard({ insights }: { insights: CategoryInsights[] }) {
  const categories = insights.filter(i => i.Level === 'Category');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {categories.map((cat, idx) => (
        <div key={idx} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold mb-4">{cat.Category_Name}</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Funds:</span>
              <span className="font-bold">{cat.Number_of_Schemes}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Total AUM:</span>
              <span className="font-bold">₹{(cat.Total_AUM / 1000).toFixed(0)}k Cr</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Avg 3Y Return:</span>
              <span className="font-bold text-blue-600">
                {cat.Avg_3Y_Return?.toFixed(2)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Alpha 3Y:</span>
              <span className={`font-bold ${cat.Avg_Alpha_3Y && cat.Avg_Alpha_3Y > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {cat.Avg_Alpha_3Y?.toFixed(2)}%
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-bold">
                {cat.Pct_Funds_Beating_Benchmark_3Y?.toFixed(1)}%
              </span>
            </div>
          </div>
          
          {/* Visual indicator */}
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500"
              style={{ width: `${cat.Pct_Funds_Beating_Benchmark_3Y}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### **Component 4: Fund Detail Modal**

```tsx
// components/FundDetailModal.tsx
import { FundAnalytics } from '@/types';

export function FundDetailModal({ fund, onClose }: { fund: FundAnalytics; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">{fund.Fund_Name}</h2>
              <p className="text-blue-100">{fund.AMC} | {fund.Category} | {fund.Sub_Category}</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="AUM" value={`₹${fund.Current_AUM.toFixed(0)} Cr`} />
            <MetricCard label="Composite Score" value={fund.Composite_Score.toFixed(3)} highlight />
            <MetricCard label="Rank" value={`#${fund.Rank_in_SubCategory}`} />
            <MetricCard label="Percentile" value={`${fund.Percentile_in_SubCategory.toFixed(1)}%`} />
          </div>

          {/* Performance Table */}
          <div>
            <h3 className="text-lg font-bold mb-3">Performance vs Benchmark</h3>
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Period</th>
                  <th className="p-2 border text-right">Fund Return</th>
                  <th className="p-2 border text-right">Benchmark</th>
                  <th className="p-2 border text-right">Alpha</th>
                  <th className="p-2 border text-right">IR</th>
                </tr>
              </thead>
              <tbody>
                <PerformanceRow period="1Y" fund={fund} />
                <PerformanceRow period="3Y" fund={fund} />
                <PerformanceRow period="5Y" fund={fund} />
              </tbody>
            </table>
          </div>

          {/* Benchmark Info */}
          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-bold mb-2">Benchmark</h4>
            <p className="text-sm text-gray-700">{fund.Benchmark_Name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight = false }: any) {
  return (
    <div className={`p-4 rounded border ${highlight ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'}`}>
      <div className="text-xs text-gray-600 uppercase mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function PerformanceRow({ period, fund }: { period: string; fund: FundAnalytics }) {
  const fundKey = `Fund_Return_${period}` as keyof FundAnalytics;
  const benchKey = `Benchmark_Return_${period}` as keyof FundAnalytics;
  const alphaKey = `Alpha_${period}` as keyof FundAnalytics;
  const irKey = `IR_${period}` as keyof FundAnalytics;

  const fundReturn = fund[fundKey] as number | null;
  const benchReturn = fund[benchKey] as number | null;
  const alpha = fund[alphaKey] as number | null;
  const ir = fund[irKey] as number | null;

  return (
    <tr className="border-b">
      <td className="p-2 border font-bold">{period}</td>
      <td className="p-2 border text-right font-mono">{fundReturn?.toFixed(2) || '-'}%</td>
      <td className="p-2 border text-right font-mono">{benchReturn?.toFixed(2) || '-'}%</td>
      <td className={`p-2 border text-right font-mono font-bold ${alpha && alpha > 0 ? 'text-green-600' : 'text-red-600'}`}>
        {alpha?.toFixed(2) || '-'}%
      </td>
      <td className="p-2 border text-right font-mono">{ir?.toFixed(2) || '-'}</td>
    </tr>
  );
}
```

### 3.4 Full Application Structure

```
your-ui-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home/Dashboard
│   ├── funds/
│   │   ├── page.tsx            # Fund screener
│   │   └── [id]/page.tsx       # Fund detail page
│   ├── categories/
│   │   └── page.tsx            # Category analysis
│   └── api/
│       └── proxy/[...path].ts  # API proxy (optional)
│
├── components/
│   ├── FundScreener.tsx
│   ├── CategoryDashboard.tsx
│   ├── FundDetailModal.tsx
│   ├── FundCard.tsx
│   ├── InsightsChart.tsx
│   └── NavBar.tsx
│
├── services/
│   └── fundData.ts             # Data fetching service
│
├── types/
│   └── index.ts                # TypeScript interfaces
│
├── lib/
│   ├── utils.ts                # Helper functions
│   └── filters.ts              # Filtering logic
│
└── hooks/
    ├── useFunds.ts             # React hook for funds data
    └── useFilters.ts           # React hook for filter state
```

### 3.5 Key Features to Implement

1. **Multi-Criteria Filtering**
   - Category, Sub-Category, AMC
   - Alpha thresholds (1Y, 3Y, 5Y)
   - IR thresholds
   - AUM range
   - Top performers flag

2. **Sorting Capabilities**
   - Sort by: Score, Alpha, IR, AUM, Rank
   - Ascending/Descending

3. **Search Functionality**
   - Fuzzy search across fund names
   - AMC search

4. **User Preferences**
   - Shortlist/favorites (localStorage)
   - Recent views
   - Custom filters

5. **Visualizations**
   - Category performance bar charts
   - Alpha distribution histograms
   - Benchmark comparison charts

6. **Export Features**
   - Export filtered results to CSV
   - PDF report generation

7. **Responsive Design**
   - Mobile-friendly tables (cards on mobile)
   - Touch-friendly filters

### 3.6 Sample Prompt for AI Assistant

---

**Start of AI Prompt Template**

```
I'm building a mutual fund screener UI using the Nivesify Data Pipeline. Here's what I need help with:

CONTEXT:
- Data Source: Cloudflare R2 bucket via API endpoint at https://my-domain.pages.dev/api/funds
- Data Structure: See SECTION 2 above (fund-analytics.json schema)
- Reference Design: See attached "Googlescript UI sample" file for visual inspiration

REQUIREMENTS:
1. Tech Stack: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
2. Core Features:
   - Fund screener with filters (category, alpha, IR, top performers)
   - Category dashboard showing aggregate metrics
   - Individual fund detail pages
   - Search and sort functionality
   - User shortlist (localStorage)

3. Data Fetching:
   - Fetch from /api/funds endpoint
   - Client-side caching (5 minutes)
   - Loading states and error handling

4. UI Components Needed:
   - FundScreener (table with filters)
   - CategoryDashboard (cards showing category metrics)
   - FundDetailModal (detailed fund information)
   - NavBar with tabs (like the reference sample)

5. Key Calculations:
   - Filter funds by Alpha_3Y > X
   - Sort by Composite_Score
   - Group by Category/Sub_Category
   - Calculate category averages

SPECIFIC TASK:
[Describe your specific task here, e.g., "Create the FundScreener component with filters for Category, Min Alpha 3Y, and Top 10% flag. Use TanStack Table for the data table."]

DATA SAMPLE:
[Paste 2-3 sample fund records from fund-analytics.json]

EXPECTED OUTPUT:
- Clean, production-ready TypeScript code
- Proper error handling
- Responsive design
- Comments explaining key logic

Please provide the complete implementation with explanations.
```

**End of AI Prompt Template**

---

### 3.7 Progressive Enhancement Roadmap

**Phase 1: MVP (Week 1)**
- Data fetching setup
- Basic fund table with search
- Category filter only
- Simple styling

**Phase 2: Core Features (Week 2)**
- Advanced filters (alpha, IR, AUM)
- Sorting functionality
- Fund detail modal
- Responsive design

**Phase 3: Analytics (Week 3)**
- Category dashboard
- Charts and visualizations
- Insights page
- Export functionality

**Phase 4: User Features (Week 4)**
- Shortlist/favorites
- Comparison tool
- Historical data view
- Custom alerts

### 3.8 Testing Checklist

- [ ] Data loads successfully from API
- [ ] Filters work correctly
- [ ] Sorting is accurate
- [ ] Search returns relevant results
- [ ] Modal opens/closes properly
- [ ] Mobile responsive
- [ ] Loading states visible
- [ ] Error states handled
- [ ] Performance (< 3s load time)
- [ ] Cross-browser compatibility

---

## 📝 SUMMARY CHECKLIST

When working with an AI assistant to build the UI, provide:

### ✅ Connection Info
- [ ] R2 bucket public URL or API endpoint
- [ ] CORS configuration (if needed)
- [ ] Caching strategy

### ✅ Data Structure
- [ ] Link to this document (Section 2)
- [ ] Sample JSON records
- [ ] Data update frequency

### ✅ Design Reference
- [ ] Link to reference UI sample
- [ ] Design system (colors, fonts, spacing)
- [ ] Target devices (desktop/mobile priorities)

### ✅ Tech Stack
- [ ] Framework choice (React, Vue, vanilla)
- [ ] Component library (shadcn, MUI, Bootstrap)
- [ ] State management approach

### ✅ Feature Priorities
- [ ] Must-have features list
- [ ] Nice-to-have features
- [ ] Phase-wise roadmap

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Maintained By**: Nivesify Team

For questions or clarification, refer to the main README.md in the repository.
