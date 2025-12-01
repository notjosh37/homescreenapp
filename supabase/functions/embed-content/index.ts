import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient } from '../_shared/supabase.ts'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536 // text-embedding-3-small dimensions

interface EmbeddingRequest {
  table?: 'articles' | 'companies' | 'papers' | 'repositories'
  ids?: string[]
  batchSize?: number
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiKey) {
      return errorResponse('OPENAI_API_KEY not configured', 500)
    }

    // Parse request
    let options: EmbeddingRequest = {
      table: 'articles',
      batchSize: 50,
    }
    try {
      if (req.method === 'POST') {
        options = { ...options, ...(await req.json()) }
      }
    } catch {
      // Use defaults
    }

    const { table = 'articles', ids, batchSize = 50 } = options

    // Build query for records without embeddings
    let query = supabase.from(table).select('id, title, summary, content')

    if (ids && ids.length > 0) {
      query = query.in('id', ids)
    } else {
      query = query.is('embedding', null).limit(batchSize)
    }

    const { data: records, error: queryError } = await query

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`)
    }

    if (!records || records.length === 0) {
      return jsonResponse({
        success: true,
        processed: 0,
        message: 'No records need embeddings',
      })
    }

    // Prepare texts for embedding
    const texts = records.map((r: any) => {
      const parts = [r.title || '']
      if (r.summary) parts.push(r.summary)
      if (r.content) parts.push(r.content.slice(0, 6000))
      if (r.abstract) parts.push(r.abstract) // For papers
      if (r.description) parts.push(r.description) // For repos/companies
      return parts.join('\n').slice(0, 8000)
    })

    // Call OpenAI Embeddings API
    const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    })

    if (!embeddingRes.ok) {
      const errorText = await embeddingRes.text()
      throw new Error(`OpenAI API error: ${embeddingRes.status} - ${errorText}`)
    }

    const embeddingData = await embeddingRes.json()

    if (!embeddingData.data || embeddingData.data.length !== records.length) {
      throw new Error('Unexpected embedding response format')
    }

    // Update records with embeddings
    let updatedCount = 0
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const embedding = embeddingData.data[i].embedding

      const { error: updateError } = await supabase
        .from(table)
        .update({ embedding })
        .eq('id', record.id)

      if (updateError) {
        console.error(`Error updating ${record.id}:`, updateError)
      } else {
        updatedCount++
      }
    }

    return jsonResponse({
      success: true,
      processed: updatedCount,
      total: records.length,
      table,
      usage: embeddingData.usage,
      message: `Generated embeddings for ${updatedCount}/${records.length} ${table}`,
    })
  } catch (error) {
    console.error('Error in embed-content:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
