import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, updateSourceLastFetched } from '../_shared/supabase.ts'

const ARXIV_API = 'http://export.arxiv.org/api/query'

// AI/ML focused categories
const DEFAULT_CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'stat.ML']

interface ArxivEntry {
  id: string
  title: string
  summary: string
  authors: string[]
  categories: string[]
  published: string
  updated: string
}

// Simple XML parser for ArXiv Atom feed
function parseArxivXml(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = []

  // Match all <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1]

    // Extract fields
    const id = entryXml.match(/<id>(.*?)<\/id>/)?.[1] || ''
    const title = entryXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, ' ').trim() || ''
    const summary = entryXml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, ' ').trim() || ''
    const published = entryXml.match(/<published>(.*?)<\/published>/)?.[1] || ''
    const updated = entryXml.match(/<updated>(.*?)<\/updated>/)?.[1] || ''

    // Extract authors
    const authorRegex = /<author>\s*<name>(.*?)<\/name>/g
    const authors: string[] = []
    let authorMatch
    while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
      authors.push(authorMatch[1])
    }

    // Extract categories
    const categoryRegex = /<category[^>]*term="([^"]+)"/g
    const categories: string[] = []
    let categoryMatch
    while ((categoryMatch = categoryRegex.exec(entryXml)) !== null) {
      categories.push(categoryMatch[1])
    }

    if (id && title) {
      entries.push({
        id,
        title,
        summary,
        authors,
        categories,
        published,
        updated,
      })
    }
  }

  return entries
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()

    // Parse request body for options
    let categories = DEFAULT_CATEGORIES
    let maxResults = 50
    try {
      if (req.method === 'POST') {
        const body = await req.json()
        if (body.categories) categories = body.categories
        if (body.maxResults) maxResults = body.maxResults
      }
    } catch {
      // Use defaults
    }

    const allPapers: ArxivEntry[] = []

    // Fetch papers for each category
    for (const category of categories) {
      const url = `${ARXIV_API}?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&max_results=${Math.floor(maxResults / categories.length)}`

      // Add delay to respect rate limits (1 req/3s)
      if (allPapers.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }

      const res = await fetch(url)
      if (!res.ok) {
        console.error(`Failed to fetch ${category}: ${res.status}`)
        continue
      }

      const xml = await res.text()
      const entries = parseArxivXml(xml)
      allPapers.push(...entries)
    }

    // Deduplicate by arxiv ID
    const uniquePapers = Array.from(
      new Map(allPapers.map(p => [p.id, p])).values()
    )

    // Transform to database format
    const papers = uniquePapers.map((entry) => {
      const arxivId = entry.id.split('/abs/').pop() || entry.id
      return {
        arxiv_id: arxivId,
        title: entry.title,
        abstract: entry.summary,
        authors: entry.authors,
        categories: entry.categories,
        primary_category: entry.categories[0] || null,
        arxiv_url: entry.id,
        pdf_url: entry.id.replace('/abs/', '/pdf/') + '.pdf',
        submitted_at: entry.published,
        updated_at_arxiv: entry.updated,
        metadata: {},
      }
    })

    // Upsert papers
    const { error: paperError } = await supabase
      .from('papers')
      .upsert(papers, {
        onConflict: 'arxiv_id',
        ignoreDuplicates: false,
      })

    if (paperError) {
      console.error('Paper upsert error:', paperError)
    }

    // Create article entries for unified feed
    const articles = papers.map((paper) => ({
      source_type: 'arxiv',
      external_id: paper.arxiv_id,
      title: paper.title,
      url: paper.arxiv_url,
      published_at: paper.submitted_at,
      summary: paper.abstract?.slice(0, 500) || null,
      author: paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : ''),
      themes: paper.categories,
      metadata: {
        type: 'paper',
        pdf_url: paper.pdf_url,
        primary_category: paper.primary_category,
        all_authors: paper.authors,
      },
    }))

    const { error: articleError } = await supabase
      .from('articles')
      .upsert(articles, {
        onConflict: 'source_type,external_id',
        ignoreDuplicates: false,
      })

    if (articleError) {
      console.error('Article upsert error:', articleError)
    }

    // Update source last_fetched_at
    await updateSourceLastFetched('arxiv')

    return jsonResponse({
      success: true,
      count: papers.length,
      categories: categories,
      message: `Fetched ${papers.length} papers from ArXiv`,
    })
  } catch (error) {
    console.error('Error in fetch-arxiv:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
