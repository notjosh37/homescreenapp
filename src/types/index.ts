// ============================================
// SHORTCUT TYPES
// ============================================

export interface Shortcut {
  id: number
  name: string
  type: 'link' | 'app' | 'file' | 'command'
  url: string
  icon: string
}

// ============================================
// TODO TYPES (Notion Integration)
// ============================================

export interface Todo {
  id: string
  text: string
  completed: boolean
  notionPageId?: string
  dueDate?: string
}

// ============================================
// FEED TYPES
// ============================================

// Extended to include new sources
export type FeedSource =
  | 'all'
  | 'hn'
  | 'github'
  | 'yc'
  | 'arxiv'
  | 'rss'
  | 'news'
  | 'pitchbook'
  | 'linkedin'
  | 'report'
  | 'starred'

export interface FeedItem {
  id: string
  /** Database UUID (for Supabase operations) */
  dbId?: string
  source: FeedSource
  title: string
  url: string
  date: string
  score?: number
  comments?: number
  relevanceScore?: number
  themes?: string[]
  company?: string
  summary?: string
  author?: string
  isStarred?: boolean
  metadata?: Record<string, unknown>
}

export interface FeedFilters {
  sources?: FeedSource[]
  dateFrom?: string
  dateTo?: string
  dateRange?: 'today' | 'week' | 'month' | 'all' | 'custom'
  themes?: string[]
  minScore?: number
  searchQuery?: string
  starredOnly?: boolean
  limit?: number
}

export interface FeedSettings {
  insightsDatabaseId: string
  reportsDatabaseId: string
  n8nWebhookUrl: string
  n8nWebhookSecret: string
  newsApiKey: string
  openaiApiKey: string
  enabled: boolean
}

// ============================================
// NEWS TYPES (Legacy - for backward compatibility)
// ============================================

export interface NewsItem {
  id: number
  title: string
  url: string
  score: number
  descendants: number
  time: number
}

// ============================================
// REPORT TYPES
// ============================================

export interface Report {
  id: string
  title: string
  date: string
  body: string
  templateName?: string
  reportType?: 'daily' | 'weekly' | 'research' | 'custom'
}

export interface ReportTemplate {
  id: string
  name: string
  prompt: string
  sources: FeedSource[]
  useSearch?: boolean
  searchQuery?: string
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface SectionVisibility {
  shortcuts: boolean
  todo: boolean
  feed: boolean
}

export interface ShaderSettings {
  swirlColorA: string
  swirlColorB: string
  swirlSpeed: number
  swirlDetail: number
  swirlBlend: number
  swirlOpacity: number
  chromaBaseColor: string
  chromaUpColor: string
  chromaDownColor: string
  chromaLeftColor: string
  chromaRightColor: string
  chromaIntensity: number
  chromaRadius: number
  chromaMomentum: number
  backgroundColor: string
  accentColor: string
  textColor: string
  contentBackdropOpacity: number
  showDividers: boolean
  unsplashEnabled: boolean
  unsplashApiKey: string
  unsplashQuery: string
  unsplashUrl: string
  savedBackgrounds: string[]
  greeting: string
}

export interface NotionFilter {
  property: string
  value: string
}

export interface NotionSettings {
  apiKey: string
  databaseId: string
  enabled: boolean
  sortBy: string
  sortDirection: 'ascending' | 'descending'
  filters: NotionFilter[]
}

// ============================================
// SUPABASE TYPES (Database Row Types)
// ============================================

export interface DbArticle {
  id: string
  source_id: string | null
  source_type: string
  external_id: string | null
  title: string
  url: string | null
  published_at: string | null
  score: number
  comments_count: number
  relevance_score: number
  author: string | null
  summary: string | null
  content: string | null
  themes: string[]
  company: string | null
  metadata: Record<string, unknown>
  embedding: number[] | null
  is_starred: boolean
  is_read: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface DbRepository {
  id: string
  github_id: number | null
  full_name: string | null
  name: string
  description: string | null
  url: string | null
  stars: number
  forks: number
  watchers: number
  open_issues: number
  language: string | null
  topics: string[]
  stars_today: number
  stars_week: number
  trending_rank: number | null
  embedding: number[] | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DbCompany {
  id: string
  name: string
  slug: string | null
  tagline: string | null
  description: string | null
  website: string | null
  yc_batch: string | null
  yc_url: string | null
  industry: string | null
  tags: string[]
  status: string
  embedding: number[] | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DbPaper {
  id: string
  arxiv_id: string | null
  title: string
  abstract: string | null
  authors: string[]
  categories: string[]
  primary_category: string | null
  arxiv_url: string | null
  pdf_url: string | null
  submitted_at: string | null
  updated_at_arxiv: string | null
  relevance_score: number
  themes: string[]
  embedding: number[] | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface DbReport {
  id: string
  title: string
  body: string
  summary: string | null
  template_id: string | null
  template_name: string | null
  source_article_ids: string[]
  sources_metadata: Record<string, unknown>
  report_type: string
  themes: string[]
  report_date: string
  created_at: string
  updated_at: string
}

export interface DbSource {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  enabled: boolean
  fetch_interval_minutes: number
  last_fetched_at: string | null
  created_at: string
}

// ============================================
// UTILITY TYPES
// ============================================

// Map database article to FeedItem
export function dbArticleToFeedItem(article: DbArticle): FeedItem {
  return {
    id: article.id,
    dbId: article.id,
    source: article.source_type as FeedSource,
    title: article.title,
    url: article.url || '',
    date: article.published_at || article.created_at,
    score: article.score || undefined,
    comments: article.comments_count || undefined,
    relevanceScore: article.relevance_score || undefined,
    themes: article.themes,
    company: article.company || undefined,
    summary: article.summary || undefined,
    author: article.author || undefined,
    isStarred: article.is_starred,
    metadata: article.metadata,
  }
}

// ============================================
// DEFAULT VALUES
// ============================================

export const defaultShaderSettings: ShaderSettings = {
  swirlColorA: '#000000',
  swirlColorB: '#54190d',
  swirlSpeed: 1.5,
  swirlDetail: 2.6,
  swirlBlend: 63,
  swirlOpacity: 0.75,
  chromaBaseColor: '#b55a42',
  chromaUpColor: '#b55a42',
  chromaDownColor: '#000000',
  chromaLeftColor: '#e32400',
  chromaRightColor: '#ff6a00',
  chromaIntensity: 3.1,
  chromaRadius: 1.1,
  chromaMomentum: 13,
  backgroundColor: '#831100',
  accentColor: '#b55a42',
  textColor: '#ffffff',
  contentBackdropOpacity: 0,
  showDividers: true,
  unsplashEnabled: false,
  unsplashApiKey: '',
  unsplashQuery: 'nature dark',
  unsplashUrl: '',
  savedBackgrounds: [],
  greeting: 'Hello Josh',
}

export const defaultNotionSettings: NotionSettings = {
  apiKey: '',
  databaseId: '',
  enabled: false,
  sortBy: 'Date',
  sortDirection: 'ascending',
  filters: [],
}

export const defaultSectionVisibility: SectionVisibility = {
  shortcuts: true,
  todo: true,
  feed: true,
}

export const defaultFeedSettings: FeedSettings = {
  insightsDatabaseId: '',
  reportsDatabaseId: '',
  n8nWebhookUrl: '',
  n8nWebhookSecret: '',
  newsApiKey: '',
  openaiApiKey: '',
  enabled: false,
}

export const defaultTemplatePresets: ReportTemplate[] = [
  {
    id: 'daily-insights',
    name: 'Daily Insights',
    prompt: `You are an analyst creating a daily insights report. Analyze the following feed items and create a structured report with:

1. **Executive Summary** - A 2-3 sentence overview of the most important developments
2. **Key Trends** - 3-5 bullet points identifying patterns across sources
3. **Notable Items** - Highlight 3-5 items that deserve attention with brief explanations
4. **Opportunities** - Any actionable insights or opportunities identified

Keep the report concise and focused on actionable intelligence. Use markdown formatting.`,
    sources: ['all'],
    useSearch: false
  },
  {
    id: 'daily-update',
    name: 'Daily Update',
    prompt: `Create a brief daily update newsletter-style report. Format it as:

**Good morning! Here's your tech update for today:**

**Top Stories**
- List the 3 most important/interesting items with one-line summaries

**Product Launches**
- Any notable new products or launches

**Trending on HN**
- What the developer community is discussing

**Quick Hits**
- 3-5 bullet points of other noteworthy items

Keep it scannable and under 300 words. Use a friendly, informative tone.`,
    sources: ['all'],
    useSearch: false
  },
  {
    id: 'custom-research',
    name: 'Custom Research',
    prompt: `You are a research analyst. Your task is to:

1. First, use the web search tool to find recent information about the topic
2. Then, check the news feeds for related coverage
3. Synthesize findings into a research brief

Structure your report as:

**Research Topic**: [Topic from search]

**Key Findings**
- Main discoveries from web search and news sources

**Source Analysis**
- What different sources are saying
- Any conflicting information

**Recent Developments**
- Timeline of recent events/announcements

**Implications**
- What this means and potential impact

Include links to sources where relevant.`,
    sources: ['all'],
    useSearch: true,
    searchQuery: ''
  }
]

export const defaultReportTemplate: ReportTemplate = defaultTemplatePresets[0]

export const defaultShortcuts: Shortcut[] = [
  { id: 1, name: 'Google', type: 'link', url: 'https://google.com', icon: 'G' },
  { id: 2, name: 'GitHub', type: 'link', url: 'https://github.com', icon: 'GH' },
  { id: 3, name: 'YouTube', type: 'link', url: 'https://youtube.com', icon: 'YT' },
  { id: 4, name: 'Claude', type: 'link', url: 'https://claude.ai/new', icon: 'C' },
  { id: 5, name: 'Claude Code', type: 'command', url: 'open -a Terminal && sleep 0.5 && osascript -e \'tell application "Terminal" to do script "claude"\'', icon: 'CC' },
  { id: 6, name: 'Canvas', type: 'link', url: 'https://claude.ai/canvas', icon: 'CV' },
  { id: 7, name: 'Slack', type: 'app', url: 'slack', icon: 'S' },
]
