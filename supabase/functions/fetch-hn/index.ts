import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, updateSourceLastFetched } from '../_shared/supabase.ts'

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0'

interface HNStory {
  id: number
  title: string
  url?: string
  score: number
  descendants: number
  time: number
  by: string
  type: string
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()

    // Fetch top story IDs
    const topStoriesRes = await fetch(`${HN_API_BASE}/topstories.json`)
    if (!topStoriesRes.ok) {
      throw new Error('Failed to fetch HN top stories')
    }
    const storyIds: number[] = await topStoriesRes.json()

    // Fetch details for top 30 stories in parallel
    const storyPromises = storyIds.slice(0, 30).map(async (id) => {
      const res = await fetch(`${HN_API_BASE}/item/${id}.json`)
      if (!res.ok) return null
      return res.json() as Promise<HNStory>
    })

    const stories = (await Promise.all(storyPromises)).filter(
      (story): story is HNStory => story !== null && story.type === 'story'
    )

    // Transform to article format
    const articles = stories.map((story) => ({
      source_type: 'hn',
      external_id: String(story.id),
      title: story.title,
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      published_at: new Date(story.time * 1000).toISOString(),
      score: story.score || 0,
      comments_count: story.descendants || 0,
      author: story.by || null,
      metadata: {
        hn_id: story.id,
        type: story.type,
      },
    }))

    // Upsert articles (update if exists, insert if not)
    const { data, error } = await supabase
      .from('articles')
      .upsert(articles, {
        onConflict: 'source_type,external_id',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Update source last_fetched_at
    await updateSourceLastFetched('hackernews')

    return jsonResponse({
      success: true,
      count: articles.length,
      message: `Fetched ${articles.length} stories from Hacker News`,
    })
  } catch (error) {
    console.error('Error in fetch-hn:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
