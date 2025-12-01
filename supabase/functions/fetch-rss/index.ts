import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, updateSourceLastFetched } from '../_shared/supabase.ts'

// Default RSS feeds
const DEFAULT_FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', sourceName: 'techcrunch' },
  { name: 'BetaKit', url: 'https://betakit.com/feed/', sourceName: 'betakit' },
]

// RSS to JSON service (free, no auth required)
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json'

interface RssItem {
  title: string
  pubDate: string
  link: string
  guid: string
  author: string
  description: string
  content: string
  categories: string[]
}

interface Rss2JsonResponse {
  status: string
  feed: {
    title: string
    url: string
    link: string
    description: string
  }
  items: RssItem[]
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()

    // Parse request body for custom feeds
    let feeds = DEFAULT_FEEDS
    try {
      if (req.method === 'POST') {
        const body = await req.json()
        if (body.feeds && Array.isArray(body.feeds)) {
          feeds = body.feeds
        }
      }
    } catch {
      // Use defaults
    }

    const allArticles: any[] = []

    for (const feed of feeds) {
      try {
        const url = `${RSS2JSON_API}?rss_url=${encodeURIComponent(feed.url)}`
        const res = await fetch(url)

        if (!res.ok) {
          console.error(`Failed to fetch ${feed.name}: ${res.status}`)
          continue
        }

        const data: Rss2JsonResponse = await res.json()

        if (data.status !== 'ok' || !data.items) {
          console.error(`Invalid response from ${feed.name}`)
          continue
        }

        const articles = data.items.slice(0, 15).map((item, index) => ({
          source_type: 'rss',
          external_id: `rss-${feed.sourceName}-${item.guid || item.link || index}`,
          title: item.title,
          url: item.link,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          author: item.author || null,
          summary: item.description?.replace(/<[^>]*>/g, '').slice(0, 500) || null,
          company: feed.name,
          themes: item.categories || [],
          metadata: {
            feed_name: feed.name,
            feed_url: feed.url,
            guid: item.guid,
          },
        }))

        allArticles.push(...articles)

        // Update the specific source
        await updateSourceLastFetched(feed.sourceName)
      } catch (feedError) {
        console.error(`Error fetching ${feed.name}:`, feedError)
      }
    }

    if (allArticles.length > 0) {
      const { error: articleError } = await supabase
        .from('articles')
        .upsert(allArticles, {
          onConflict: 'source_type,external_id',
          ignoreDuplicates: false,
        })

      if (articleError) {
        console.error('Article upsert error:', articleError)
      }
    }

    return jsonResponse({
      success: true,
      count: allArticles.length,
      feeds: feeds.map(f => f.name),
      message: `Fetched ${allArticles.length} articles from ${feeds.length} RSS feeds`,
    })
  } catch (error) {
    console.error('Error in fetch-rss:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
