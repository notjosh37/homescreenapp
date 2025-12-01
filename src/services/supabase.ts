import { createClient } from '@supabase/supabase-js'
import type { DbArticle, DbRepository, DbCompany, DbPaper, DbReport, DbSource } from '../types'

// ============================================
// DATABASE TYPES
// ============================================

export type Database = {
  public: {
    Tables: {
      articles: {
        Row: DbArticle
        Insert: Omit<DbArticle, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DbArticle, 'id' | 'created_at'>>
      }
      repositories: {
        Row: DbRepository
        Insert: Omit<DbRepository, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DbRepository, 'id' | 'created_at'>>
      }
      companies: {
        Row: DbCompany
        Insert: Omit<DbCompany, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DbCompany, 'id' | 'created_at'>>
      }
      papers: {
        Row: DbPaper
        Insert: Omit<DbPaper, 'id' | 'created_at'>
        Update: Partial<Omit<DbPaper, 'id' | 'created_at'>>
      }
      reports: {
        Row: DbReport
        Insert: Omit<DbReport, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DbReport, 'id' | 'created_at'>>
      }
      sources: {
        Row: DbSource
        Insert: Omit<DbSource, 'id' | 'created_at'>
        Update: Partial<Omit<DbSource, 'id' | 'created_at'>>
      }
    }
    Functions: {
      search_similar_articles: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: string
          title: string
          url: string
          source_type: string
          published_at: string
          similarity: number
        }[]
      }
      hybrid_search_articles: {
        Args: {
          search_query?: string
          query_embedding?: number[]
          source_filter?: string[]
          theme_filter?: string[]
          date_from?: string
          date_to?: string
          min_score?: number
          result_limit?: number
        }
        Returns: {
          id: string
          title: string
          url: string
          source_type: string
          published_at: string
          score: number
          comments_count: number
          relevance_score: number
          themes: string[]
          summary: string
          author: string
          company: string
          metadata: Record<string, unknown>
          is_starred: boolean
          text_rank: number
          semantic_rank: number
          combined_rank: number
        }[]
      }
    }
  }
}

// ============================================
// SUPABASE CLIENT
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  )
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

/**
 * Call a Supabase Edge Function
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body,
    })
    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

/**
 * Subscribe to real-time changes on a table
 */
export function subscribeToTable<T extends keyof Database['public']['Tables']>(
  table: T,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: Database['public']['Tables'][T]['Row'] | null
    old: Database['public']['Tables'][T]['Row'] | null
  }) => void
) {
  const channel = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Database['public']['Tables'][T]['Row'] | null,
          old: payload.old as Database['public']['Tables'][T]['Row'] | null,
        })
      }
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}

// ============================================
// ARTICLE QUERIES
// ============================================

export async function fetchArticles(options: {
  sources?: string[]
  limit?: number
  offset?: number
  dateFrom?: string
  dateTo?: string
  starredOnly?: boolean
  themes?: string[]
  minScore?: number
  orderBy?: 'published_at' | 'score' | 'relevance_score'
  orderDirection?: 'asc' | 'desc'
}) {
  let query = supabase
    .from('articles')
    .select('*')
    .order(options.orderBy || 'published_at', {
      ascending: options.orderDirection === 'asc',
    })
    .limit(options.limit || 50)

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  if (options.sources && options.sources.length > 0 && !options.sources.includes('all')) {
    query = query.in('source_type', options.sources)
  }

  if (options.dateFrom) {
    query = query.gte('published_at', options.dateFrom)
  }

  if (options.dateTo) {
    query = query.lte('published_at', options.dateTo)
  }

  if (options.starredOnly) {
    query = query.eq('is_starred', true)
  }

  if (options.themes && options.themes.length > 0) {
    query = query.overlaps('themes', options.themes)
  }

  if (options.minScore && options.minScore > 0) {
    query = query.or(`relevance_score.gte.${options.minScore},score.gte.${options.minScore}`)
  }

  return query
}

export async function toggleArticleStar(id: string, isStarred: boolean) {
  return supabase
    .from('articles')
    .update({ is_starred: isStarred })
    .eq('id', id)
}

export async function markArticleRead(id: string) {
  return supabase
    .from('articles')
    .update({ is_read: true })
    .eq('id', id)
}

// ============================================
// SEARCH QUERIES
// ============================================

export async function searchArticles(options: {
  query: string
  semantic?: boolean
  sources?: string[]
  themes?: string[]
  dateFrom?: string
  dateTo?: string
  limit?: number
}) {
  // For semantic search, we need to call an edge function to generate embeddings
  if (options.semantic) {
    return invokeEdgeFunction<Database['public']['Functions']['hybrid_search_articles']['Returns']>(
      'search',
      {
        query: options.query,
        semantic: true,
        sources: options.sources,
        themes: options.themes,
        date_from: options.dateFrom,
        date_to: options.dateTo,
        limit: options.limit || 50,
      }
    )
  }

  // Basic text search using PostgreSQL full-text search
  let query = supabase
    .from('articles')
    .select('*')
    .textSearch('title', options.query, { type: 'websearch' })
    .order('published_at', { ascending: false })
    .limit(options.limit || 50)

  if (options.sources && options.sources.length > 0 && !options.sources.includes('all')) {
    query = query.in('source_type', options.sources)
  }

  if (options.dateFrom) {
    query = query.gte('published_at', options.dateFrom)
  }

  if (options.dateTo) {
    query = query.lte('published_at', options.dateTo)
  }

  return query
}

// ============================================
// SOURCE QUERIES
// ============================================

export async function fetchSources() {
  return supabase
    .from('sources')
    .select('*')
    .order('name')
}

export async function toggleSourceEnabled(id: string, enabled: boolean) {
  return supabase
    .from('sources')
    .update({ enabled })
    .eq('id', id)
}

// ============================================
// REPORT QUERIES
// ============================================

export async function fetchReports(options?: {
  limit?: number
  reportType?: string
}) {
  let query = supabase
    .from('reports')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(options?.limit || 30)

  if (options?.reportType) {
    query = query.eq('report_type', options.reportType)
  }

  return query
}

export async function createReport(report: Database['public']['Tables']['reports']['Insert']) {
  return supabase
    .from('reports')
    .insert(report)
    .select()
    .single()
}

// ============================================
// COMPANY QUERIES
// ============================================

export async function fetchCompanies(options?: {
  batch?: string
  industry?: string
  limit?: number
}) {
  let query = supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50)

  if (options?.batch) {
    query = query.eq('yc_batch', options.batch)
  }

  if (options?.industry) {
    query = query.eq('industry', options.industry)
  }

  return query
}

// ============================================
// REPOSITORY QUERIES
// ============================================

export async function fetchRepositories(options?: {
  language?: string
  limit?: number
  orderBy?: 'stars' | 'stars_today' | 'trending_rank'
}) {
  let query = supabase
    .from('repositories')
    .select('*')
    .order(options?.orderBy || 'stars_today', { ascending: false })
    .limit(options?.limit || 30)

  if (options?.language) {
    query = query.eq('language', options.language)
  }

  return query
}

// ============================================
// PAPER QUERIES
// ============================================

export async function fetchPapers(options?: {
  category?: string
  limit?: number
}) {
  let query = supabase
    .from('papers')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(options?.limit || 30)

  if (options?.category) {
    query = query.eq('primary_category', options.category)
  }

  return query
}
