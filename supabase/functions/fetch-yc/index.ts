import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getSupabaseClient, updateSourceLastFetched } from '../_shared/supabase.ts'

// YC-OSS API - Free, daily updated JSON of all YC companies
const YC_API = 'https://yc-oss.github.io/api/batches/all.json'
const YC_META = 'https://yc-oss.github.io/api/meta.json'

interface YCCompany {
  id: string
  name: string
  slug: string
  former_names: string[]
  small_logo_thumb_url: string
  website: string
  all_locations: string
  long_description: string
  one_liner: string
  team_size: number
  industry: string
  subindustry: string
  launched_at: number
  tags: string[]
  tags_highlighted: string[]
  top_company: boolean
  isHiring: boolean
  nonprofit: boolean
  batch: string
  status: string
  industries: string[]
  regions: string[]
  stage: string
  app_video_public: boolean
  demo_day_video_public: boolean
  app_answers: string | null
  question_answers: boolean
  url: string
  api: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient()

    // Fetch all YC companies
    const companiesRes = await fetch(YC_API)
    if (!companiesRes.ok) {
      throw new Error('Failed to fetch YC companies')
    }

    const ycCompanies: YCCompany[] = await companiesRes.json()

    // Filter to recent batches (last 2 years worth of batches)
    const currentYear = new Date().getFullYear()
    const recentBatches = [
      `W${currentYear}`, `S${currentYear}`,
      `W${currentYear - 1}`, `S${currentYear - 1}`,
      `W${currentYear - 2}`, `S${currentYear - 2}`,
    ]

    // Process all companies (or filter to recent)
    const companies = ycCompanies.slice(0, 500).map((c) => ({
      name: c.name,
      slug: c.slug,
      tagline: c.one_liner || null,
      description: c.long_description || null,
      website: c.website || null,
      yc_batch: c.batch || null,
      yc_url: `https://www.ycombinator.com/companies/${c.slug}`,
      industry: c.industry || c.industries?.[0] || null,
      tags: c.tags || c.industries || [],
      status: c.status || 'active',
      metadata: {
        team_size: c.team_size,
        location: c.all_locations,
        is_hiring: c.isHiring,
        top_company: c.top_company,
        nonprofit: c.nonprofit,
        stage: c.stage,
        subindustry: c.subindustry,
        launched_at: c.launched_at,
        logo_url: c.small_logo_thumb_url,
      },
    }))

    // Upsert companies
    const { error: companyError } = await supabase
      .from('companies')
      .upsert(companies, {
        onConflict: 'slug',
        ignoreDuplicates: false,
      })

    if (companyError) {
      console.error('Company upsert error:', companyError)
    }

    // Create article entries for recent batch companies only
    const recentCompanies = companies.filter(c =>
      c.yc_batch && recentBatches.some(b => c.yc_batch?.includes(b.slice(1)))
    )

    const articles = recentCompanies.map((company) => ({
      source_type: 'yc',
      external_id: `yc-${company.slug}`,
      title: `${company.name} (${company.yc_batch}) - ${company.tagline || 'YC Company'}`,
      url: company.yc_url,
      published_at: new Date().toISOString(),
      summary: company.description?.slice(0, 500) || company.tagline || null,
      company: company.name,
      themes: company.tags,
      metadata: {
        type: 'company',
        batch: company.yc_batch,
        industry: company.industry,
        website: company.website,
        team_size: company.metadata.team_size,
        is_hiring: company.metadata.is_hiring,
      },
    }))

    if (articles.length > 0) {
      const { error: articleError } = await supabase
        .from('articles')
        .upsert(articles, {
          onConflict: 'source_type,external_id',
          ignoreDuplicates: false,
        })

      if (articleError) {
        console.error('Article upsert error:', articleError)
      }
    }

    // Update source last_fetched_at
    await updateSourceLastFetched('yc')

    return jsonResponse({
      success: true,
      companiesCount: companies.length,
      articlesCount: articles.length,
      message: `Synced ${companies.length} YC companies, created ${articles.length} feed items`,
    })
  } catch (error) {
    console.error('Error in fetch-yc:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unknown error')
  }
})
