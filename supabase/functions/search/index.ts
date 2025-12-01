import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

const EMBEDDING_MODEL = 'text-embedding-3-small'

interface SearchRequest {
  query: string
  semantic?: boolean
  sources?: string[]
  limit?: number
  matchThreshold?: number
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    // Parse request
    const body: SearchRequest = await req.json()
    const {
      query,
      semantic = true,
      sources,
      limit = 20,
      matchThreshold = 0.5,
    } = body

    if (!query || query.trim().length === 0) {
      return errorResponse('Query is required', 400)
    }

    // If semantic search is enabled and we have OpenAI key, generate embedding
    let queryEmbedding: number[] | null = null

    if (semantic && openaiKey) {
      const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: query,
        }),
      })

      if (embeddingRes.ok) {
        const embeddingData = await embeddingRes.json()
        queryEmbedding = embeddingData.data?.[0]?.embedding || null
      }
    }

    let results: any[] = []

    if (queryEmbedding) {
      // Use hybrid search with embedding
      const { data, error } = await supabase.rpc('hybrid_search_articles', {
        query_text: query,
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: limit,
        source_filter: sources || null,
      })

      if (error) {
        console.error('Hybrid search error:', error)
        throw new Error(`Search error: ${error.message}`)
      }

      results = data || []
    } else {
      // Fall back to text-only search
      let searchQuery = supabase
        .from('articles')
        .select('*')
        .textSearch('title', query, { type: 'websearch' })
        .limit(limit)

      if (sources && sources.length > 0) {
        searchQuery = searchQuery.in('source_type', sources)
      }

      const { data, error } = await searchQuery

      if (error) {
        console.error('Text search error:', error)
        throw new Error(`Search error: ${error.message}`)
      }

      results = data || []
    }

    return jsonResponse({
      success: true,
      results,
      count: results.length,
      semantic: !!queryEmbedding,
      query,
    })
  } catch (error) {
    console.error('Error in search:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
