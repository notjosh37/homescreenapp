import { useState, useMemo, useCallback, useEffect } from 'react'
import { useFeed, useSearch } from '../hooks/useFeed'
import type { FeedItem, FeedSource } from '../types'
import { isSupabaseConfigured } from '../services/supabase'

interface FeedSectionProps {
  starredItems: string[]
  toggleStarred: (id: string) => void
  getTimeAgo: (timestamp: number) => string
  feedFiltersOpen: boolean
  setFeedFiltersOpen: (open: boolean) => void
  /** Callback when items are loaded (for parent state sync) */
  onItemsLoaded?: (items: FeedItem[]) => void
}

const SOURCE_TABS: { id: FeedSource; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hn', label: 'HN' },
  { id: 'github', label: 'GitHub' },
  { id: 'yc', label: 'YC' },
  { id: 'arxiv', label: 'ArXiv' },
  { id: 'rss', label: 'RSS' },
  { id: 'starred', label: 'Starred' },
]

const RSS_SOURCES = ['all', 'BetaKit', 'TechCrunch']

export function FeedSection({
  starredItems,
  toggleStarred,
  getTimeAgo,
  feedFiltersOpen,
  setFeedFiltersOpen,
  onItemsLoaded,
}: FeedSectionProps) {
  const [activeSource, setActiveSource] = useState<FeedSource>('all')
  const [rssFilter, setRssFilter] = useState('all')
  const [dateRange, setDateRange] = useState('week')
  const [customDateStart, setCustomDateStart] = useState('')
  const [customDateEnd, setCustomDateEnd] = useState('')
  const [feedSortBy, setFeedSortBy] = useState<'date' | 'score'>('date')
  const [minScore, setMinScore] = useState(0)
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [semanticSearch, setSemanticSearch] = useState(false)
  const [visibleCount, setVisibleCount] = useState(20)

  // Use Supabase feed hook
  const {
    items: feedItems,
    loading: feedLoading,
    error: feedError,
    hasMore,
    loadMore,
    refresh,
    toggleStar,
  } = useFeed({
    source: activeSource === 'starred' ? 'all' : activeSource,
    limit: 50,
  })

  // Use search hook
  const {
    results: searchResults,
    loading: searchLoading,
    search,
    clear: clearSearch,
  } = useSearch()

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      search(query, semanticSearch)
    } else {
      clearSearch()
    }
  }, [search, clearSearch, semanticSearch])

  // Get items to display (search results or feed items)
  const displayItems = searchQuery.trim() ? searchResults : feedItems

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    let items = [...displayItems]

    // Filter by starred items
    if (activeSource === 'starred') {
      items = items.filter(item => starredItems.includes(item.id))
    }

    // RSS company filter
    if (activeSource === 'rss' && rssFilter !== 'all') {
      items = items.filter(item => item.company === rssFilter)
    }

    // Date range filter
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
          endDate.setHours(23, 59, 59, 999)
          if (itemDate > endDate) return false
        }
        return true
      })
    }

    // Minimum score filter
    if (minScore > 0) {
      items = items.filter(item => {
        const score = item.score || item.relevanceScore || 0
        return score >= minScore
      })
    }

    // Theme filter
    if (selectedThemes.length > 0) {
      items = items.filter(item =>
        item.themes?.some(t => selectedThemes.includes(t))
      )
    }

    // Sort
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
  }, [displayItems, activeSource, starredItems, rssFilter, dateRange, customDateStart, customDateEnd, minScore, selectedThemes, feedSortBy])

  // Paginated items
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount)
  }, [filteredItems, visibleCount])

  // Available themes from items
  const availableThemes = useMemo(() => {
    const themes = new Set<string>()
    displayItems.forEach(item => {
      item.themes?.forEach(t => themes.add(t))
    })
    return Array.from(themes).sort()
  }, [displayItems])

  // Reset visible count when source changes
  useEffect(() => {
    setVisibleCount(20)
  }, [activeSource])

  // Handle star toggle
  const handleToggleStar = useCallback(async (item: FeedItem) => {
    toggleStarred(item.id)
    if (item.dbId) {
      await toggleStar(item.dbId)
    }
  }, [toggleStarred, toggleStar])

  const getSourceLabel = (source: FeedSource) => {
    switch (source) {
      case 'hn': return 'HN'
      case 'github': return 'GH'
      case 'yc': return 'YC'
      case 'arxiv': return 'arXiv'
      case 'rss': return 'RSS'
      case 'pitchbook': return 'PB'
      case 'linkedin': return 'LI'
      default: return 'News'
    }
  }

  const isConfigured = isSupabaseConfigured()

  return (
    <div className="feed-section">
      {/* Source Tabs */}
      <div className="feed-tabs">
        {SOURCE_TABS.map(tab => (
          <button
            key={tab.id}
            className={`feed-tab ${activeSource === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSource(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Header */}
      <div className="feed-filters-header">
        <button
          className="filters-toggle"
          onClick={() => setFeedFiltersOpen(!feedFiltersOpen)}
        >
          Filters {feedFiltersOpen ? '-' : '+'}
        </button>
        <button className="refresh-btn" onClick={refresh} disabled={feedLoading}>
          {feedLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters Panel */}
      {feedFiltersOpen && (
        <div className="feed-filters">
          {/* Search */}
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            {isConfigured && (
              <label className="semantic-toggle">
                <input
                  type="checkbox"
                  checked={semanticSearch}
                  onChange={(e) => setSemanticSearch(e.target.checked)}
                />
                Semantic
              </label>
            )}
          </div>

          {/* Date & Sort */}
          <div className="filter-row">
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom</option>
            </select>

            <select value={feedSortBy} onChange={(e) => setFeedSortBy(e.target.value as 'date' | 'score')}>
              <option value="date">Sort: Date</option>
              <option value="score">Sort: Score</option>
            </select>

            <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
              <option value={0}>Min Score: Any</option>
              <option value={50}>50+</option>
              <option value={100}>100+</option>
              <option value={200}>200+</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="filter-row">
              <input
                type="date"
                value={customDateStart}
                onChange={(e) => setCustomDateStart(e.target.value)}
              />
              <span>to</span>
              <input
                type="date"
                value={customDateEnd}
                onChange={(e) => setCustomDateEnd(e.target.value)}
              />
            </div>
          )}

          {/* Theme Filter */}
          {availableThemes.length > 0 && (
            <div className="filter-row">
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

      {/* RSS Source Filter */}
      {activeSource === 'rss' && feedFiltersOpen && (
        <div className="rss-source-tabs">
          {RSS_SOURCES.map(source => (
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

      {/* Error Message */}
      {feedError && (
        <div className="feed-error">
          Error loading feed: {feedError.message}
        </div>
      )}

      {/* Feed List */}
      <div className="feed-container">
        {feedLoading || searchLoading ? (
          <p className="loading">Loading feed...</p>
        ) : filteredItems.length === 0 ? (
          <p className="loading">No items found</p>
        ) : (
          <>
            {paginatedItems.map(item => (
              <div
                key={item.id}
                className="feed-item"
                onClick={() => window.open(item.url, '_blank')}
              >
                <button
                  className={`star-btn ${starredItems.includes(item.id) ? 'starred' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleStar(item)
                  }}
                  title={starredItems.includes(item.id) ? 'Remove from starred' : 'Add to starred'}
                >
                  {starredItems.includes(item.id) ? '*' : '-'}
                </button>
                <div className="feed-item-source">
                  {getSourceLabel(item.source)}
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
            {visibleCount < filteredItems.length && (
              <button
                className="load-more-btn"
                onClick={() => setVisibleCount(prev => prev + 20)}
              >
                Load More ({filteredItems.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
