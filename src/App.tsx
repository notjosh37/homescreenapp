import { useState, useEffect, FormEvent, useCallback, useMemo } from 'react'
import { Shader, ChromaFlow, Swirl } from 'shaders/react'
import './App.css'

// Types
interface Shortcut {
  id: number
  name: string
  type: 'link' | 'app' | 'file' | 'command'
  url: string
  icon: string
}

interface Todo {
  id: string
  text: string
  completed: boolean
  notionPageId?: string
  dueDate?: string
}

interface NewsItem {
  id: number
  title: string
  url: string
  score: number
  descendants: number
  time: number
}

// Feed types
type FeedSource = 'all' | 'hn' | 'pitchbook' | 'rss' | 'linkedin' | 'news' | 'report' | 'starred'

interface FeedItem {
  id: string
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
}

interface FeedSettings {
  insightsDatabaseId: string
  reportsDatabaseId: string
  n8nWebhookUrl: string
  n8nWebhookSecret: string
  newsApiKey: string
  openaiApiKey: string
  enabled: boolean
}

interface SectionVisibility {
  shortcuts: boolean
  todo: boolean
  feed: boolean
}

interface Report {
  id: string
  title: string
  date: string
  body: string
}

interface ReportTemplate {
  id: string
  name: string
  prompt: string
  sources: FeedSource[]
  useSearch?: boolean
  searchQuery?: string
}

interface ShaderSettings {
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

interface NotionFilter {
  property: string
  value: string
}

interface NotionSettings {
  apiKey: string
  databaseId: string
  enabled: boolean
  sortBy: string
  sortDirection: 'ascending' | 'descending'
  filters: NotionFilter[]
}

const defaultShaderSettings: ShaderSettings = {
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
  unsplashApiKey: import.meta.env.VITE_UNSPLASH_API_KEY || '',
  unsplashQuery: 'nature dark',
  unsplashUrl: '',
  savedBackgrounds: [],
  greeting: 'Hello Josh',
}

const defaultNotionSettings: NotionSettings = {
  apiKey: import.meta.env.VITE_NOTION_API_KEY || '',
  databaseId: import.meta.env.VITE_NOTION_DATABASE_ID || '',
  enabled: !!import.meta.env.VITE_NOTION_API_KEY,
  sortBy: 'Date',
  sortDirection: 'ascending',
  filters: [],
}

const defaultSectionVisibility: SectionVisibility = {
  shortcuts: true,
  todo: true,
  feed: true,
}

const defaultTemplatePresets: ReportTemplate[] = [
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

const defaultReportTemplate: ReportTemplate = defaultTemplatePresets[0]

const defaultFeedSettings: FeedSettings = {
  insightsDatabaseId: import.meta.env.VITE_NOTION_DATABASE_ID || '',
  reportsDatabaseId: '',
  n8nWebhookUrl: '',
  n8nWebhookSecret: '',
  newsApiKey: import.meta.env.VITE_NEWS_API_KEY || '',
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  enabled: !!import.meta.env.VITE_NOTION_DATABASE_ID,
}

// Grain Overlay Component
function GrainOverlay() {
  return (
    <div
      className="grain-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}
    />
  )
}

// Local Storage Helpers
function getFromStorage<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key)
  return stored ? JSON.parse(stored) : defaultValue
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// Time helpers
function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Simple markdown to HTML renderer
function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Unordered lists
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    // Wrap consecutive li in ul
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<h') || match.startsWith('<ul') || match.startsWith('<li')) {
        return match
      }
      return `<p>${match}</p>`
    })
}

const defaultShortcuts: Shortcut[] = [
  { id: 1, name: 'Google', type: 'link', url: 'https://google.com', icon: 'G' },
  { id: 2, name: 'GitHub', type: 'link', url: 'https://github.com', icon: 'GH' },
  { id: 3, name: 'YouTube', type: 'link', url: 'https://youtube.com', icon: 'YT' },
  { id: 4, name: 'Claude', type: 'link', url: 'https://claude.ai/new', icon: 'C' },
  { id: 5, name: 'Claude Code', type: 'command', url: 'open -a Terminal && sleep 0.5 && osascript -e \'tell application "Terminal" to do script "claude"\'', icon: 'CC' },
  { id: 6, name: 'Canvas', type: 'link', url: 'https://claude.ai/canvas', icon: 'CV' },
  { id: 7, name: 'Slack', type: 'app', url: 'slack', icon: 'S' },
]

// Settings Page Component
function SettingsPage({
  settings,
  notionSettings,
  feedSettings,
  sectionVisibility,
  todoLimit,
  onSettingsChange,
  onNotionSettingsChange,
  onFeedSettingsChange,
  onSectionVisibilityChange,
  onTodoLimitChange,
  onClose
}: {
  settings: ShaderSettings
  notionSettings: NotionSettings
  feedSettings: FeedSettings
  sectionVisibility: SectionVisibility
  todoLimit: number
  onSettingsChange: (settings: ShaderSettings) => void
  onNotionSettingsChange: (settings: NotionSettings) => void
  onFeedSettingsChange: (settings: FeedSettings) => void
  onSectionVisibilityChange: (visibility: SectionVisibility) => void
  onTodoLimitChange: (limit: number) => void
  onClose: () => void
}) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [localNotionSettings, setLocalNotionSettings] = useState(notionSettings)
  const [localFeedSettings, setLocalFeedSettings] = useState(feedSettings)
  const [localSectionVisibility, setLocalSectionVisibility] = useState(sectionVisibility)

  // Config import/export state
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [pendingConfig, setPendingConfig] = useState<Record<string, unknown> | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [exportSections, setExportSections] = useState({
    shaderSettings: true,
    notionSettings: true,
    feedSettings: true,
    sectionVisibility: true,
    shortcuts: true,
    todoLimit: true,
  })
  const [importSections, setImportSections] = useState({
    shaderSettings: true,
    notionSettings: true,
    feedSettings: true,
    sectionVisibility: true,
    shortcuts: true,
    todoLimit: true,
  })

  // Check if config contains API keys
  const configHasApiKeys = (config: Record<string, unknown>) => {
    const keys: string[] = []
    if ((config.notionSettings as Record<string, unknown>)?.apiKey) keys.push('Notion API Key')
    if ((config.feedSettings as Record<string, unknown>)?.newsApiKey) keys.push('News API Key')
    if ((config.feedSettings as Record<string, unknown>)?.openaiApiKey) keys.push('OpenAI API Key')
    if ((config.feedSettings as Record<string, unknown>)?.n8nWebhookSecret) keys.push('n8n Webhook Secret')
    if ((config.shaderSettings as Record<string, unknown>)?.unsplashApiKey) keys.push('Unsplash API Key')
    return keys
  }

  // Validate config structure
  const validateConfig = (config: unknown): { valid: boolean; errors: string[]; sections: string[] } => {
    const errors: string[] = []
    const sections: string[] = []

    if (typeof config !== 'object' || config === null) {
      return { valid: false, errors: ['Config must be a JSON object'], sections: [] }
    }

    const c = config as Record<string, unknown>

    if (c.shaderSettings && typeof c.shaderSettings === 'object') sections.push('Shader Settings')
    if (c.notionSettings && typeof c.notionSettings === 'object') sections.push('Notion Settings')
    if (c.feedSettings && typeof c.feedSettings === 'object') sections.push('Feed Settings')
    if (c.sectionVisibility && typeof c.sectionVisibility === 'object') sections.push('Section Visibility')
    if (c.shortcuts && Array.isArray(c.shortcuts)) sections.push('Shortcuts')
    if (c.todoLimit !== undefined) sections.push('Todo Limit')
    if (c.sectionsOpen && typeof c.sectionsOpen === 'object') sections.push('Sections Open State')

    if (sections.length === 0) {
      errors.push('No valid config sections found')
    }

    return { valid: errors.length === 0, errors, sections }
  }

  // Apply pending config
  const applyConfig = () => {
    if (!pendingConfig) return

    if (importSections.shaderSettings && pendingConfig.shaderSettings) {
      setLocalSettings(pendingConfig.shaderSettings as ShaderSettings)
      onSettingsChange(pendingConfig.shaderSettings as ShaderSettings)
    }
    if (importSections.notionSettings && pendingConfig.notionSettings) {
      setLocalNotionSettings(pendingConfig.notionSettings as NotionSettings)
      onNotionSettingsChange(pendingConfig.notionSettings as NotionSettings)
    }
    if (importSections.feedSettings && pendingConfig.feedSettings) {
      setLocalFeedSettings(pendingConfig.feedSettings as FeedSettings)
      onFeedSettingsChange(pendingConfig.feedSettings as FeedSettings)
    }
    if (importSections.sectionVisibility && pendingConfig.sectionVisibility) {
      setLocalSectionVisibility(pendingConfig.sectionVisibility as SectionVisibility)
      onSectionVisibilityChange(pendingConfig.sectionVisibility as SectionVisibility)
    }
    if (importSections.todoLimit && pendingConfig.todoLimit !== undefined) {
      onTodoLimitChange(pendingConfig.todoLimit as number)
    }
    if (importSections.shortcuts && pendingConfig.shortcuts) {
      saveToStorage('shortcuts', pendingConfig.shortcuts)
    }
    if (pendingConfig.sectionsOpen) {
      saveToStorage('sectionsOpen', pendingConfig.sectionsOpen)
    }

    setConfigModalOpen(false)
    setPendingConfig(null)
  }

  // Handle file import
  const handleConfigImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string)
        const validation = validateConfig(config)

        if (!validation.valid) {
          setConfigError(validation.errors.join('. '))
          setPendingConfig(null)
        } else {
          setPendingConfig(config)
          setConfigError(null)
          // Reset import sections based on what's available
          setImportSections({
            shaderSettings: !!config.shaderSettings,
            notionSettings: !!config.notionSettings,
            feedSettings: !!config.feedSettings,
            sectionVisibility: !!config.sectionVisibility,
            shortcuts: !!config.shortcuts,
            todoLimit: config.todoLimit !== undefined,
          })
        }
        setConfigModalOpen(true)
      } catch {
        setConfigError('Failed to parse config - invalid JSON format')
        setPendingConfig(null)
        setConfigModalOpen(true)
      }
    }
    reader.readAsText(file)
  }

  // Export config with selected sections
  const handleExport = (excludeApiKeys: boolean = false) => {
    const config: Record<string, unknown> = {}

    if (exportSections.shaderSettings) {
      const shaderCopy = { ...localSettings }
      if (excludeApiKeys) {
        shaderCopy.unsplashApiKey = ''
      }
      config.shaderSettings = shaderCopy
    }
    if (exportSections.notionSettings) {
      const notionCopy = { ...localNotionSettings }
      if (excludeApiKeys) {
        notionCopy.apiKey = ''
      }
      config.notionSettings = notionCopy
    }
    if (exportSections.feedSettings) {
      const feedCopy = { ...localFeedSettings }
      if (excludeApiKeys) {
        feedCopy.newsApiKey = ''
        feedCopy.openaiApiKey = ''
        feedCopy.n8nWebhookSecret = ''
      }
      config.feedSettings = feedCopy
    }
    if (exportSections.sectionVisibility) {
      config.sectionVisibility = localSectionVisibility
    }
    if (exportSections.shortcuts) {
      config.shortcuts = getFromStorage('shortcuts', [])
    }
    if (exportSections.todoLimit) {
      config.todoLimit = todoLimit
    }
    config.sectionsOpen = getFromStorage('sectionsOpen', {})

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'homescreen-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateSetting = <K extends keyof ShaderSettings>(key: K, value: ShaderSettings[K]) => {
    const updated = { ...localSettings, [key]: value }
    setLocalSettings(updated)
    onSettingsChange(updated)
  }

  const updateNotionSetting = <K extends keyof NotionSettings>(key: K, value: NotionSettings[K]) => {
    // Extract database ID from URL if pasted
    if (key === 'databaseId' && typeof value === 'string') {
      // First try to get db= parameter from URL
      const dbParamMatch = value.match(/[?&]db=([a-f0-9]{32})/i)
      if (dbParamMatch) {
        value = dbParamMatch[1] as NotionSettings[K]
      } else {
        // Fall back to any 32-char hex string (last one in URL is usually the database)
        const allMatches = value.match(/[a-f0-9]{32}/gi)
        if (allMatches && allMatches.length > 0) {
          value = allMatches[allMatches.length - 1] as NotionSettings[K]
        }
      }
    }
    const updated = { ...localNotionSettings, [key]: value }
    setLocalNotionSettings(updated)
    onNotionSettingsChange(updated)
  }

  const updateFeedSetting = <K extends keyof FeedSettings>(key: K, value: FeedSettings[K]) => {
    const updated = { ...localFeedSettings, [key]: value }
    setLocalFeedSettings(updated)
    onFeedSettingsChange(updated)
  }

  const updateSectionVisibility = <K extends keyof SectionVisibility>(key: K, value: boolean) => {
    const updated = { ...localSectionVisibility, [key]: value }
    setLocalSectionVisibility(updated)
    onSectionVisibilityChange(updated)
  }

  const resetToDefaults = () => {
    setLocalSettings(defaultShaderSettings)
    onSettingsChange(defaultShaderSettings)
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="settings-close" onClick={onClose}>x</button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Feed / Insights</h3>
          <div className="settings-row">
            <label>Enabled</label>
            <input
              type="checkbox"
              checked={localFeedSettings.enabled}
              onChange={(e) => updateFeedSetting('enabled', e.target.checked)}
            />
          </div>
          <div className="settings-row">
            <label>Insights DB ID</label>
            <input
              type="text"
              value={localFeedSettings.insightsDatabaseId}
              onChange={(e) => updateFeedSetting('insightsDatabaseId', e.target.value)}
              placeholder="abc123..."
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>Reports DB ID</label>
            <input
              type="text"
              value={localFeedSettings.reportsDatabaseId}
              onChange={(e) => updateFeedSetting('reportsDatabaseId', e.target.value)}
              placeholder="abc123..."
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>n8n Webhook URL</label>
            <input
              type="text"
              value={localFeedSettings.n8nWebhookUrl}
              onChange={(e) => updateFeedSetting('n8nWebhookUrl', e.target.value)}
              placeholder="https://..."
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>n8n Secret</label>
            <input
              type="password"
              value={localFeedSettings.n8nWebhookSecret}
              onChange={(e) => updateFeedSetting('n8nWebhookSecret', e.target.value)}
              placeholder="secret..."
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>NewsAPI Key</label>
            <input
              type="password"
              value={localFeedSettings.newsApiKey}
              onChange={(e) => updateFeedSetting('newsApiKey', e.target.value)}
              placeholder="from newsapi.org"
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>OpenAI API Key</label>
            <input
              type="password"
              value={localFeedSettings.openaiApiKey}
              onChange={(e) => updateFeedSetting('openaiApiKey', e.target.value)}
              placeholder="sk-..."
              className="settings-text-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>Notion Integration</h3>
          <div className="settings-row">
            <label>Enabled</label>
            <input
              type="checkbox"
              checked={localNotionSettings.enabled}
              onChange={(e) => updateNotionSetting('enabled', e.target.checked)}
            />
          </div>
          <div className="settings-row">
            <label>API Key</label>
            <input
              type="password"
              value={localNotionSettings.apiKey}
              onChange={(e) => updateNotionSetting('apiKey', e.target.value)}
              placeholder="ntn_..."
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>Database ID</label>
            <input
              type="text"
              value={localNotionSettings.databaseId}
              onChange={(e) => updateNotionSetting('databaseId', e.target.value)}
              placeholder="abc123..."
              className="settings-text-input"
            />
          </div>
          <div className="settings-row">
            <label>Sort</label>
            <select
              value={localNotionSettings.sortBy}
              onChange={(e) => updateNotionSetting('sortBy', e.target.value)}
              className="settings-select"
            >
              <option value="Date">Date</option>
              <option value="Name">Name</option>
              <option value="status">Status</option>
              <option value="Type">Type</option>
              <option value="Created time">Created</option>
            </select>
            <select
              value={localNotionSettings.sortDirection}
              onChange={(e) => updateNotionSetting('sortDirection', e.target.value as 'ascending' | 'descending')}
              className="settings-select"
            >
              <option value="ascending">Asc</option>
              <option value="descending">Desc</option>
            </select>
          </div>
          <div className="settings-row">
            <label>Visible Tasks</label>
            <input
              type="number"
              min="0"
              value={todoLimit}
              onChange={(e) => onTodoLimitChange(Math.max(0, Number(e.target.value)))}
              className="settings-text-input"
              placeholder="0 = no limit"
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>0 = no limit</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Background</h3>
          <div className="settings-row">
            <label>Color</label>
            <input
              type="color"
              value={localSettings.backgroundColor}
              onChange={(e) => updateSetting('backgroundColor', e.target.value)}
            />
            <span className="color-value">{localSettings.backgroundColor}</span>
          </div>
          <div className="settings-row">
            <label>Accent</label>
            <input
              type="color"
              value={localSettings.accentColor}
              onChange={(e) => updateSetting('accentColor', e.target.value)}
            />
            <span className="color-value">{localSettings.accentColor}</span>
          </div>
          <div className="settings-row">
            <label>Text</label>
            <input
              type="color"
              value={localSettings.textColor}
              onChange={(e) => updateSetting('textColor', e.target.value)}
            />
            <span className="color-value">{localSettings.textColor}</span>
          </div>
          <div className="settings-row">
            <label>Content Backdrop</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.contentBackdropOpacity}
              onChange={(e) => updateSetting('contentBackdropOpacity', parseFloat(e.target.value))}
            />
            <span className="slider-value">{Math.round(localSettings.contentBackdropOpacity * 100)}%</span>
          </div>
          <div className="settings-row">
            <label>Show Dividers</label>
            <input
              type="checkbox"
              checked={localSettings.showDividers}
              onChange={(e) => updateSetting('showDividers', e.target.checked)}
            />
          </div>
          <div className="settings-row">
            <label>Greeting</label>
            <input
              type="text"
              value={localSettings.greeting}
              onChange={(e) => updateSetting('greeting', e.target.value)}
              placeholder="Hello Josh"
            />
          </div>
          <div className="settings-row">
            <label>Use Unsplash</label>
            <input
              type="checkbox"
              checked={localSettings.unsplashEnabled}
              onChange={(e) => updateSetting('unsplashEnabled', e.target.checked)}
            />
          </div>
          {localSettings.unsplashEnabled && (
            <>
              <div className="settings-row">
                <label>API Key</label>
                <input
                  type="password"
                  value={localSettings.unsplashApiKey || ''}
                  onChange={(e) => updateSetting('unsplashApiKey', e.target.value)}
                  placeholder="Unsplash Access Key"
                  className="settings-text-input"
                />
              </div>
              {localSettings.unsplashApiKey && (
                <div className="settings-row">
                  <label>Search</label>
                  <input
                    type="text"
                    value={localSettings.unsplashQuery}
                    onChange={(e) => updateSetting('unsplashQuery', e.target.value)}
                    placeholder="nature, city, dark..."
                    className="settings-text-input"
                  />
                </div>
              )}
              <div className="settings-row">
                <button
                  className="config-btn"
                  onClick={async () => {
                    if (localSettings.unsplashApiKey) {
                      try {
                        const query = localSettings.unsplashQuery || 'nature'
                        const res = await fetch(
                          `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${localSettings.unsplashApiKey}`
                        )
                        if (res.ok) {
                          const data = await res.json()
                          if (data.urls?.full) {
                            updateSetting('unsplashUrl', data.urls.full)
                            return
                          }
                        }
                        // Fallback to Picsum if Unsplash fails
                        const url = `https://picsum.photos/1920/1080?random=${Date.now()}`
                        updateSetting('unsplashUrl', url)
                      } catch (e) {
                        console.error('Unsplash API error:', e)
                        const url = `https://picsum.photos/1920/1080?random=${Date.now()}`
                        updateSetting('unsplashUrl', url)
                      }
                    } else {
                      const url = `https://picsum.photos/1920/1080?random=${Date.now()}`
                      updateSetting('unsplashUrl', url)
                    }
                  }}
                >
                  Load {localSettings.unsplashApiKey ? 'Image' : 'Random Image'}
                </button>
              </div>
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>
                {localSettings.unsplashApiKey ? 'Using Unsplash API' : 'Get API key at unsplash.com/developers for search'}
              </span>
              {localSettings.unsplashUrl && (
                <>
                  <div className="settings-row">
                    <img
                      src={localSettings.unsplashUrl}
                      alt="Background preview"
                      style={{ width: '100%', height: '80px', objectFit: 'cover', border: '0.5px solid rgba(255,255,255,0.2)' }}
                    />
                  </div>
                  <div className="settings-row">
                    <button
                      className="config-btn"
                      onClick={() => {
                        const saved = localSettings.savedBackgrounds || []
                        if (!saved.includes(localSettings.unsplashUrl)) {
                          updateSetting('savedBackgrounds', [...saved, localSettings.unsplashUrl])
                        }
                      }}
                    >
                      Save to Favorites
                    </button>
                  </div>
                </>
              )}
              {localSettings.savedBackgrounds && localSettings.savedBackgrounds.length > 0 && (
                <div className="saved-backgrounds">
                  <label style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', display: 'block' }}>Saved Backgrounds</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {localSettings.savedBackgrounds.map((bg: string, i: number) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={bg}
                          alt={`Saved ${i + 1}`}
                          style={{ width: '60px', height: '40px', objectFit: 'cover', cursor: 'pointer', border: localSettings.unsplashUrl === bg ? '2px solid white' : '0.5px solid rgba(255,255,255,0.2)' }}
                          onClick={() => updateSetting('unsplashUrl', bg)}
                        />
                        <button
                          style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', fontSize: '8px', padding: 0, background: 'rgba(0,0,0,0.7)', border: '0.5px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer' }}
                          onClick={() => updateSetting('savedBackgrounds', localSettings.savedBackgrounds.filter((_: string, j: number) => j !== i))}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="settings-section">
          <h3>Swirl Effect</h3>
          <div className="settings-row">
            <label>Color A</label>
            <input
              type="color"
              value={localSettings.swirlColorA}
              onChange={(e) => updateSetting('swirlColorA', e.target.value)}
            />
            <span className="color-value">{localSettings.swirlColorA}</span>
          </div>
          <div className="settings-row">
            <label>Color B</label>
            <input
              type="color"
              value={localSettings.swirlColorB}
              onChange={(e) => updateSetting('swirlColorB', e.target.value)}
            />
            <span className="color-value">{localSettings.swirlColorB}</span>
          </div>
          <div className="settings-row">
            <label>Speed</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localSettings.swirlSpeed}
              onChange={(e) => updateSetting('swirlSpeed', parseFloat(e.target.value))}
            />
            <span className="slider-value">{localSettings.swirlSpeed.toFixed(1)}</span>
          </div>
          <div className="settings-row">
            <label>Detail</label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={localSettings.swirlDetail}
              onChange={(e) => updateSetting('swirlDetail', parseFloat(e.target.value))}
            />
            <span className="slider-value">{localSettings.swirlDetail.toFixed(1)}</span>
          </div>
          <div className="settings-row">
            <label>Blend</label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={localSettings.swirlBlend}
              onChange={(e) => updateSetting('swirlBlend', parseInt(e.target.value))}
            />
            <span className="slider-value">{localSettings.swirlBlend}</span>
          </div>
          <div className="settings-row">
            <label>Opacity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={localSettings.swirlOpacity}
              onChange={(e) => updateSetting('swirlOpacity', parseFloat(e.target.value))}
            />
            <span className="slider-value">{localSettings.swirlOpacity.toFixed(2)}</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Chroma Flow Effect</h3>
          <div className="settings-row">
            <label>Base Color</label>
            <input
              type="color"
              value={localSettings.chromaBaseColor}
              onChange={(e) => updateSetting('chromaBaseColor', e.target.value)}
            />
            <span className="color-value">{localSettings.chromaBaseColor}</span>
          </div>
          <div className="settings-row">
            <label>Up Color</label>
            <input
              type="color"
              value={localSettings.chromaUpColor}
              onChange={(e) => updateSetting('chromaUpColor', e.target.value)}
            />
            <span className="color-value">{localSettings.chromaUpColor}</span>
          </div>
          <div className="settings-row">
            <label>Down Color</label>
            <input
              type="color"
              value={localSettings.chromaDownColor}
              onChange={(e) => updateSetting('chromaDownColor', e.target.value)}
            />
            <span className="color-value">{localSettings.chromaDownColor}</span>
          </div>
          <div className="settings-row">
            <label>Left Color</label>
            <input
              type="color"
              value={localSettings.chromaLeftColor}
              onChange={(e) => updateSetting('chromaLeftColor', e.target.value)}
            />
            <span className="color-value">{localSettings.chromaLeftColor}</span>
          </div>
          <div className="settings-row">
            <label>Right Color</label>
            <input
              type="color"
              value={localSettings.chromaRightColor}
              onChange={(e) => updateSetting('chromaRightColor', e.target.value)}
            />
            <span className="color-value">{localSettings.chromaRightColor}</span>
          </div>
          <div className="settings-row">
            <label>Intensity</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={localSettings.chromaIntensity}
              onChange={(e) => updateSetting('chromaIntensity', parseFloat(e.target.value))}
            />
            <span className="slider-value">{localSettings.chromaIntensity.toFixed(1)}</span>
          </div>
          <div className="settings-row">
            <label>Radius</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={localSettings.chromaRadius}
              onChange={(e) => updateSetting('chromaRadius', parseFloat(e.target.value))}
            />
            <span className="slider-value">{localSettings.chromaRadius.toFixed(1)}</span>
          </div>
          <div className="settings-row">
            <label>Momentum</label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={localSettings.chromaMomentum}
              onChange={(e) => updateSetting('chromaMomentum', parseInt(e.target.value))}
            />
            <span className="slider-value">{localSettings.chromaMomentum}</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Keyboard Shortcuts</h3>
          <div className="keybinds-list">
            <div className="keybind-row"><kbd>Cmd+Shift+S</kbd><span>Toggle Settings</span></div>
            <div className="keybind-row"><kbd>Cmd+Shift+I</kbd><span>Toggle Info Panel</span></div>
            <div className="keybind-row"><kbd>Cmd+Shift+A</kbd><span>Add Shortcut</span></div>
            <div className="keybind-row"><kbd>Cmd+Shift+F</kbd><span>Toggle Filter</span></div>
            <div className="keybind-row"><kbd>Cmd+Shift+R</kbd><span>Refresh Data</span></div>
            <div className="keybind-row"><kbd>Esc</kbd><span>Close Panels</span></div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Config</h3>

          {/* Export Section Selection */}
          <div className="config-section-select">
            <label className="section-label">Export Sections:</label>
            <div className="section-checkboxes">
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={exportSections.shaderSettings}
                  onChange={(e) => setExportSections({ ...exportSections, shaderSettings: e.target.checked })}
                />
                Shader
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={exportSections.notionSettings}
                  onChange={(e) => setExportSections({ ...exportSections, notionSettings: e.target.checked })}
                />
                Notion
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={exportSections.feedSettings}
                  onChange={(e) => setExportSections({ ...exportSections, feedSettings: e.target.checked })}
                />
                Feed
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={exportSections.sectionVisibility}
                  onChange={(e) => setExportSections({ ...exportSections, sectionVisibility: e.target.checked })}
                />
                Visibility
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={exportSections.shortcuts}
                  onChange={(e) => setExportSections({ ...exportSections, shortcuts: e.target.checked })}
                />
                Shortcuts
              </label>
              <label className="section-checkbox">
                <input
                  type="checkbox"
                  checked={exportSections.todoLimit}
                  onChange={(e) => setExportSections({ ...exportSections, todoLimit: e.target.checked })}
                />
                Todo Limit
              </label>
            </div>
          </div>

          {/* API Key Warning */}
          {configHasApiKeys({
            shaderSettings: exportSections.shaderSettings ? localSettings : {},
            notionSettings: exportSections.notionSettings ? localNotionSettings : {},
            feedSettings: exportSections.feedSettings ? localFeedSettings : {},
          }).length > 0 && (
            <div className="config-warning">
              Config contains API keys: {configHasApiKeys({
                shaderSettings: exportSections.shaderSettings ? localSettings : {},
                notionSettings: exportSections.notionSettings ? localNotionSettings : {},
                feedSettings: exportSections.feedSettings ? localFeedSettings : {},
              }).join(', ')}
            </div>
          )}

          <div className="config-actions">
            <button className="config-btn" onClick={() => handleExport(false)}>
              Export
            </button>
            {configHasApiKeys({
              shaderSettings: exportSections.shaderSettings ? localSettings : {},
              notionSettings: exportSections.notionSettings ? localNotionSettings : {},
              feedSettings: exportSections.feedSettings ? localFeedSettings : {},
            }).length > 0 && (
              <button className="config-btn" onClick={() => handleExport(true)}>
                Export (No Keys)
              </button>
            )}
            <label className="config-btn import-btn">
              Import
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleConfigImport(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>

        <div className="settings-actions">
          <button className="reset-btn" onClick={resetToDefaults}>Reset to Defaults</button>
        </div>
      </div>

      {/* Config Import Modal */}
      {configModalOpen && (
        <div className="config-modal-overlay" onClick={() => setConfigModalOpen(false)}>
          <div className="config-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import Config</h3>

            {configError ? (
              <div className="config-error">
                <p>{configError}</p>
                <button className="config-btn" onClick={() => setConfigModalOpen(false)}>Close</button>
              </div>
            ) : pendingConfig ? (
              <>
                {/* API Key Warning in Import */}
                {configHasApiKeys(pendingConfig).length > 0 && (
                  <div className="config-warning">
                    This config contains API keys: {configHasApiKeys(pendingConfig).join(', ')}
                  </div>
                )}

                {/* Available Sections */}
                <div className="config-section-select">
                  <label className="section-label">Import Sections:</label>
                  <div className="section-checkboxes">
                    {pendingConfig.shaderSettings && (
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={importSections.shaderSettings}
                          onChange={(e) => setImportSections({ ...importSections, shaderSettings: e.target.checked })}
                        />
                        Shader Settings
                      </label>
                    )}
                    {pendingConfig.notionSettings && (
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={importSections.notionSettings}
                          onChange={(e) => setImportSections({ ...importSections, notionSettings: e.target.checked })}
                        />
                        Notion Settings
                      </label>
                    )}
                    {pendingConfig.feedSettings && (
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={importSections.feedSettings}
                          onChange={(e) => setImportSections({ ...importSections, feedSettings: e.target.checked })}
                        />
                        Feed Settings
                      </label>
                    )}
                    {pendingConfig.sectionVisibility && (
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={importSections.sectionVisibility}
                          onChange={(e) => setImportSections({ ...importSections, sectionVisibility: e.target.checked })}
                        />
                        Section Visibility
                      </label>
                    )}
                    {pendingConfig.shortcuts && (
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={importSections.shortcuts}
                          onChange={(e) => setImportSections({ ...importSections, shortcuts: e.target.checked })}
                        />
                        Shortcuts ({(pendingConfig.shortcuts as unknown[]).length} items)
                      </label>
                    )}
                    {pendingConfig.todoLimit !== undefined && (
                      <label className="section-checkbox">
                        <input
                          type="checkbox"
                          checked={importSections.todoLimit}
                          onChange={(e) => setImportSections({ ...importSections, todoLimit: e.target.checked })}
                        />
                        Todo Limit ({pendingConfig.todoLimit})
                      </label>
                    )}
                  </div>
                </div>

                <div className="config-modal-actions">
                  <button className="config-btn cancel" onClick={() => setConfigModalOpen(false)}>Cancel</button>
                  <button className="config-btn apply" onClick={applyConfig}>Apply</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => getFromStorage('shortcuts', defaultShortcuts))
  const [todos, setTodos] = useState<Todo[]>(() => getFromStorage('todos', []))
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [todosLoading, setTodosLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [resourceInfo, setResourceInfo] = useState({ memory: 0, domNodes: 0, fps: 0 })
  const [optionHeld, setOptionHeld] = useState(false)
  const [sectionsOpen, setSectionsOpen] = useState({ shortcuts: true, todo: true, news: true, feed: true })
  const [todoInput, setTodoInput] = useState('')
  const [todoDateRange, setTodoDateRange] = useState<'all' | 'today' | 'week' | 'month'>('week')
  const [todoLimit, setTodoLimit] = useState<number>(() => getFromStorage('todoLimit', 10))
  const [limitDropdownOpen, setLimitDropdownOpen] = useState(false)
  const [newShortcut, setNewShortcut] = useState({ name: '', type: 'link', url: '', icon: '' })
  const [shaderSettings, setShaderSettings] = useState<ShaderSettings>(() => {
    const stored = getFromStorage('shaderSettings', defaultShaderSettings)
    // Always use env var for API key if available
    return {
      ...stored,
      unsplashApiKey: import.meta.env.VITE_UNSPLASH_API_KEY || stored.unsplashApiKey || '',
    }
  })
  const [notionSettings, setNotionSettings] = useState<NotionSettings>(() => {
    // Force update to correct database ID and API key
    const stored = getFromStorage('notionSettings', defaultNotionSettings)
    let needsUpdate = false
    const updated = { ...defaultNotionSettings, ...stored }

    // Add missing sort properties
    if (!updated.sortBy) {
      updated.sortBy = 'Date'
      needsUpdate = true
    }
    if (!updated.sortDirection) {
      updated.sortDirection = 'ascending'
      needsUpdate = true
    }
    // Add missing filters property
    if (!updated.filters) {
      updated.filters = []
      needsUpdate = true
    }

    if (needsUpdate) {
      saveToStorage('notionSettings', updated)
    }
    return updated
  })

  // Feed state
  const [feedLoading, setFeedLoading] = useState(true)
  const [activeSource, setActiveSource] = useState<FeedSource>('all')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [customDateStart, setCustomDateStart] = useState<string>('')
  const [customDateEnd, setCustomDateEnd] = useState<string>('')
  const [rssFilter, setRssFilter] = useState<string>('all')
  const [feedSearchQuery, setFeedSearchQuery] = useState('')
  const [feedSortBy, setFeedSortBy] = useState<'date' | 'score'>('date')
  const [minScore, setMinScore] = useState<number>(0)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [starredItems, setStarredItems] = useState<string[]>(() => getFromStorage('starredItems', []))
  const [visibleFeedCount, setVisibleFeedCount] = useState(20)
  const [feedSettings, setFeedSettings] = useState<FeedSettings>(() => {
    const stored = getFromStorage('feedSettings', defaultFeedSettings)
    // Always use env vars if available (override stored values)
    return {
      ...stored,
      newsApiKey: import.meta.env.VITE_NEWS_API_KEY || stored.newsApiKey,
      openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || stored.openaiApiKey,
      insightsDatabaseId: import.meta.env.VITE_NOTION_DATABASE_ID || stored.insightsDatabaseId,
    }
  })
  const [allFeedItems, setAllFeedItems] = useState<FeedItem[]>([])

  // Report state
  const [currentReport, setCurrentReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [availableReportDates, setAvailableReportDates] = useState<string[]>([])

  // Report template state
  const [reportTemplate, setReportTemplate] = useState<ReportTemplate>(() =>
    getFromStorage('reportTemplate', defaultReportTemplate)
  )
  const [customPresets, setCustomPresets] = useState<ReportTemplate[]>(() =>
    getFromStorage('customPresets', [])
  )
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  // Combined presets (default + custom)
  const allPresets = [...defaultTemplatePresets, ...customPresets]

  // Section visibility
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>(() => {
    const stored = getFromStorage('sectionVisibility', defaultSectionVisibility)
    // Force feed to always be visible (since we removed the UI to show it)
    return { ...defaultSectionVisibility, ...stored, feed: true }
  })

  // Agent status for UI feedback
  const [agentStatus, setAgentStatus] = useState<string>('')

  // n8n webhook state
  const [n8nRefreshing, setN8nRefreshing] = useState(false)

  // Notion API helpers
  const fetchNotionTodos = useCallback(async () => {
    if (!notionSettings.enabled || !notionSettings.apiKey || !notionSettings.databaseId) {
      return
    }

    setTodosLoading(true)
    try {
      // Build sort config based on settings
      const sortConfig = notionSettings.sortBy === 'Created time'
        ? { timestamp: 'created_time', direction: notionSettings.sortDirection }
        : { property: notionSettings.sortBy, direction: notionSettings.sortDirection }

      // Build filter config based on settings
      const filterConditions = notionSettings.filters
        .filter(f => f.value && f.value !== 'all')
        .map(f => {
          if (f.property === 'status') {
            return {
              property: 'status',
              status: { equals: f.value }
            }
          } else if (f.property === 'Type') {
            return {
              property: 'Type',
              select: { equals: f.value }
            }
          } else if (f.property === 'What') {
            if (f.value === 'has_value') {
              return {
                property: 'What',
                relation: { is_not_empty: true }
              }
            } else if (f.value === 'is_empty') {
              return {
                property: 'What',
                relation: { is_empty: true }
              }
            }
          }
          return null
        })
        .filter(Boolean)

      const queryBody: any = {
        sorts: [sortConfig],
        page_size: 100
      }

      if (filterConditions.length === 1) {
        queryBody.filter = filterConditions[0]
      } else if (filterConditions.length > 1) {
        queryBody.filter = { and: filterConditions }
      }

      // Try new data_sources endpoint first, fall back to databases endpoint
      let response = await fetch(`/api/notion/v1/data_sources/${notionSettings.databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionSettings.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify(queryBody)
      })

      // Fall back to old databases endpoint if data_sources fails
      if (!response.ok) {
        response = await fetch(`/api/notion/v1/databases/${notionSettings.databaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionSettings.apiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify(queryBody)
        })
      }

      if (!response.ok) {
        console.error('Notion API error:', response.status, await response.text())
        return
      }

      const data = await response.json()

      // Parse Notion results into todos
      const notionTodos: Todo[] = data.results.map((page: any) => {
        // Try to get title from various property names
        const titleProp = page.properties.Name || page.properties.Title || page.properties.Task ||
                         Object.values(page.properties).find((p: any) => p.type === 'title')

        let text = 'Untitled'
        if (titleProp && titleProp.title && titleProp.title[0]) {
          text = titleProp.title[0].plain_text
        }

        // Check for completion - handle both checkbox and status types
        let completed = false
        const statusProp = page.properties.status || page.properties.Status
        const checkboxProp = page.properties.Done || page.properties.Completed ||
                            Object.values(page.properties).find((p: any) => p.type === 'checkbox')

        if (statusProp && statusProp.type === 'status' && statusProp.status) {
          // Status field - check if name is "Completed" or "Done"
          completed = statusProp.status.name === 'Completed' || statusProp.status.name === 'Done'
        } else if (checkboxProp && checkboxProp.type === 'checkbox') {
          completed = checkboxProp.checkbox
        }

        // Get due date
        let dueDate: string | undefined
        const dateProp = page.properties.Date || page.properties.Due || page.properties['Due Date'] ||
                        Object.values(page.properties).find((p: any) => p.type === 'date')
        if (dateProp && dateProp.type === 'date' && dateProp.date?.start) {
          dueDate = dateProp.date.start
        }

        return {
          id: page.id,
          text,
          completed,
          notionPageId: page.id,
          dueDate
        }
      })

      setTodos(notionTodos)
      saveToStorage('todos', notionTodos)
    } catch (error) {
      console.error('Error fetching Notion todos:', error)
    }
    setTodosLoading(false)
  }, [notionSettings])

  const toggleNotionTodo = async (pageId: string, completed: boolean) => {
    if (!notionSettings.enabled || !notionSettings.apiKey) return false

    try {
      const todo = todos.find(t => t.notionPageId === pageId)
      if (!todo) return false

      // Update status field (your database uses status, not checkbox)
      const response = await fetch(`/api/notion/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${notionSettings.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          properties: {
            status: {
              status: {
                name: completed ? 'Completed' : 'Not Started'
              }
            }
          }
        })
      })

      return response.ok
    } catch (error) {
      console.error('Error updating Notion todo:', error)
      return false
    }
  }

  const addNotionTodo = async (text: string) => {
    if (!notionSettings.enabled || !notionSettings.apiKey || !notionSettings.databaseId) return null

    try {
      const response = await fetch(`/api/notion/v1/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionSettings.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: notionSettings.databaseId },
          properties: {
            Name: {
              title: [{ text: { content: text } }]
            },
            status: {
              status: { name: 'Not Started' }
            }
          }
        })
      })

      if (!response.ok) {
        console.error('Error creating Notion page:', await response.text())
        return null
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error('Error adding Notion todo:', error)
      return null
    }
  }

  // Enable transitions after initial mount (prevents color flash)
  useEffect(() => {
    // Small delay to ensure all CSS variables are set
    const timer = setTimeout(() => {
      document.documentElement.classList.add('transitions-ready')
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Apply background color to CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--background', shaderSettings.backgroundColor)
  }, [shaderSettings.backgroundColor])

  // Apply accent color to CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', shaderSettings.accentColor)
  }, [shaderSettings.accentColor])

  // Apply text color to CSS variable with opacity variants
  useEffect(() => {
    document.documentElement.style.setProperty('--text-color', shaderSettings.textColor)
    // Create opacity variants
    const hex = shaderSettings.textColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    document.documentElement.style.setProperty('--text-color-90', `rgba(${r}, ${g}, ${b}, 0.9)`)
    document.documentElement.style.setProperty('--text-color-80', `rgba(${r}, ${g}, ${b}, 0.8)`)
    document.documentElement.style.setProperty('--text-color-60', `rgba(${r}, ${g}, ${b}, 0.6)`)
    document.documentElement.style.setProperty('--text-color-50', `rgba(${r}, ${g}, ${b}, 0.5)`)
    document.documentElement.style.setProperty('--text-color-40', `rgba(${r}, ${g}, ${b}, 0.4)`)
  }, [shaderSettings.textColor])

  // Save settings when they change
  const handleSettingsChange = (newSettings: ShaderSettings) => {
    setShaderSettings(newSettings)
    saveToStorage('shaderSettings', newSettings)
  }

  const handleNotionSettingsChange = (newSettings: NotionSettings) => {
    setNotionSettings(newSettings)
    saveToStorage('notionSettings', newSettings)
  }

  const handleFeedSettingsChange = (newSettings: FeedSettings) => {
    setFeedSettings(newSettings)
    saveToStorage('feedSettings', newSettings)
  }

  const handleSectionVisibilityChange = (newVisibility: SectionVisibility) => {
    setSectionVisibility(newVisibility)
    saveToStorage('sectionVisibility', newVisibility)
  }

  const handleTemplateChange = (newTemplate: ReportTemplate) => {
    setReportTemplate(newTemplate)
    saveToStorage('reportTemplate', newTemplate)
  }

  const saveAsNewPreset = () => {
    const newPreset: ReportTemplate = {
      ...reportTemplate,
      id: `custom-${Date.now()}`,
      name: reportTemplate.name.includes('(Custom)') ? reportTemplate.name : `${reportTemplate.name} (Custom)`
    }
    const updatedPresets = [...customPresets, newPreset]
    setCustomPresets(updatedPresets)
    saveToStorage('customPresets', updatedPresets)
    setReportTemplate(newPreset)
    saveToStorage('reportTemplate', newPreset)
  }

  const deleteCustomPreset = (presetId: string) => {
    const updatedPresets = customPresets.filter(p => p.id !== presetId)
    setCustomPresets(updatedPresets)
    saveToStorage('customPresets', updatedPresets)
    if (reportTemplate.id === presetId) {
      setReportTemplate(defaultTemplatePresets[0])
      saveToStorage('reportTemplate', defaultTemplatePresets[0])
    }
  }

  const isCustomPreset = (presetId: string) => {
    return customPresets.some(p => p.id === presetId)
  }

  // Feed fetching functions
  const fetchHackerNews = async (): Promise<FeedItem[]> => {
    try {
      const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      const storyIds = await response.json()
      const stories = await Promise.all(
        storyIds.slice(0, 15).map((id: number) =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
        )
      )
      return stories.filter(Boolean).map((story: any) => ({
        id: `hn-${story.id}`,
        source: 'hn' as FeedSource,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        date: new Date(story.time * 1000).toISOString(),
        score: story.score,
        comments: story.descendants || 0,
      }))
    } catch (error) {
      console.error('Error fetching HN:', error)
      return []
    }
  }

  const fetchRssFeeds = async (): Promise<FeedItem[]> => {
    const rssFeeds = [
      { url: 'https://betakit.com/feed/', name: 'BetaKit' },
      { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
    ]
    const results: FeedItem[] = []
    for (const feed of rssFeeds) {
      try {
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`)
        if (!response.ok) continue
        const data = await response.json()
        if (data.status === 'ok' && data.items) {
          const items = data.items.slice(0, 10).map((item: any, index: number) => ({
            id: `rss-${feed.name.toLowerCase()}-${index}-${Date.now()}`,
            source: 'rss' as FeedSource,
            title: item.title,
            url: item.link,
            date: item.pubDate || new Date().toISOString(),
            summary: item.description?.replace(/<[^>]*>/g, '').slice(0, 200),
            company: feed.name,
          }))
          results.push(...items)
        }
      } catch (error) {
        console.error(`Error fetching RSS from ${feed.name}:`, error)
      }
    }
    return results
  }

  const fetchNewsApi = async (): Promise<FeedItem[]> => {
    if (!feedSettings.newsApiKey) return []
    try {
      const response = await fetch(
        `https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=15&apiKey=${feedSettings.newsApiKey}`
      )
      if (!response.ok) return []
      const data = await response.json()
      return (data.articles || []).map((article: any, index: number) => ({
        id: `news-${index}-${Date.now()}`,
        source: 'news' as FeedSource,
        title: article.title,
        url: article.url,
        date: article.publishedAt || new Date().toISOString(),
        summary: article.description,
      }))
    } catch (error) {
      console.error('Error fetching NewsAPI:', error)
      return []
    }
  }

  const fetchInsightsFromNotion = async (): Promise<FeedItem[]> => {
    if (!feedSettings.enabled || !feedSettings.insightsDatabaseId || !notionSettings.apiKey) {
      return []
    }
    try {
      const response = await fetch(`/api/notion/v1/databases/${feedSettings.insightsDatabaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionSettings.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          sorts: [
            { property: 'Score', direction: 'descending' },
            { property: 'Date', direction: 'descending' }
          ],
          page_size: 50
        })
      })
      if (!response.ok) return []
      const data = await response.json()
      return data.results.map((page: any) => {
        const titleProp = page.properties.Title || page.properties.Name ||
          Object.values(page.properties).find((p: any) => p.type === 'title')
        const title = (titleProp as any)?.title?.[0]?.plain_text || 'Untitled'
        const sourceProp = page.properties.Source
        const sourceValue = sourceProp?.select?.name?.toLowerCase() || 'news'
        const source = (['hn', 'pitchbook', 'rss', 'linkedin', 'news'].includes(sourceValue)
          ? sourceValue : 'news') as FeedSource
        const urlProp = page.properties.URL
        const url = urlProp?.url || ''
        const dateProp = page.properties.Date
        const date = dateProp?.date?.start || new Date().toISOString()
        const scoreProp = page.properties.Score
        const relevanceScore = scoreProp?.number || 0
        const themeProp = page.properties.Theme
        const themes = themeProp?.multi_select?.map((t: any) => t.name) || []
        const companyProp = page.properties.Company
        const company = companyProp?.rich_text?.[0]?.plain_text || undefined
        const summaryProp = page.properties.Summary
        const summary = summaryProp?.rich_text?.[0]?.plain_text || undefined
        return { id: page.id, source, title, url, date, relevanceScore, themes, company, summary }
      })
    } catch (error) {
      console.error('Error fetching insights from Notion:', error)
      return []
    }
  }

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true)
    const results: FeedItem[] = []
    const hnItems = await fetchHackerNews()
    results.push(...hnItems)
    const newsItems = await fetchNewsApi()
    results.push(...newsItems)
    const rssItems = await fetchRssFeeds()
    results.push(...rssItems)
    const insightItems = await fetchInsightsFromNotion()
    results.push(...insightItems)
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setAllFeedItems(results)
    setFeedLoading(false)
  }, [feedSettings.enabled, feedSettings.insightsDatabaseId, feedSettings.newsApiKey, notionSettings.apiKey])

  // Filter items client-side
  const filteredFeedItems = useMemo(() => {
    let items = [...allFeedItems]
    // Filter by starred items
    if (activeSource === 'starred') {
      items = items.filter(item => starredItems.includes(item.id))
    } else if (activeSource !== 'all' && activeSource !== 'report') {
      items = items.filter(item => item.source === activeSource)
    }
    if (activeSource === 'rss' && rssFilter !== 'all') {
      items = items.filter(item => item.company === rssFilter)
    }
    if (feedSearchQuery.trim()) {
      const query = feedSearchQuery.toLowerCase().trim()
      items = items.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(query)
        const summaryMatch = item.summary?.toLowerCase().includes(query)
        const companyMatch = item.company?.toLowerCase().includes(query)
        const themesMatch = item.themes?.some(t => t.toLowerCase().includes(query))
        return titleMatch || summaryMatch || companyMatch || themesMatch
      })
    }
    const now = new Date()
    if (dateRange === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayFiltered = items.filter(item => new Date(item.date) >= todayStart)
      items = todayFiltered.length > 0 ? todayFiltered : items.slice(0, 20)
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      items = items.filter(item => new Date(item.date) >= weekAgo)
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      items = items.filter(item => new Date(item.date) >= monthAgo)
    } else if (dateRange === 'custom' && (customDateStart || customDateEnd)) {
      items = items.filter(item => {
        const itemDate = new Date(item.date)
        if (customDateStart && itemDate < new Date(customDateStart)) return false
        if (customDateEnd) {
          const endDate = new Date(customDateEnd)
          endDate.setHours(23, 59, 59, 999) // Include the entire end day
          if (itemDate > endDate) return false
        }
        return true
      })
    }
    // Filter by minimum score
    if (minScore > 0) {
      items = items.filter(item => {
        const score = item.score || item.relevanceScore || 0
        return score >= minScore
      })
    }
    // Filter by selected themes
    if (selectedThemes.length > 0) {
      items = items.filter(item => {
        if (!item.themes || item.themes.length === 0) return false
        return selectedThemes.some(theme => item.themes?.includes(theme))
      })
    }
    if (feedSortBy === 'score') {
      items.sort((a, b) => {
        const scoreA = a.score || a.relevanceScore || 0
        const scoreB = b.score || b.relevanceScore || 0
        return scoreB - scoreA
      })
    } else {
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    return items
  }, [allFeedItems, activeSource, dateRange, customDateStart, customDateEnd, rssFilter, feedSearchQuery, feedSortBy, minScore, selectedThemes, starredItems])

  // Paginated feed items
  const paginatedFeedItems = useMemo(() => {
    return filteredFeedItems.slice(0, visibleFeedCount)
  }, [filteredFeedItems, visibleFeedCount])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleFeedCount(20)
  }, [activeSource, dateRange, customDateStart, customDateEnd, rssFilter, feedSearchQuery, feedSortBy, minScore, selectedThemes])

  // Extract unique themes from all feed items
  const availableThemes = useMemo(() => {
    const themes = new Set<string>()
    allFeedItems.forEach(item => {
      if (item.themes) {
        item.themes.forEach(theme => themes.add(theme))
      }
    })
    return Array.from(themes).sort()
  }, [allFeedItems])

  // Filter todos client-side by date range and apply limit
  const filteredTodos = useMemo(() => {
    let filtered = todos
    if (todoDateRange !== 'all') {
      const now = new Date()
      let cutoffDate: Date
      if (todoDateRange === 'today') {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (todoDateRange === 'week') {
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else {
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
      filtered = todos.filter(todo => {
        if (!todo.dueDate) return false
        return new Date(todo.dueDate) >= cutoffDate
      })
    }
    return filtered
  }, [todos, todoDateRange])

  // Fetch reports from Notion
  const fetchReports = useCallback(async () => {
    if (!feedSettings.enabled || !feedSettings.reportsDatabaseId || !notionSettings.apiKey) return
    setReportLoading(true)
    try {
      const response = await fetch(`/api/notion/v1/databases/${feedSettings.reportsDatabaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionSettings.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          sorts: [{ property: 'Date', direction: 'descending' }],
          page_size: 30
        })
      })
      if (!response.ok) { setReportLoading(false); return }
      const data = await response.json()
      const dates: string[] = []
      if (data.results.length > 0) {
        const latestPage = data.results[0]
        for (const page of data.results) {
          const dateProp = page.properties.Date
          if (dateProp?.date?.start) dates.push(dateProp.date.start)
        }
        setAvailableReportDates(dates)
        const blocksResponse = await fetch(`/api/notion/v1/blocks/${latestPage.id}/children`, {
          headers: {
            'Authorization': `Bearer ${notionSettings.apiKey}`,
            'Notion-Version': '2022-06-28',
          }
        })
        let body = ''
        if (blocksResponse.ok) {
          const blocksData = await blocksResponse.json()
          body = blocksData.results
            .map((block: any) => {
              if (block.type === 'paragraph') return block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || ''
              if (block.type === 'heading_1') return '# ' + (block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') || '')
              if (block.type === 'heading_2') return '## ' + (block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') || '')
              if (block.type === 'heading_3') return '### ' + (block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') || '')
              if (block.type === 'bulleted_list_item') return '- ' + (block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '')
              return ''
            })
            .filter(Boolean)
            .join('\n\n')
        }
        const titleProp = latestPage.properties.Title || latestPage.properties.Name ||
          Object.values(latestPage.properties).find((p: any) => p.type === 'title')
        const title = (titleProp as any)?.title?.[0]?.plain_text || 'Untitled Report'
        const dateProp = latestPage.properties.Date
        const reportDate = dateProp?.date?.start || new Date().toISOString().split('T')[0]
        setCurrentReport({ id: latestPage.id, title, date: reportDate, body })
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    }
    setReportLoading(false)
  }, [feedSettings.enabled, feedSettings.reportsDatabaseId, notionSettings.apiKey])

  // Agent tools
  const agentTools = {
    fetch_hacker_news: async () => {
      setAgentStatus('Fetching Hacker News...')
      const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      const storyIds = await response.json()
      const stories = await Promise.all(
        storyIds.slice(0, 10).map((id: number) =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
        )
      )
      return stories.map((s: any) => ({ title: s.title, url: s.url, score: s.score, comments: s.descendants }))
    },
    fetch_tech_news: async () => {
      setAgentStatus('Fetching Tech News...')
      if (!feedSettings.newsApiKey) return []
      const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&category=technology&pageSize=10&apiKey=${feedSettings.newsApiKey}`)
      const data = await response.json()
      return (data.articles || []).map((a: any) => ({ title: a.title, description: a.description, url: a.url, source: a.source?.name }))
    },
    fetch_rss_betakit: async () => {
      setAgentStatus('Fetching BetaKit RSS...')
      const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://betakit.com/feed/')}`)
      const data = await response.json()
      return (data.items || []).slice(0, 10).map((item: any) => ({ title: item.title, url: item.link, pubDate: item.pubDate }))
    },
    fetch_rss_techcrunch: async () => {
      setAgentStatus('Fetching TechCrunch RSS...')
      const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://techcrunch.com/feed/')}`)
      const data = await response.json()
      return (data.items || []).slice(0, 10).map((item: any) => ({ title: item.title, url: item.link, pubDate: item.pubDate }))
    },
    web_search: async (query: string) => {
      setAgentStatus(`Searching: "${query}"...`)
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
      const data = await response.json()
      const results: any[] = []
      if (data.Abstract) results.push({ type: 'abstract', title: data.Heading || query, text: data.Abstract, url: data.AbstractURL })
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 8)) {
          if (topic.Text) results.push({ type: 'result', title: topic.Text.split(' - ')[0], text: topic.Text, url: topic.FirstURL })
        }
      }
      try {
        const newsResponse = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`)}`)
        const newsData = await newsResponse.json()
        if (newsData.items) {
          for (const item of newsData.items.slice(0, 5)) {
            results.push({ type: 'news', title: item.title, text: item.description?.replace(/<[^>]*>/g, '') || '', url: item.link, pubDate: item.pubDate })
          }
        }
      } catch {}
      return results.length > 0 ? results : [{ type: 'no_results', text: 'No results found for this query' }]
    }
  }

  const toolDefinitions = [
    { type: 'function', function: { name: 'fetch_hacker_news', description: 'Fetch the latest top stories from Hacker News', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'fetch_tech_news', description: 'Fetch the latest technology news headlines', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'fetch_rss_betakit', description: 'Fetch the latest articles from BetaKit (Canadian tech news)', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'fetch_rss_techcrunch', description: 'Fetch the latest articles from TechCrunch', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'web_search', description: 'Search the web for information on a specific topic.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The search query to look up' } }, required: ['query'] } } }
  ]

  const generateAIReport = async () => {
    if (!feedSettings.openaiApiKey) { alert('Configure OpenAI API Key in Settings first'); return }
    setGeneratingReport(true)
    setGeneratedReport(null)
    setAgentStatus('Starting agent...')
    try {
      const sourceInstructions: string[] = []
      const sources = reportTemplate.sources.includes('all') ? ['hn', 'news', 'rss'] : reportTemplate.sources
      if (sources.includes('hn')) sourceInstructions.push('- Use fetch_hacker_news to get Hacker News stories')
      if (sources.includes('news')) sourceInstructions.push('- Use fetch_tech_news to get technology news')
      if (sources.includes('rss')) {
        sourceInstructions.push('- Use fetch_rss_betakit to get BetaKit articles')
        sourceInstructions.push('- Use fetch_rss_techcrunch to get TechCrunch articles')
      }
      if (reportTemplate.useSearch) sourceInstructions.push('- Use web_search to search the web for specific topics')
      let userPrompt = `Please fetch data from the sources and then create a report using this template:\n\n${reportTemplate.prompt}`
      if (reportTemplate.useSearch && reportTemplate.searchQuery) {
        userPrompt = `Research topic: "${reportTemplate.searchQuery}"\n\nUse web_search to find information about this topic, then check relevant news sources for coverage.\n\nCreate a report using this template:\n\n${reportTemplate.prompt}`
      }
      const systemPrompt = `You are an AI research agent. Your task is to gather information from various sources and create an insights report.\n\nAvailable tools:\n${sourceInstructions.join('\n')}\n\nInstructions:\n1. Call the relevant tools to fetch fresh data from the sources\n2. ${reportTemplate.useSearch ? 'If a search topic is provided, use web_search first to research it' : 'Gather data from all available sources'}\n3. After gathering all data, analyze and synthesize the information\n4. Create a report following the user's template\n\nAlways fetch fresh data using the tools before writing the report.`
      const messages: any[] = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      const availableTools = toolDefinitions.filter(tool => {
        const name = tool.function.name
        if (name === 'web_search' && reportTemplate.useSearch) return true
        if (sources.includes('hn') && name === 'fetch_hacker_news') return true
        if (sources.includes('news') && name === 'fetch_tech_news') return true
        if (sources.includes('rss') && (name === 'fetch_rss_betakit' || name === 'fetch_rss_techcrunch')) return true
        return false
      })
      let iterations = 0
      const maxIterations = 5
      while (iterations < maxIterations) {
        iterations++
        setAgentStatus(`Agent thinking... (step ${iterations})`)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${feedSettings.openaiApiKey}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages, tools: availableTools.length > 0 ? availableTools : undefined, tool_choice: availableTools.length > 0 ? 'auto' : undefined, temperature: 0.7, max_tokens: 3000 })
        })
        if (!response.ok) { const error = await response.json(); throw new Error(error.error?.message || 'API error') }
        const data = await response.json()
        const message = data.choices?.[0]?.message
        if (!message) throw new Error('No response from agent')
        messages.push(message)
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function.name as keyof typeof agentTools
            const tool = agentTools[toolName]
            if (tool) {
              try {
                let result
                if (toolName === 'web_search') {
                  const args = JSON.parse(toolCall.function.arguments || '{}')
                  result = await (tool as (query: string) => Promise<any>)(args.query || reportTemplate.searchQuery || '')
                } else {
                  result = await (tool as () => Promise<any>)()
                }
                messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
              } catch {
                messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: 'Failed to fetch data' }) })
              }
            }
          }
        } else {
          setAgentStatus('')
          setGeneratedReport(message.content || 'No content generated')
          break
        }
      }
      if (iterations >= maxIterations) { setAgentStatus(''); setGeneratedReport('Agent reached maximum iterations. Please try again.') }
    } catch (error) {
      console.error('Error in agent:', error)
      setAgentStatus('')
      alert('Failed to generate report: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setGeneratingReport(false)
  }

  // n8n webhook trigger
  const triggerN8nRefresh = async () => {
    if (!feedSettings.n8nWebhookUrl) { alert('Configure n8n Webhook URL in Settings first'); return }
    setN8nRefreshing(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (feedSettings.n8nWebhookSecret) headers['X-Webhook-Secret'] = feedSettings.n8nWebhookSecret
      const response = await fetch(feedSettings.n8nWebhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'refresh', timestamp: Date.now(), source: 'insights-panel' })
      })
      if (response.ok) {
        setTimeout(() => { fetchFeed(); setN8nRefreshing(false) }, 3000)
      } else {
        setN8nRefreshing(false)
      }
    } catch (error) {
      console.error('Error triggering n8n:', error)
      setN8nRefreshing(false)
    }
  }

  const handleRefreshClick = (e: React.MouseEvent) => {
    if (e.shiftKey && feedSettings.n8nWebhookUrl) {
      triggerN8nRefresh()
    } else {
      if (activeSource === 'report') {
        fetchReports()
      } else {
        fetchFeed()
      }
    }
  }

  // Helper to update a specific filter
  const updateFilter = (property: string, value: string) => {
    const existingFilters = notionSettings.filters.filter(f => f.property !== property)
    const newFilters = value === 'all'
      ? existingFilters
      : [...existingFilters, { property, value }]
    handleNotionSettingsChange({ ...notionSettings, filters: newFilters })
  }

  // Helper to get current filter value
  const getFilterValue = (property: string): string => {
    const filter = notionSettings.filters.find(f => f.property === property)
    return filter?.value || 'all'
  }

  // Filter dropdown toggle state
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
  const [feedFiltersOpen, setFeedFiltersOpen] = useState(false)

  // Toggle section visibility
  const toggleSection = (section: 'shortcuts' | 'todo' | 'news' | 'feed') => {
    const updated = { ...sectionsOpen, [section]: !sectionsOpen[section] }
    setSectionsOpen(updated)
    saveToStorage('sectionsOpen', updated)
  }

  // Fetch Notion todos on load and when settings change
  useEffect(() => {
    if (notionSettings.enabled) {
      fetchNotionTodos()
    }
  }, [notionSettings.enabled, notionSettings.apiKey, notionSettings.databaseId, notionSettings.sortBy, notionSettings.sortDirection, notionSettings.filters, fetchNotionTodos])

  // Fetch feed on load and when source changes
  useEffect(() => {
    if (sectionVisibility.feed) {
      fetchFeed()
    }
  }, [sectionVisibility.feed, fetchFeed])

  // Fetch reports when switching to report tab
  useEffect(() => {
    if (activeSource === 'report' && feedSettings.enabled && feedSettings.reportsDatabaseId) {
      fetchReports()
    }
  }, [activeSource, feedSettings.enabled, feedSettings.reportsDatabaseId, fetchReports])

  // Cmd+Shift key listener for shortcut hints
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes any active panel/modal
      if (e.key === 'Escape') {
        setSettingsOpen(false)
        setInfoOpen(false)
        setModalOpen(false)
        setFilterDropdownOpen(false)
        setTemplateModalOpen(false)
        setDateDropdownOpen(false)
        setLimitDropdownOpen(false)
      }
      // Show hints when Cmd+Shift is held
      if (e.metaKey && e.shiftKey) {
        setOptionHeld(true)
      }
      // Handle keyboard shortcuts when Cmd+Shift is held
      if (e.metaKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault()
            setSettingsOpen(prev => !prev)
            break
          case 'i':
            e.preventDefault()
            setInfoOpen(prev => !prev)
            break
          case 'a':
            e.preventDefault()
            setModalOpen(true)
            break
          case 'f':
            e.preventDefault()
            setFilterDropdownOpen(prev => !prev)
            break
          case 'r':
            e.preventDefault()
            fetchNews()
            if (notionSettings.enabled) fetchNotionTodos()
            break
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      // Hide hints when either Cmd or Shift is released
      if (!e.metaKey || !e.shiftKey) {
        setOptionHeld(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [notionSettings.enabled])

  // Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const hours24 = now.getHours()
      const hours12 = hours24 % 12 || 12
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const period = hours24 >= 12 ? 'pm' : 'am'
      setTime(`${hours12}:${minutes} ${period}`)

      const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
      setDate(now.toLocaleDateString('en-US', options))
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch news
  const fetchNews = async () => {
    setNewsLoading(true)
    try {
      const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      const storyIds = await response.json()
      const stories = await Promise.all(
        storyIds.slice(0, 10).map((id: number) =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
        )
      )
      setNews(stories.filter(Boolean))
    } catch (error) {
      console.error('Error fetching news:', error)
    }
    setNewsLoading(false)
  }

  useEffect(() => {
    fetchNews()
  }, [])

  // Resource monitoring
  useEffect(() => {
    if (!infoOpen) return

    let frameCount = 0
    let lastTime = performance.now()
    let animationId: number

    const updateResources = async () => {
      frameCount++
      const now = performance.now()

      if (now - lastTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastTime))
        frameCount = 0
        lastTime = now

        let memory = 0
        // Try modern API first (cross-origin isolated required)
        if ((performance as any).measureUserAgentSpecificMemory) {
          try {
            const result = await (performance as any).measureUserAgentSpecificMemory()
            memory = Math.round(result.bytes / 1024 / 1024)
          } catch {
            // Fall back to Chrome-only API
            memory = (performance as any).memory?.usedJSHeapSize
              ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
              : 0
          }
        } else {
          // Chrome-only fallback
          memory = (performance as any).memory?.usedJSHeapSize
            ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
            : 0
        }
        const domNodes = document.querySelectorAll('*').length

        setResourceInfo({ memory, domNodes, fps })
      }

      animationId = requestAnimationFrame(updateResources)
    }

    animationId = requestAnimationFrame(updateResources)
    return () => cancelAnimationFrame(animationId)
  }, [infoOpen])

  // Shortcuts
  const openShortcut = (shortcut: Shortcut) => {
    switch (shortcut.type) {
      case 'link':
        window.open(shortcut.url, '_blank')
        break
      case 'app':
        window.location.href = shortcut.url
        break
      case 'file':
        window.location.href = `file://${shortcut.url}`
        break
      case 'command':
        alert(`Command to run:\n${shortcut.url}\n\nNote: Commands cannot be executed directly from a web browser.`)
        break
    }
  }

  const deleteShortcut = (id: number) => {
    const updated = shortcuts.filter(s => s.id !== id)
    setShortcuts(updated)
    saveToStorage('shortcuts', updated)
  }

  const addShortcut = (e: FormEvent) => {
    e.preventDefault()
    const shortcut: Shortcut = {
      id: Date.now(),
      name: newShortcut.name,
      type: newShortcut.type as Shortcut['type'],
      url: newShortcut.url,
      icon: newShortcut.icon || newShortcut.name.charAt(0).toUpperCase(),
    }
    const updated = [...shortcuts, shortcut]
    setShortcuts(updated)
    saveToStorage('shortcuts', updated)
    setNewShortcut({ name: '', type: 'link', url: '', icon: '' })
    setModalOpen(false)
  }

  // Starred items
  const toggleStarred = (itemId: string) => {
    const updated = starredItems.includes(itemId)
      ? starredItems.filter(id => id !== itemId)
      : [...starredItems, itemId]
    setStarredItems(updated)
    saveToStorage('starredItems', updated)
  }

  // Todos
  const addTodo = async () => {
    if (!todoInput.trim()) return

    if (notionSettings.enabled) {
      const pageId = await addNotionTodo(todoInput.trim())
      if (pageId) {
        const todo: Todo = { id: pageId, text: todoInput.trim(), completed: false, notionPageId: pageId }
        setTodos([todo, ...todos])
      }
    } else {
      const todo: Todo = { id: Date.now().toString(), text: todoInput.trim(), completed: false }
      const updated = [todo, ...todos]
      setTodos(updated)
      saveToStorage('todos', updated)
    }
    setTodoInput('')
  }

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    const newCompleted = !todo.completed

    if (notionSettings.enabled && todo.notionPageId) {
      const success = await toggleNotionTodo(todo.notionPageId, newCompleted)
      if (success) {
        const updated = todos.map(t => t.id === id ? { ...t, completed: newCompleted } : t)
        setTodos(updated)
      }
    } else {
      const updated = todos.map(t => t.id === id ? { ...t, completed: newCompleted } : t)
      setTodos(updated)
      saveToStorage('todos', updated)
    }
  }

  const deleteTodo = (id: string) => {
    const updated = todos.filter(t => t.id !== id)
    setTodos(updated)
    if (!notionSettings.enabled) {
      saveToStorage('todos', updated)
    }
  }

  return (
    <div className="app">
      {/* Unsplash Background */}
      {shaderSettings.unsplashEnabled && shaderSettings.unsplashUrl && (
        <div
          className="unsplash-background"
          style={{
            backgroundImage: `url(${shaderSettings.unsplashUrl})`,
          }}
        />
      )}
      {/* Shader Background */}
      <div className="shader-background" style={{ opacity: shaderSettings.unsplashEnabled ? 0.3 : 1 }}>
        <Shader style={{ width: '100%', height: '100%' }}>
          <Swirl
            colorA={shaderSettings.swirlColorA}
            colorB={shaderSettings.swirlColorB}
            speed={shaderSettings.swirlSpeed}
            detail={shaderSettings.swirlDetail}
            blend={shaderSettings.swirlBlend}
            coarseX={40}
            coarseY={75}
            mediumX={40}
            mediumY={35}
            fineX={25}
            fineY={25}
            opacity={shaderSettings.swirlOpacity}
          />
          {!shaderSettings.unsplashEnabled && (
            <ChromaFlow
              baseColor={shaderSettings.chromaBaseColor}
              upColor={shaderSettings.chromaUpColor}
              downColor={shaderSettings.chromaDownColor}
              leftColor={shaderSettings.chromaLeftColor}
              rightColor={shaderSettings.chromaRightColor}
              intensity={shaderSettings.chromaIntensity}
              radius={shaderSettings.chromaRadius}
              momentum={shaderSettings.chromaMomentum}
              maskType="alpha"
              opacity={1}
            />
          )}
        </Shader>
        <div className="shader-overlay" />
      </div>

      {/* Grain Overlay */}
      <GrainOverlay />

      {/* Settings Button */}
      <button className="settings-toggle" onClick={() => setSettingsOpen(!settingsOpen)}>
        {settingsOpen ? 'x' : '\u2699'}
        {optionHeld && <span className="shortcut-hint">S</span>}
      </button>

      {/* Info Button */}
      <button className="info-toggle" onClick={() => setInfoOpen(!infoOpen)}>
        {infoOpen ? 'x' : 'i'}
        {optionHeld && <span className="shortcut-hint">I</span>}
      </button>

      {/* Settings Page */}
      {settingsOpen && (
        <SettingsPage
          settings={shaderSettings}
          notionSettings={notionSettings}
          feedSettings={feedSettings}
          sectionVisibility={sectionVisibility}
          todoLimit={todoLimit}
          onSettingsChange={handleSettingsChange}
          onNotionSettingsChange={handleNotionSettingsChange}
          onFeedSettingsChange={handleFeedSettingsChange}
          onSectionVisibilityChange={handleSectionVisibilityChange}
          onTodoLimitChange={(limit) => { setTodoLimit(limit); saveToStorage('todoLimit', limit); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Info Panel */}
      {infoOpen && (
        <div className="info-panel">
          <div className="info-header">
            <h2>Resources</h2>
            <button className="info-close" onClick={() => setInfoOpen(false)}>x</button>
          </div>
          <div className="info-content">
            <div className="info-row">
              <span className="info-label">FPS</span>
              <span className="info-value">{resourceInfo.fps}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Memory</span>
              <span className="info-value">{resourceInfo.memory > 0 ? `${resourceInfo.memory} MB` : 'N/A'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">DOM Nodes</span>
              <span className="info-value">{resourceInfo.domNodes}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        <div
          className={`container ${shaderSettings.contentBackdropOpacity > 0 ? 'backdrop' : ''} ${!shaderSettings.showDividers ? 'no-dividers' : ''}`}
          style={shaderSettings.contentBackdropOpacity > 0 ? { '--backdrop-opacity': shaderSettings.contentBackdropOpacity } as React.CSSProperties : undefined}
        >
          <header>
            <div className="greeting">{shaderSettings.greeting}</div>
            <div className="time">{time}</div>
            <div className="date">{date}</div>
          </header>

          <main>
            {/* Shortcuts */}
            <section>
              <div className="section-header">
                <h2>Shortcuts</h2>
                <button className="section-toggle" onClick={() => toggleSection('shortcuts')}>
                  {sectionsOpen.shortcuts ? '\u2212' : '+'}
                </button>
              </div>
              <div className={`section-collapse ${sectionsOpen.shortcuts ? 'open' : ''}`}>
                <div className="section-collapse-inner">
                  <div className="shortcuts-grid">
                    {shortcuts.map(shortcut => (
                      <div
                        key={shortcut.id}
                        className="shortcut-item"
                        onClick={() => openShortcut(shortcut)}
                      >
                        <div className="shortcut-icon">
                          {shortcut.icon.startsWith('http') ? (
                            <img src={shortcut.icon} alt={shortcut.name} />
                          ) : (
                            shortcut.icon
                          )}
                        </div>
                        <span className="shortcut-name">{shortcut.name}</span>
                        <button
                          className="shortcut-delete"
                          onClick={(e) => { e.stopPropagation(); deleteShortcut(shortcut.id) }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="add-btn" onClick={() => setModalOpen(true)}>
                    + Add Shortcut
                    {optionHeld && <span className="shortcut-hint">A</span>}
                  </button>
                </div>
              </div>
            </section>

            {/* Todo */}
            <section>
              <div className="section-header">
                <div className="section-header-left">
                  <h2>Todo {notionSettings.enabled && <span className="notion-badge">Notion</span>}</h2>
                  {notionSettings.enabled && (
                    <button
                      className="refresh-btn"
                      onClick={fetchNotionTodos}
                      style={{ visibility: optionHeld ? 'visible' : 'hidden' }}
                    >
                      Refresh
                      <span className="shortcut-hint">R</span>
                    </button>
                  )}
                </div>
                <button className="section-toggle" onClick={() => toggleSection('todo')}>
                  {sectionsOpen.todo ? '\u2212' : '+'}
                </button>
              </div>
              <div className={`section-collapse ${sectionsOpen.todo ? 'open' : ''}`}>
                <div className="section-collapse-inner">
              <div className="todo-content">
              <div className="todo-header">
                {notionSettings.enabled && (
                  <div className="todo-controls">
                    <div className={`date-dropdown ${dateDropdownOpen ? 'open' : ''}`}>
                      <button
                        className="date-dropdown-btn"
                        onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                      >
                        {todoDateRange === 'all' ? 'All' : todoDateRange === 'today' ? 'Today' : todoDateRange === 'week' ? 'Week' : 'Month'}
                      </button>
                      {dateDropdownOpen && (
                        <div className="date-dropdown-content">
                          <button
                            className={`date-option ${todoDateRange === 'all' ? 'active' : ''}`}
                            onClick={() => { setTodoDateRange('all'); setDateDropdownOpen(false); }}
                          >
                            All
                          </button>
                          <button
                            className={`date-option ${todoDateRange === 'today' ? 'active' : ''}`}
                            onClick={() => { setTodoDateRange('today'); setDateDropdownOpen(false); }}
                          >
                            Today
                          </button>
                          <button
                            className={`date-option ${todoDateRange === 'week' ? 'active' : ''}`}
                            onClick={() => { setTodoDateRange('week'); setDateDropdownOpen(false); }}
                          >
                            Week
                          </button>
                          <button
                            className={`date-option ${todoDateRange === 'month' ? 'active' : ''}`}
                            onClick={() => { setTodoDateRange('month'); setDateDropdownOpen(false); }}
                          >
                            Month
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={`filter-dropdown ${filterDropdownOpen ? 'open' : ''}`}>
                      <button
                        className="filter-dropdown-btn"
                        onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                      >
                        Filter {notionSettings.filters.length > 0 && `(${notionSettings.filters.length})`}
                        {optionHeld && <span className="shortcut-hint">F</span>}
                      </button>
                      {filterDropdownOpen && (
                        <div className="filter-dropdown-content">
                          <div className="filter-grid">
                            <div className="filter-column">
                              <label>Status</label>
                              <select
                                value={getFilterValue('status')}
                                onChange={(e) => updateFilter('status', e.target.value)}
                              >
                                <option value="all">All</option>
                                <option value="Not Started">Not Started</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </div>
                            <div className="filter-column">
                              <label>Type</label>
                              <select
                                value={getFilterValue('Type')}
                                onChange={(e) => updateFilter('Type', e.target.value)}
                              >
                                <option value="all">All</option>
                                <option value="Task">Task</option>
                                <option value="Bug">Bug</option>
                                <option value="Feature">Feature</option>
                                <option value="Idea">Idea</option>
                              </select>
                            </div>
                            <div className="filter-column">
                              <label>What</label>
                              <select
                                value={getFilterValue('What')}
                                onChange={(e) => updateFilter('What', e.target.value)}
                              >
                                <option value="all">All</option>
                                <option value="has_value">Has Value</option>
                                <option value="is_empty">Is Empty</option>
                              </select>
                            </div>
                            <div className="filter-column">
                              <label>Sort By</label>
                              <select
                                value={notionSettings.sortBy}
                                onChange={(e) => handleNotionSettingsChange({ ...notionSettings, sortBy: e.target.value })}
                              >
                                <option value="Date">Date</option>
                                <option value="Name">Name</option>
                                <option value="status">Status</option>
                                <option value="Type">Type</option>
                                <option value="Created time">Created</option>
                              </select>
                            </div>
                            <div className="filter-column">
                              <label>Direction</label>
                              <select
                                value={notionSettings.sortDirection}
                                onChange={(e) => handleNotionSettingsChange({ ...notionSettings, sortDirection: e.target.value as 'ascending' | 'descending' })}
                              >
                                <option value="ascending">Ascending</option>
                                <option value="descending">Descending</option>
                              </select>
                            </div>
                          </div>
                          {notionSettings.filters.length > 0 && (
                            <button
                              className="clear-filters-btn"
                              onClick={() => handleNotionSettingsChange({ ...notionSettings, filters: [] })}
                            >
                              Clear Filters
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="todo-input-wrapper">
                <input
                  type="text"
                  placeholder="Add a task..."
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                />
                <button onClick={addTodo}>Add</button>
              </div>
              {todosLoading && filteredTodos.length === 0 ? (
                <p className="loading">Loading todos from Notion...</p>
              ) : (
                <ul className="todo-list" style={todoLimit > 0 ? { maxHeight: `${todoLimit * 50}px` } : undefined}>
                  {filteredTodos.map(todo => (
                    <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                      <div className="todo-checkbox" onClick={() => toggleTodo(todo.id)} />
                      <span className="todo-text">{todo.text}</span>
                      {todo.dueDate && (
                        <span className="todo-date">{new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                      <button className="todo-delete" onClick={() => deleteTodo(todo.id)}>x</button>
                    </li>
                  ))}
                </ul>
              )}
              </div>
                </div>
              </div>
            </section>

            {/* Feed */}
            {sectionVisibility.feed && (
            <section className="feed-section">
              <div className="section-header">
                <div className="section-header-left">
                  <h2>Feed</h2>
                  <button
                    className={`refresh-btn ${n8nRefreshing ? 'loading' : ''}`}
                    onClick={handleRefreshClick}
                    title={feedSettings.n8nWebhookUrl ? 'Click to refresh from Notion. Shift+Click to trigger n8n pipeline.' : 'Refresh feed'}
                    style={{ visibility: optionHeld ? 'visible' : 'hidden' }}
                  >
                    {n8nRefreshing ? 'Syncing...' : 'Refresh'}
                    <span className="shortcut-hint">R</span>
                  </button>
                </div>
                <button className="section-toggle" onClick={() => toggleSection('feed')}>
                  {sectionsOpen.feed ? '\u2212' : '+'}
                </button>
              </div>

              <div className={`section-collapse ${sectionsOpen.feed ? 'open' : ''}`}>
                <div className="section-collapse-inner">
              {/* Feed Controls Row */}
              <div className="feed-controls-row">
                {/* Filter Toggle Button */}
                <button
                  className={`filter-toggle-btn ${feedFiltersOpen ? 'active' : ''}`}
                  onClick={() => setFeedFiltersOpen(!feedFiltersOpen)}
                >
                  Filter
                </button>

                {/* Report Toggle Button */}
                <button
                  className={`report-toggle-btn ${activeSource === 'report' ? 'active' : ''}`}
                  onClick={() => setActiveSource(activeSource === 'report' ? 'all' : 'report')}
                >
                  {activeSource === 'report' ? 'Back to Feed' : 'Generate Report'}
                </button>

                {/* Source Tabs */}
                {activeSource !== 'report' && feedFiltersOpen && (
                <div className="source-tabs">
                {(['all', 'starred', 'hn', 'news', 'pitchbook', 'rss', 'linkedin'] as FeedSource[]).map(source => (
                  <button
                    key={source}
                    className={`source-tab ${activeSource === source ? 'active' : ''} ${source === 'starred' && starredItems.length > 0 ? 'has-items' : ''}`}
                    onClick={() => setActiveSource(source)}
                  >
                    {source === 'all' ? 'All' :
                     source === 'starred' ? `Starred${starredItems.length > 0 ? ` (${starredItems.length})` : ''}` :
                     source === 'hn' ? 'HN' :
                     source === 'pitchbook' ? 'PB' :
                     source === 'rss' ? 'RSS' :
                     source === 'linkedin' ? 'LI' :
                     source === 'news' ? 'News' : 'PH'}
                  </button>
                ))}
              </div>
              )}

              {/* Feed Filters Row */}
              {activeSource !== 'report' && feedFiltersOpen && (
                <div className="feed-filters-row">
                  {/* Date Range Toggle */}
                  <div className="date-toggle">
                    <button
                      className={`date-toggle-btn ${dateRange === 'today' ? 'active' : ''}`}
                      onClick={() => setDateRange('today')}
                    >
                      Today
                    </button>
                    <button
                      className={`date-toggle-btn ${dateRange === 'week' ? 'active' : ''}`}
                      onClick={() => setDateRange('week')}
                    >
                      Week
                    </button>
                    <button
                      className={`date-toggle-btn ${dateRange === 'month' ? 'active' : ''}`}
                      onClick={() => setDateRange('month')}
                    >
                      Month
                    </button>
                    <button
                      className={`date-toggle-btn ${dateRange === 'custom' ? 'active' : ''}`}
                      onClick={() => setDateRange('custom')}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Custom Date Inputs */}
                  {dateRange === 'custom' && (
                    <div className="custom-date-inputs">
                      <input
                        type="date"
                        value={customDateStart}
                        onChange={(e) => setCustomDateStart(e.target.value)}
                        placeholder="Start date"
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={customDateEnd}
                        onChange={(e) => setCustomDateEnd(e.target.value)}
                        placeholder="End date"
                      />
                    </div>
                  )}

                  {/* Sort Toggle */}
                  <div className="sort-toggle">
                    <button
                      className={`sort-toggle-btn ${feedSortBy === 'date' ? 'active' : ''}`}
                      onClick={() => setFeedSortBy('date')}
                    >
                      Recent
                    </button>
                    <button
                      className={`sort-toggle-btn ${feedSortBy === 'score' ? 'active' : ''}`}
                      onClick={() => setFeedSortBy('score')}
                    >
                      Top
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="feed-search">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={feedSearchQuery}
                      onChange={(e) => setFeedSearchQuery(e.target.value)}
                    />
                    {feedSearchQuery && (
                      <button className="feed-search-clear" onClick={() => setFeedSearchQuery('')}>
                        x
                      </button>
                    )}
                  </div>

                  {/* Score Threshold Filter */}
                  <div className="score-filter">
                    <label>Min Score: {minScore}</label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                    />
                  </div>

                  {/* Theme Filter */}
                  {availableThemes.length > 0 && (
                    <div className="theme-filter">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value && !selectedThemes.includes(e.target.value)) {
                            setSelectedThemes([...selectedThemes, e.target.value])
                          }
                        }}
                      >
                        <option value="">Themes{selectedThemes.length > 0 ? ` (${selectedThemes.length})` : ''}</option>
                        {availableThemes.filter(t => !selectedThemes.includes(t)).map(theme => (
                          <option key={theme} value={theme}>{theme}</option>
                        ))}
                      </select>
                      {selectedThemes.length > 0 && (
                        <div className="selected-themes">
                          {selectedThemes.map(theme => (
                            <span key={theme} className="selected-theme-tag">
                              {theme}
                              <button onClick={() => setSelectedThemes(selectedThemes.filter(t => t !== theme))}>x</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>

              {/* RSS Source Filter */}
              {activeSource === 'rss' && feedFiltersOpen && (
                <div className="rss-source-tabs">
                  {['all', 'BetaKit', 'TechCrunch'].map(source => (
                    <button
                      key={source}
                      className={`rss-source-tab ${rssFilter === source ? 'active' : ''}`}
                      onClick={() => setRssFilter(source)}
                    >
                      {source === 'all' ? 'All' : source}
                    </button>
                  ))}
                </div>
              )}

              {/* Feed List */}
              {activeSource !== 'report' && (
                <div className="feed-container">
                  {feedLoading ? (
                    <p className="loading">Loading feed...</p>
                  ) : filteredFeedItems.length === 0 ? (
                    <p className="loading">No items found</p>
                  ) : (
                    <>
                    {paginatedFeedItems.map(item => (
                      <div
                        key={item.id}
                        className="feed-item"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        <button
                          className={`star-btn ${starredItems.includes(item.id) ? 'starred' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleStarred(item.id)
                          }}
                          title={starredItems.includes(item.id) ? 'Remove from starred' : 'Add to starred'}
                        >
                          {starredItems.includes(item.id) ? '*' : '-'}
                        </button>
                        <div className="feed-item-source">
                          {item.source === 'hn' ? 'HN' :
                           item.source === 'pitchbook' ? 'PB' :
                           item.source === 'rss' ? 'RSS' :
                           item.source === 'linkedin' ? 'LI' :
                           'News'}
                        </div>
                        <div className="feed-item-title">{item.title}</div>
                        <div className="feed-item-meta">
                          {item.score !== undefined && `${item.score} pts`}
                          {item.comments !== undefined && ` | ${item.comments} comments`}
                          {item.relevanceScore !== undefined && item.relevanceScore > 0 && (
                            <span className={`score-badge score-${item.relevanceScore >= 5 ? 'high' : item.relevanceScore >= 3 ? 'mid' : 'low'}`}>
                              Score: {item.relevanceScore}
                            </span>
                          )}
                          {item.themes && item.themes.length > 0 && (
                            <span className="theme-tags">
                              {item.themes.slice(0, 2).map(theme => (
                                <span key={theme} className="theme-tag">{theme}</span>
                              ))}
                            </span>
                          )}
                          {item.company && <span className="company-tag">{item.company}</span>}
                          <span className="feed-time">{getTimeAgo(Math.floor(new Date(item.date).getTime() / 1000))}</span>
                        </div>
                      </div>
                    ))}
                    {visibleFeedCount < filteredFeedItems.length && (
                      <button
                        className="load-more-btn"
                        onClick={() => setVisibleFeedCount(prev => prev + 20)}
                      >
                        Load More ({filteredFeedItems.length - visibleFeedCount} remaining)
                      </button>
                    )}
                    </>
                  )}
                </div>
              )}

              {/* Report View */}
              {activeSource === 'report' && (
                <div className="report-container">
                  {/* AI Report Generator */}
                  <div className="ai-report-section">
                    <div className="ai-report-header">
                      <h3>Generate Report</h3>
                      <button
                        className="template-edit-btn"
                        onClick={() => setTemplateModalOpen(true)}
                      >
                        Customize
                      </button>
                    </div>

                    {/* Quick Preset Selector */}
                    <div className="quick-presets">
                      {allPresets.map(preset => (
                        <div key={preset.id} className={`quick-preset-item ${reportTemplate.id === preset.id ? 'active' : ''}`}>
                          <button
                            className="quick-preset-btn"
                            onClick={() => handleTemplateChange({ ...preset })}
                          >
                            {preset.name}
                          </button>
                          {isCustomPreset(preset.id) && (
                            <button
                              className="quick-preset-delete"
                              onClick={(e) => { e.stopPropagation(); deleteCustomPreset(preset.id); }}
                              title="Delete preset"
                            >
                              x
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        className="quick-preset-btn add-preset-btn"
                        onClick={saveAsNewPreset}
                        title="Save current as new preset"
                      >
                        +
                      </button>
                    </div>
                    {reportTemplate.useSearch && (
                      <div className="search-query-input">
                        <input
                          type="text"
                          placeholder="Enter research topic..."
                          value={reportTemplate.searchQuery || ''}
                          onChange={(e) => handleTemplateChange({ ...reportTemplate, searchQuery: e.target.value })}
                        />
                      </div>
                    )}
                    <button
                      className={`generate-report-btn ${generatingReport ? 'loading' : ''}`}
                      onClick={generateAIReport}
                      disabled={generatingReport || !feedSettings.openaiApiKey || (reportTemplate.useSearch && !reportTemplate.searchQuery)}
                    >
                      {generatingReport ? 'Generating...' : reportTemplate.useSearch ? 'Research Topic' : 'Run Agent'}
                    </button>
                    {agentStatus && (
                      <div className="agent-status">
                        <span className="agent-status-dot"></span>
                        <span className="agent-status-text">{agentStatus}</span>
                      </div>
                    )}
                    {!feedSettings.openaiApiKey && (
                      <p className="api-key-warning">Configure OpenAI API Key in Settings</p>
                    )}
                  </div>

                  {/* Generated Report */}
                  {generatedReport && (
                    <div className="generated-report">
                      <div className="generated-report-header">
                        <h3>Generated Report</h3>
                        <span className="report-timestamp">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div
                        className="report-body"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedReport) }}
                      />
                    </div>
                  )}

                  {/* Notion Reports */}
                  {feedSettings.enabled && feedSettings.reportsDatabaseId && (
                    <div className="notion-reports-section">
                      <h3>Saved Reports</h3>
                      {reportLoading ? (
                        <p className="loading">Loading report...</p>
                      ) : !currentReport ? (
                        <p className="loading">No saved reports found</p>
                      ) : (
                        <>
                          <div className="report-header">
                            <h4 className="report-title">{currentReport.title}</h4>
                            <div className="report-date">{currentReport.date}</div>
                            {availableReportDates.length > 1 && (
                              <select
                                className="report-date-select"
                                value={currentReport.date}
                                onChange={(e) => {
                                  console.log('Switch to date:', e.target.value)
                                }}
                              >
                                {availableReportDates.map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div
                            className="report-body"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(currentReport.body) }}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
                </div>
              </div>
            </section>
            )}
          </main>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal ${modalOpen ? 'active' : ''}`} onClick={() => setModalOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Add Shortcut</h3>
          <form onSubmit={addShortcut} autoComplete="off">
            <label>
              Title
              <input
                type="text"
                name="shortcut-title"
                value={newShortcut.name}
                onChange={(e) => setNewShortcut({ ...newShortcut, name: e.target.value })}
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                required
              />
            </label>
            <label>
              Type
              <select
                value={newShortcut.type}
                onChange={(e) => setNewShortcut({ ...newShortcut, type: e.target.value })}
              >
                <option value="link">Website Link</option>
                <option value="app">App Launcher</option>
                <option value="file">File/Folder</option>
                <option value="command">Custom Command</option>
              </select>
            </label>
            <label>
              URL / Path / Command
              <input
                type="text"
                value={newShortcut.url}
                onChange={(e) => setNewShortcut({ ...newShortcut, url: e.target.value })}
                placeholder="https://... or /path/to/file"
                required
              />
            </label>
            <label>
              Icon (emoji or URL)
              <input
                type="text"
                value={newShortcut.icon}
                onChange={(e) => setNewShortcut({ ...newShortcut, icon: e.target.value })}
                placeholder="e.g. G or https://..."
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="cancel" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="save">Save</button>
            </div>
          </form>
        </div>
      </div>

      {/* Template Edit Modal */}
      <div className={`modal ${templateModalOpen ? 'active' : ''}`} onClick={() => setTemplateModalOpen(false)}>
        <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Edit Report Template</h3>
          <form onSubmit={(e) => { e.preventDefault(); setTemplateModalOpen(false); }}>
            {/* Template Presets */}
            <div className="template-presets">
              <span className="template-presets-label">Presets</span>
              <div className="template-presets-grid">
                {allPresets.map(preset => (
                  <div key={preset.id} className="template-preset-item">
                    <button
                      type="button"
                      className={`template-preset-btn ${reportTemplate.id === preset.id ? 'active' : ''}`}
                      onClick={() => handleTemplateChange({ ...preset })}
                    >
                      {preset.name}
                    </button>
                    {isCustomPreset(preset.id) && (
                      <button
                        type="button"
                        className="template-preset-delete"
                        onClick={() => deleteCustomPreset(preset.id)}
                        title="Delete preset"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label>
              Template Name
              <input
                type="text"
                value={reportTemplate.name}
                onChange={(e) => handleTemplateChange({ ...reportTemplate, name: e.target.value })}
              />
            </label>

            {/* Web Search Toggle */}
            <div className="search-toggle-section">
              <button
                type="button"
                className={`search-toggle-btn ${reportTemplate.useSearch ? 'active' : ''}`}
                onClick={() => handleTemplateChange({ ...reportTemplate, useSearch: !reportTemplate.useSearch })}
              >
                <span className="toggle-label">
                  <span className="toggle-title">Web Search</span>
                  <span className="toggle-hint">Agent can search the web for specific topics</span>
                </span>
                <span className="toggle-status">{reportTemplate.useSearch ? 'On' : 'Off'}</span>
              </button>
            </div>

            <div className="source-selector-section">
              <span className="source-selector-label">Sources</span>
              <div className="source-selector-grid">
                <button
                  type="button"
                  className={`source-selector-btn ${reportTemplate.sources.includes('all') ? 'active' : ''}`}
                  onClick={() => handleTemplateChange({ ...reportTemplate, sources: ['all'] })}
                >
                  All
                </button>
                {([
                  { key: 'hn', label: 'HN', full: 'Hacker News' },
                  { key: 'news', label: 'News', full: 'News' },
                  { key: 'rss', label: 'RSS', full: 'RSS Feeds' },
                  { key: 'pitchbook', label: 'PB', full: 'PitchBook' },
                  { key: 'linkedin', label: 'LI', full: 'LinkedIn' },
                ] as { key: FeedSource; label: string; full: string }[]).map(source => (
                  <button
                    key={source.key}
                    type="button"
                    className={`source-selector-btn ${!reportTemplate.sources.includes('all') && reportTemplate.sources.includes(source.key) ? 'active' : ''} ${reportTemplate.sources.includes('all') ? 'disabled' : ''}`}
                    onClick={() => {
                      if (reportTemplate.sources.includes('all')) {
                        handleTemplateChange({ ...reportTemplate, sources: [source.key] })
                      } else if (reportTemplate.sources.includes(source.key)) {
                        const newSources = reportTemplate.sources.filter(s => s !== source.key)
                        handleTemplateChange({ ...reportTemplate, sources: newSources.length ? newSources : ['all'] })
                      } else {
                        handleTemplateChange({ ...reportTemplate, sources: [...reportTemplate.sources, source.key] })
                      }
                    }}
                    title={source.full}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Prompt Template
              <textarea
                value={reportTemplate.prompt}
                onChange={(e) => handleTemplateChange({ ...reportTemplate, prompt: e.target.value })}
                rows={10}
                placeholder="Enter the prompt that will be used to generate reports..."
              />
            </label>
            <div className="template-help">
              <p>The prompt will be sent to OpenAI with your feed items. Use markdown formatting instructions for best results.</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="reset-template"
                onClick={() => handleTemplateChange(defaultReportTemplate)}
              >
                Reset
              </button>
              <button
                type="button"
                className="save-preset-btn"
                onClick={() => { saveAsNewPreset(); setTemplateModalOpen(false); }}
              >
                Save as Preset
              </button>
              <button type="submit" className="save">Done</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
