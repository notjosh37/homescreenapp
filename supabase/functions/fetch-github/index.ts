import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, updateSourceLastFetched } from '../_shared/supabase.ts'

// GitHub Trending API (unofficial but reliable)
const TRENDING_API = 'https://api.gitterapp.com/repositories'

interface TrendingRepo {
  author: string
  name: string
  avatar: string
  url: string
  description: string
  language: string
  languageColor: string
  stars: number
  forks: number
  currentPeriodStars: number
  builtBy: { username: string; href: string; avatar: string }[]
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()
    const githubToken = Deno.env.get('GITHUB_TOKEN')

    // Parse request body for options
    let options = { language: '', since: 'daily' }
    try {
      if (req.method === 'POST') {
        options = { ...options, ...(await req.json()) }
      }
    } catch {
      // Use defaults if body parsing fails
    }

    // Fetch trending repositories
    const trendingUrl = `${TRENDING_API}?language=${options.language}&since=${options.since}`
    const trendingRes = await fetch(trendingUrl)

    if (!trendingRes.ok) {
      throw new Error('Failed to fetch trending repositories')
    }

    const trendingRepos: TrendingRepo[] = await trendingRes.json()

    // Enrich with GitHub API data if token available
    const repositories = await Promise.all(
      trendingRepos.slice(0, 30).map(async (repo, index) => {
        let githubData: any = null

        if (githubToken) {
          try {
            const apiRes = await fetch(`https://api.github.com/repos/${repo.author}/${repo.name}`, {
              headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            })
            if (apiRes.ok) {
              githubData = await apiRes.json()
            }
          } catch {
            // Continue without enrichment
          }
        }

        return {
          github_id: githubData?.id || null,
          full_name: `${repo.author}/${repo.name}`,
          name: repo.name,
          description: repo.description || githubData?.description || null,
          url: repo.url || `https://github.com/${repo.author}/${repo.name}`,
          stars: githubData?.stargazers_count || repo.stars || 0,
          forks: githubData?.forks_count || repo.forks || 0,
          watchers: githubData?.watchers_count || 0,
          open_issues: githubData?.open_issues_count || 0,
          language: repo.language || githubData?.language || null,
          topics: githubData?.topics || [],
          stars_today: repo.currentPeriodStars || 0,
          trending_rank: index + 1,
          metadata: {
            author: repo.author,
            avatar: repo.avatar,
            language_color: repo.languageColor,
            built_by: repo.builtBy,
            license: githubData?.license?.spdx_id,
            created_at: githubData?.created_at,
            pushed_at: githubData?.pushed_at,
          },
        }
      })
    )

    // Upsert repositories
    const { error: repoError } = await supabase
      .from('repositories')
      .upsert(repositories, {
        onConflict: 'full_name',
        ignoreDuplicates: false,
      })

    if (repoError) {
      console.error('Repository upsert error:', repoError)
    }

    // Also create article entries for the unified feed
    const articles = repositories.map((repo) => ({
      source_type: 'github',
      external_id: `gh-${repo.full_name}`,
      title: `${repo.full_name} - ${repo.description || 'Trending repository'}`,
      url: repo.url,
      published_at: new Date().toISOString(),
      score: repo.stars_today,
      summary: `Stars: ${repo.stars.toLocaleString()} | Forks: ${repo.forks.toLocaleString()} | Language: ${repo.language || 'Unknown'}`,
      themes: repo.topics,
      metadata: {
        type: 'repository',
        stars: repo.stars,
        forks: repo.forks,
        language: repo.language,
        trending_rank: repo.trending_rank,
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
    await updateSourceLastFetched('github')

    return jsonResponse({
      success: true,
      count: repositories.length,
      message: `Fetched ${repositories.length} trending repositories`,
    })
  } catch (error) {
    console.error('Error in fetch-github:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
