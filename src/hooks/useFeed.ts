import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  supabase,
  fetchArticles,
  toggleArticleStar,
  subscribeToTable,
  isSupabaseConfigured,
} from '../services/supabase'
import type { FeedItem, FeedFilters, FeedSource, DbArticle } from '../types'
import { dbArticleToFeedItem } from '../types'

// ============================================
// TYPES
// ============================================

interface UseFeedOptions {
  /** Enable real-time updates */
  realtime?: boolean
  /** Initial filters */
  initialFilters?: FeedFilters
  /** Enable automatic fetch on mount */
  autoFetch?: boolean
  /** Filter by source */
  source?: FeedSource | 'all'
  /** Limit items per page */
  limit?: number
}

interface UseFeedReturn {
  /** Feed items */
  items: FeedItem[]
  /** Loading state */
  loading: boolean
  /** Error state */
  error: Error | null
  /** Refresh feed data */
  refresh: () => Promise<void>
  /** Toggle star on an item */
  toggleStar: (id: string) => Promise<void>
  /** Update filters */
  setFilters: (filters: FeedFilters) => void
  /** Current filters */
  filters: FeedFilters
  /** Whether Supabase is configured */
  isConfigured: boolean
  /** Load more items (pagination) */
  loadMore: () => Promise<void>
  /** Whether there are more items to load */
  hasMore: boolean
  /** Total count of items matching filters */
  totalCount: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDateFromRange(range: FeedFilters['dateRange']): string | undefined {
  if (!range || range === 'all' || range === 'custom') return undefined

  const now = new Date()
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return undefined
  }
}

// ============================================
// HOOK
// ============================================

export function useFeed(options: UseFeedOptions = {}): UseFeedReturn {
  const { realtime = true, initialFilters = {}, autoFetch = true, source, limit } = options

  // Merge source and limit into initial filters
  const mergedInitialFilters: FeedFilters = {
    ...initialFilters,
    sources: source && source !== 'all' ? [source] : initialFilters.sources,
    limit: limit || initialFilters.limit,
  }

  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [filters, setFilters] = useState<FeedFilters>(mergedInitialFilters)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const isConfigured = isSupabaseConfigured()
  const pageSize = filters.limit || 50

  // Update filters when source prop changes
  useEffect(() => {
    if (source !== undefined) {
      setFilters(prev => ({
        ...prev,
        sources: source && source !== 'all' ? [source] : undefined,
      }))
    }
  }, [source])

  // Legacy fetch functions for when Supabase is not configured
  const fetchHackerNewsLegacy = async (): Promise<FeedItem[]> => {
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

  const fetchRssFeedsLegacy = async (): Promise<FeedItem[]> => {
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

  // Fetch feed data - supports both Supabase and legacy modes
  const fetchFeed = useCallback(async (resetOffset = true) => {
    setLoading(true)
    setError(null)

    if (resetOffset) {
      setOffset(0)
    }

    // If Supabase is not configured, use legacy fetch
    if (!isConfigured) {
      try {
        const results: FeedItem[] = []
        const hnItems = await fetchHackerNewsLegacy()
        results.push(...hnItems)
        const rssItems = await fetchRssFeedsLegacy()
        results.push(...rssItems)
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setItems(results)
        setHasMore(false)
        setTotalCount(results.length)
      } catch (err) {
        setError(err as Error)
        console.error('Error fetching feed (legacy):', err)
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const dateFrom = filters.dateFrom || getDateFromRange(filters.dateRange)

      const { data, error: queryError, count } = await fetchArticles({
        sources: filters.sources as string[],
        limit: pageSize,
        offset: resetOffset ? 0 : offset,
        dateFrom,
        dateTo: filters.dateTo,
        starredOnly: filters.starredOnly,
        themes: filters.themes,
        minScore: filters.minScore,
        orderBy: 'published_at',
        orderDirection: 'desc',
      })

      if (queryError) {
        throw queryError
      }

      const feedItems = (data || []).map(dbArticleToFeedItem)

      if (resetOffset) {
        setItems(feedItems)
      } else {
        setItems(prev => [...prev, ...feedItems])
      }

      // Check if there are more items
      setHasMore(feedItems.length === pageSize)

      if (count !== null) {
        setTotalCount(count)
      }
    } catch (err) {
      setError(err as Error)
      console.error('Error fetching feed:', err)
    } finally {
      setLoading(false)
    }
  }, [isConfigured, filters, offset, pageSize])

  // Load more items
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setOffset(prev => prev + pageSize)
  }, [loading, hasMore, pageSize])

  // Effect to fetch when offset changes (for pagination)
  useEffect(() => {
    if (offset > 0) {
      fetchFeed(false)
    }
  }, [offset])

  // Toggle star on an item
  const toggleStar = useCallback(async (id: string) => {
    if (!isConfigured) return

    const item = items.find(i => i.id === id)
    if (!item) return

    const newStarred = !item.isStarred

    // Optimistic update
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, isStarred: newStarred } : i))
    )

    try {
      const { error: updateError } = await toggleArticleStar(id, newStarred)
      if (updateError) {
        // Revert on error
        setItems(prev =>
          prev.map(i => (i.id === id ? { ...i, isStarred: !newStarred } : i))
        )
        throw updateError
      }
    } catch (err) {
      console.error('Error toggling star:', err)
    }
  }, [isConfigured, items])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isConfigured || !realtime) return

    const unsubscribe = subscribeToTable('articles', (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        // Prepend new item if it matches current filters
        const newItem = dbArticleToFeedItem(payload.new as DbArticle)

        // Check if item matches current source filter
        if (filters.sources && filters.sources.length > 0 && !filters.sources.includes('all')) {
          if (!filters.sources.includes(newItem.source)) {
            return
          }
        }

        setItems(prev => [newItem, ...prev])
        setTotalCount(prev => prev + 1)
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        // Update existing item
        const updatedItem = dbArticleToFeedItem(payload.new as DbArticle)
        setItems(prev =>
          prev.map(item => (item.id === updatedItem.id ? updatedItem : item))
        )
      } else if (payload.eventType === 'DELETE' && payload.old) {
        // Remove deleted item
        setItems(prev => prev.filter(item => item.id !== payload.old?.id))
        setTotalCount(prev => prev - 1)
      }
    })

    return unsubscribe
  }, [isConfigured, realtime, filters.sources])

  // Fetch on mount and when filters change
  useEffect(() => {
    if (autoFetch && isConfigured) {
      fetchFeed(true)
    }
  }, [autoFetch, isConfigured, filters])

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0)
    setHasMore(true)
  }, [filters])

  return {
    items,
    loading,
    error,
    refresh: () => fetchFeed(true),
    toggleStar,
    setFilters,
    filters,
    isConfigured,
    loadMore,
    hasMore,
    totalCount,
  }
}

// ============================================
// HOOK: useSearch
// ============================================

interface UseSearchOptions {
  debounceMs?: number
  semantic?: boolean
}

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: FeedItem[]
  loading: boolean
  error: Error | null
  search: (query: string, semantic?: boolean) => Promise<void>
  clear: () => void
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 300, semantic = true } = options

  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isConfigured = isSupabaseConfigured()

  const performSearch = useCallback(async (searchQuery: string, useSemantic?: boolean) => {
    const semanticMode = useSemantic !== undefined ? useSemantic : semantic

    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    if (!isConfigured) {
      setError(new Error('Supabase not configured'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      // For semantic search, call edge function
      if (semanticMode) {
        const { data, error: funcError } = await supabase.functions.invoke('search', {
          body: {
            query: searchQuery,
            semantic: true,
            limit: 50,
          },
        })

        if (funcError) throw funcError

        // Map results to FeedItem
        const feedItems: FeedItem[] = (data?.results || []).map((r: any) => ({
          id: r.id,
          source: r.source_type as FeedSource,
          title: r.title,
          url: r.url || '',
          date: r.published_at || '',
          score: r.score,
          comments: r.comments_count,
          relevanceScore: r.relevance_score,
          themes: r.themes,
          summary: r.summary,
          author: r.author,
          company: r.company,
          isStarred: r.is_starred,
        }))

        setResults(feedItems)
      } else {
        // Basic text search
        const { data, error: queryError } = await supabase
          .from('articles')
          .select('*')
          .textSearch('title', searchQuery, { type: 'websearch' })
          .order('published_at', { ascending: false })
          .limit(50)

        if (queryError) throw queryError

        const feedItems = (data || []).map(dbArticleToFeedItem)
        setResults(feedItems)
      }
    } catch (err) {
      setError(err as Error)
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [isConfigured, semantic])

  const clear = useCallback(() => {
    setQueryState('')
    setResults([])
    setError(null)
  }, [])

  // Debounced query update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        performSearch(query)
      } else {
        setResults([])
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs, performSearch])

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)
  }, [])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    search: performSearch,
    clear,
  }
}

// ============================================
// HOOK: useSources
// ============================================

interface Source {
  id: string
  name: string
  type: string
  enabled: boolean
  lastFetchedAt: string | null
}

interface UseSourcesReturn {
  sources: Source[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  toggleEnabled: (id: string, enabled: boolean) => Promise<void>
  triggerFetch: (sourceId: string) => Promise<void>
}

export function useSources(): UseSourcesReturn {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isConfigured = isSupabaseConfigured()

  const fetchSources = useCallback(async () => {
    if (!isConfigured) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('sources')
        .select('*')
        .order('name')

      if (queryError) throw queryError

      const mappedSources: Source[] = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        enabled: s.enabled,
        lastFetchedAt: s.last_fetched_at,
      }))

      setSources(mappedSources)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [isConfigured])

  const toggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    if (!isConfigured) return

    // Optimistic update
    setSources(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled } : s))
    )

    try {
      const { error: updateError } = await supabase
        .from('sources')
        .update({ enabled })
        .eq('id', id)

      if (updateError) {
        // Revert on error
        setSources(prev =>
          prev.map(s => (s.id === id ? { ...s, enabled: !enabled } : s))
        )
        throw updateError
      }
    } catch (err) {
      console.error('Error toggling source:', err)
    }
  }, [isConfigured])

  const triggerFetch = useCallback(async (sourceId: string) => {
    if (!isConfigured) return

    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    // Map source name to edge function name
    const functionName = `fetch-${source.name.toLowerCase()}`

    try {
      const { error: funcError } = await supabase.functions.invoke(functionName)
      if (funcError) throw funcError

      // Refresh sources to get updated last_fetched_at
      await fetchSources()
    } catch (err) {
      console.error(`Error fetching ${source.name}:`, err)
    }
  }, [isConfigured, sources, fetchSources])

  useEffect(() => {
    if (isConfigured) {
      fetchSources()
    }
  }, [isConfigured, fetchSources])

  return {
    sources,
    loading,
    error,
    refresh: fetchSources,
    toggleEnabled,
    triggerFetch,
  }
}
