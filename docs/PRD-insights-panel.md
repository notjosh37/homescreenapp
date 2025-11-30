# Product Requirements Document: Insights Panel

**Version:** 1.0
**Date:** 2024-11-27
**Status:** Draft

---

## 1. Overview

### 1.1 Summary

Add an "Insights Panel" section to the existing homescreenapp that displays aggregated market intelligence from multiple external sources. The panel integrates with an n8n backend that orchestrates data collection, normalization, scoring, and report generation, with all data stored in and retrieved from Notion.

### 1.2 Problem Statement

Market intelligence is scattered across multiple feeds and tools (Hacker News, PitchBook, LinkedIn, RSS feeds, etc.). Manual collection is slow, inconsistent, and makes it difficult to identify high-signal items. Users need a single consolidated view of relevant insights with lightweight scoring and thematic grouping.

### 1.3 Goals

- Display high-signal insights from multiple sources in a single panel within the homescreen app
- Support daily digest view and on-demand refresh
- Enable filtering by theme, source, company, and date
- Provide quick access to original sources (HN, PitchBook, RSS, LinkedIn)
- Integrate with n8n-powered backend for data orchestration
- Leverage existing Notion integration pattern for data storage/retrieval

### 1.4 Non-Goals

- Full enterprise ETL implementation
- Realtime stream processing
- Building the n8n workflows (separate effort)
- Native mobile app support

---

## 2. Target Users & Use Cases

### 2.1 Primary User

Founder/operator performing daily thesis tracking and opportunity scanning.

### 2.2 Use Cases

| Use Case | Description |
|----------|-------------|
| Daily Digest | View curated insights report at morning check-in (08:15 local) |
| Ad-hoc Refresh | Trigger manual refresh to see latest items on demand |
| Filtered Browse | Filter insights by theme, source, company, or date range |
| Deep Dive | Click through to original source (HN thread, PitchBook profile, article) |
| Report View | Read LLM-generated daily summary with highlights, raises, and sector watch |

---

## 3. Data Architecture

### 3.1 Data Flow

```
[External Sources] -> [n8n Collectors] -> [Normalizer] -> [Notion DB] <- [Frontend]
                                                              |
                                                    [LLM Report Generator]
                                                              |
                                                    [Notion Reports Page]
```

### 3.2 Notion Data Model

#### Raw Insights Table (existing structure from n8n)

| Property | Type | Description |
|----------|------|-------------|
| Title | title | Item headline/title |
| Source | select | LinkedIn, PitchBook, HN, RSS, News, ProductHunt |
| URL | url | Link to original item |
| Date | date | Publication/discovery date |
| Summary | text | Brief description or excerpt |
| Theme | multi_select | Sector/theme tags (AI, Fintech, Climate, etc.) |
| Score | number | Computed relevance score (0-10) |
| Company | text | Associated company name if applicable |
| Hash | text | Content hash for deduplication |
| Notes | text | Additional context or annotations |

#### Reports Pages

| Property | Type | Description |
|----------|------|-------------|
| Title | title | Format: "YYYY-MM-DD Insights" |
| Date | date | Report date |
| Body | rich_text | Markdown sections (Highlights, New Raises, Sector Watch, Top HN) |

### 3.3 Scoring Logic (Reference)

Score calculation performed by n8n normalizer:

- **Source weights:** PitchBook (3), HN (2), LinkedIn (1.5), RSS/News (1.5)
- **Recency decay:** Same-day (+2), Yesterday (+1)
- **Keyword boost:** Thesis keywords (+1 per hit, max +3)
- **HN score boost:** Points >= 100 (+2), >= 50 (+1)
- **Report threshold:** Score >= 3

---

## 4. Frontend Requirements

### 4.1 New Component: InsightsPanel

Add a new section to the homescreen layout between Todo and News sections.

#### 4.1.1 Component Structure

```
InsightsPanel
  |-- InsightsHeader
  |     |-- Title ("Insights")
  |     |-- NotionBadge (if connected)
  |     |-- RefreshButton
  |     |-- ViewToggle (List | Report)
  |
  |-- InsightsFilters
  |     |-- SourceFilter (multi-select)
  |     |-- ThemeFilter (multi-select)
  |     |-- DateRangeFilter (Today | This Week | Custom)
  |     |-- ScoreThreshold (slider: 0-10)
  |     |-- ClearFiltersButton
  |
  |-- InsightsList (when view = List)
  |     |-- InsightCard (repeated)
  |           |-- SourceIcon
  |           |-- Title (clickable -> URL)
  |           |-- Summary (truncated)
  |           |-- Theme tags
  |           |-- Score badge
  |           |-- Company tag (if present)
  |           |-- Timestamp
  |
  |-- InsightsReport (when view = Report)
  |     |-- ReportDate selector
  |     |-- MarkdownRenderer (report body)
  |
  |-- LoadingState
  |-- EmptyState
  |-- ErrorState
```

#### 4.1.2 Visual Design

- Match existing app styling (Domine font, color scheme, glass-morphism cards)
- Source icons: Use simple letter abbreviations (HN, PB, LI, RSS, PH, News)
- Score displayed as colored badge (red < 3, yellow 3-5, green > 5)
- Theme tags as small pills with consistent colors per theme
- Compact card design to show 5-8 items without scrolling

### 4.2 TypeScript Interfaces

```typescript
interface InsightItem {
  id: string
  notionPageId: string
  title: string
  source: 'LinkedIn' | 'PitchBook' | 'HN' | 'RSS' | 'News' | 'ProductHunt'
  url: string
  date: string // ISO date
  summary: string
  themes: string[]
  score: number
  company?: string
  hash: string
  notes?: string
}

interface InsightsReport {
  id: string
  notionPageId: string
  title: string
  date: string
  body: string // Markdown content
}

interface InsightsFilters {
  sources: string[]
  themes: string[]
  dateRange: 'today' | 'week' | 'custom'
  customDateStart?: string
  customDateEnd?: string
  minScore: number
}

interface InsightsSettings {
  databaseId: string // Raw Insights database
  reportsDatabaseId: string // Reports pages parent
  enabled: boolean
  defaultView: 'list' | 'report'
  autoRefresh: boolean
  refreshInterval: number // minutes
}
```

### 4.3 State Management

Add to existing App state:

```typescript
const [insights, setInsights] = useState<InsightItem[]>([])
const [insightsReport, setInsightsReport] = useState<InsightsReport | null>(null)
const [insightsLoading, setInsightsLoading] = useState(false)
const [insightsError, setInsightsError] = useState<string | null>(null)
const [insightsView, setInsightsView] = useState<'list' | 'report'>('list')
const [insightsFilters, setInsightsFilters] = useState<InsightsFilters>(defaultInsightsFilters)
const [insightsSettings, setInsightsSettings] = useState<InsightsSettings>(() =>
  getFromStorage('insightsSettings', defaultInsightsSettings)
)
```

### 4.4 API Integration

#### 4.4.1 Fetch Insights (List View)

Reuse existing Notion API proxy pattern:

```typescript
const fetchInsights = async () => {
  // Query Raw Insights database with filters
  // POST /api/notion/v1/databases/{databaseId}/query
  // Apply filter conditions based on insightsFilters state
  // Sort by Score descending, then Date descending
}
```

#### 4.4.2 Fetch Report (Report View)

```typescript
const fetchInsightsReport = async (date?: string) => {
  // Query Reports database for page with matching date
  // GET page content blocks for markdown body
  // Parse and render markdown
}
```

#### 4.4.3 Trigger Refresh (n8n Webhook)

```typescript
const triggerInsightsRefresh = async () => {
  // POST to n8n webhook endpoint
  // Requires shared secret header for auth
  // Show loading state while n8n processes
  // Poll or wait for completion, then refetch
}
```

### 4.5 Settings Panel Additions

Add new section to existing SettingsPage:

```
Insights Panel Settings
-----------------------
[ ] Enabled
Database ID: [____________]
Reports Database ID: [____________]
Default View: [List v] / [Report]
[ ] Auto-refresh
Refresh Interval: [30] minutes
n8n Webhook URL: [____________]
n8n Webhook Secret: [____________]
```

---

## 5. User Interactions

### 5.1 Viewing Insights

1. User sees "Insights" section on homescreen
2. Default view shows list of recent high-scoring items
3. Each card shows source icon, title, summary preview, score, themes
4. Click card title opens original URL in new tab
5. Toggle to "Report" view shows daily digest markdown

### 5.2 Filtering

1. Click filter dropdowns to select sources/themes
2. Adjust date range (Today, This Week, or custom picker)
3. Slide score threshold to filter minimum score
4. Active filters shown as pills with (x) to remove
5. "Clear Filters" resets all

### 5.3 Refreshing

1. Click Refresh button to fetch latest from Notion
2. Long-press or Shift+Click triggers n8n webhook for full pipeline refresh
3. Loading spinner shown during fetch
4. Error toast if refresh fails

### 5.4 Report Navigation

1. In Report view, date picker shows available report dates
2. Navigate between daily reports
3. Report renders as formatted markdown with section headers
4. Links in report are clickable

---

## 6. Technical Implementation

### 6.1 File Changes

| File | Changes |
|------|---------|
| `src/App.tsx` | Add InsightsPanel component, state, settings |
| `src/App.css` | Add insights panel styles |
| `src/components/InsightsPanel.tsx` | New component (optional extraction) |
| `vite.config.ts` | Add proxy for n8n webhook if needed |

### 6.2 Notion Query Examples

#### Fetch Recent Insights

```json
{
  "filter": {
    "and": [
      {
        "property": "Date",
        "date": {
          "on_or_after": "2024-11-26"
        }
      },
      {
        "property": "Score",
        "number": {
          "greater_than_or_equal_to": 3
        }
      }
    ]
  },
  "sorts": [
    { "property": "Score", "direction": "descending" },
    { "property": "Date", "direction": "descending" }
  ],
  "page_size": 50
}
```

#### Fetch by Source

```json
{
  "filter": {
    "property": "Source",
    "select": {
      "equals": "HN"
    }
  }
}
```

### 6.3 n8n Webhook Integration

```typescript
const N8N_WEBHOOK_URL = insightsSettings.webhookUrl
const N8N_WEBHOOK_SECRET = insightsSettings.webhookSecret

const triggerN8nRefresh = async () => {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': N8N_WEBHOOK_SECRET
    },
    body: JSON.stringify({
      action: 'refresh',
      timestamp: Date.now()
    })
  })
  return response.ok
}
```

### 6.4 Markdown Rendering

Use simple markdown-to-HTML conversion for report body:
- Headers (##, ###)
- Bold, italic
- Bulleted lists
- Links
- Code blocks (optional)

Consider using a lightweight library like `marked` or implement basic regex parsing.

---

## 7. Rollout Plan

### Phase 1: Core List View
- InsightsPanel component with list view
- Notion integration for Raw Insights database
- Basic filtering (source, date)
- Manual refresh

### Phase 2: Report View
- Report view toggle
- Fetch and render daily reports from Notion
- Date navigation for historical reports

### Phase 3: Advanced Filtering
- Theme filtering with dynamic options from data
- Score threshold slider
- Company filter/search
- Saved filter presets

### Phase 4: n8n Integration
- Webhook trigger for manual refresh
- Auto-refresh on configurable interval
- Status indicator for n8n pipeline health

### Phase 5: Polish
- Loading skeletons
- Error handling and retry
- Keyboard navigation
- URL deep-linking to filtered views

---

## 8. Open Questions

1. **Notion Database Structure:** Should insights and reports share a database or stay separate?
   - Recommendation: Keep separate for cleaner queries

2. **n8n Webhook Security:** How to handle webhook secret in frontend?
   - Option A: Proxy through backend/serverless function
   - Option B: Store in localStorage (less secure, acceptable for personal use)

3. **Markdown Library:** Add dependency or implement basic parsing?
   - Recommendation: Use `marked` (small footprint, well-tested)

4. **Report Caching:** Cache reports locally or always fetch fresh?
   - Recommendation: Cache with 1-hour TTL, manual override

5. **Theme Taxonomy:** Fixed list or dynamic from Notion multi-select?
   - Recommendation: Dynamic, fetched from database schema

---

## 9. Success Metrics

- Daily active usage of Insights panel
- Average time spent reviewing insights
- Click-through rate to original sources
- Report view engagement
- Refresh frequency (manual vs auto)

---

## 10. Dependencies

### External
- n8n instance (cloud or self-hosted) with configured workflows
- Notion workspace with Raw Insights and Reports databases
- Data source APIs (HN Firebase, RSS feeds, PitchBook, LinkedIn)

### Internal
- Existing Notion API proxy in vite.config.ts
- Existing shader/styling framework
- Existing localStorage patterns

---

## Appendix A: Source Reference for n8n PRD

This PRD is the frontend companion to the n8n-enabled Insights Panel backend specification. The backend handles:
- Scheduled and on-demand collection from sources
- Normalization, deduplication, and scoring
- LLM-powered report generation
- Notion database population

See separate n8n workflow documentation for backend implementation details.

---

## Appendix B: Mockup Layout

```
+------------------------------------------+
|  9:30 am                                 |
|  Wednesday, November 27                  |
+------------------------------------------+
|                                          |
|  Shortcuts                               |
|  [G] [GH] [YT] [+ Add]                   |
|                                          |
+------------------------------------------+
|                                          |
|  Todo [Notion]              [Filter] [^] |
|  [ ] Task input...              [Add]    |
|  [ ] Task 1                              |
|  [x] Task 2 (completed)                  |
|                              [Refresh]   |
|                                          |
+------------------------------------------+
|                                          |
|  Insights [Notion]    [List|Report] [R]  |
|  Source: [All v] Theme: [All v]          |
|  Date: [Today v] Score: [3+----]         |
|                                          |
|  +------------------------------------+  |
|  | [HN] AI startup raises $50M...    |  |
|  | Score: 7 | AI, Fintech | 2h ago   |  |
|  +------------------------------------+  |
|  | [PB] Series B: Climate Co        |  |
|  | Score: 6 | Climate | Today        |  |
|  +------------------------------------+  |
|  | [RSS] New framework released...   |  |
|  | Score: 5 | Dev Tools | 4h ago     |  |
|  +------------------------------------+  |
|                              [Refresh]   |
|                                          |
+------------------------------------------+
|                                          |
|  News                                    |
|  - HN story 1...                         |
|  - HN story 2...                         |
|                              [Refresh]   |
|                                          |
+------------------------------------------+
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-11-27 | - | Initial draft |
