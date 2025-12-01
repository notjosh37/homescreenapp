-- Homescreen Intelligence Stack Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- SOURCES TABLE
-- ============================================
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('api', 'rss', 'scraper')),
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    fetch_interval_minutes INTEGER DEFAULT 60,
    last_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default sources
INSERT INTO sources (name, type, config, enabled, fetch_interval_minutes) VALUES
    ('hackernews', 'api', '{"endpoint": "https://hacker-news.firebaseio.com/v0"}', true, 30),
    ('github', 'api', '{"endpoint": "https://api.github.com"}', true, 60),
    ('yc', 'api', '{"endpoint": "https://yc-oss.github.io/api"}', true, 1440),
    ('arxiv', 'api', '{"endpoint": "http://export.arxiv.org/api", "categories": ["cs.AI", "cs.LG", "cs.CL"]}', true, 360),
    ('techcrunch', 'rss', '{"url": "https://techcrunch.com/feed/"}', true, 60),
    ('betakit', 'rss', '{"url": "https://betakit.com/feed/"}', true, 60),
    ('newsapi', 'api', '{"endpoint": "https://newsapi.org/v2"}', true, 60);

-- ============================================
-- ARTICLES TABLE (Unified Feed)
-- ============================================
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL, -- 'hn', 'github', 'yc', 'arxiv', 'rss', 'news'
    external_id TEXT,

    -- Core fields (maps to FeedItem interface)
    title TEXT NOT NULL,
    url TEXT,
    published_at TIMESTAMPTZ,

    -- Scoring
    score INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    relevance_score DECIMAL(3,1) DEFAULT 0, -- 0-10 scale

    -- Metadata
    author TEXT,
    summary TEXT,
    content TEXT, -- Full content for embeddings
    themes TEXT[] DEFAULT '{}',
    company TEXT,

    -- Source-specific data
    metadata JSONB DEFAULT '{}',

    -- Vector embedding for semantic search (1536 dims for text-embedding-3-small)
    embedding vector(1536),

    -- Status
    is_starred BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicates from same source
    UNIQUE(source_type, external_id)
);

-- ============================================
-- GITHUB REPOSITORIES TABLE
-- ============================================
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT UNIQUE,
    full_name TEXT UNIQUE, -- owner/repo
    name TEXT NOT NULL,
    description TEXT,
    url TEXT,

    -- Stats
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    watchers INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,

    -- Classification
    language TEXT,
    topics TEXT[] DEFAULT '{}',

    -- Trending data
    stars_today INTEGER DEFAULT 0,
    stars_week INTEGER DEFAULT 0,
    trending_rank INTEGER,

    -- Vector embedding
    embedding vector(1536),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- YC COMPANIES TABLE
-- ============================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,

    -- Basic info
    tagline TEXT,
    description TEXT,
    website TEXT,

    -- YC-specific
    yc_batch TEXT, -- e.g., 'W23', 'S24'
    yc_url TEXT,

    -- Classification
    industry TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'active', -- active, acquired, dead, public

    -- Vector embedding
    embedding vector(1536),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ARXIV PAPERS TABLE
-- ============================================
CREATE TABLE papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arxiv_id TEXT UNIQUE,

    -- Basic info
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT[] DEFAULT '{}',

    -- Classification
    categories TEXT[] DEFAULT '{}', -- cs.AI, cs.LG, etc.
    primary_category TEXT,

    -- Links
    arxiv_url TEXT,
    pdf_url TEXT,

    -- Dates
    submitted_at TIMESTAMPTZ,
    updated_at_arxiv TIMESTAMPTZ,

    -- Relevance
    relevance_score DECIMAL(3,1) DEFAULT 0,
    themes TEXT[] DEFAULT '{}',

    -- Vector embedding
    embedding vector(1536),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- REPORTS TABLE (Generated Insights)
-- ============================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,

    -- Content
    body TEXT NOT NULL, -- Markdown
    summary TEXT,

    -- Template used
    template_id TEXT,
    template_name TEXT,

    -- Sources used
    source_article_ids UUID[] DEFAULT '{}',
    sources_metadata JSONB DEFAULT '{}',

    -- Classification
    report_type TEXT DEFAULT 'daily', -- daily, weekly, research, custom
    themes TEXT[] DEFAULT '{}',

    -- Dates
    report_date DATE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ALERTS TABLE (Saved Searches)
-- ============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,

    -- Query configuration
    query TEXT,
    source_types TEXT[] DEFAULT '{}',
    themes TEXT[] DEFAULT '{}',
    min_score INTEGER DEFAULT 0,

    -- Vector search
    embedding vector(1536),
    similarity_threshold DECIMAL(3,2) DEFAULT 0.8,

    -- Notification settings
    notify_email BOOLEAN DEFAULT false,
    notify_push BOOLEAN DEFAULT false,

    enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Full-text search indexes
CREATE INDEX idx_articles_title_search ON articles USING gin(to_tsvector('english', title));
CREATE INDEX idx_articles_summary_search ON articles USING gin(to_tsvector('english', COALESCE(summary, '')));
CREATE INDEX idx_companies_search ON companies USING gin(to_tsvector('english', name || ' ' || COALESCE(tagline, '') || ' ' || COALESCE(description, '')));
CREATE INDEX idx_papers_search ON papers USING gin(to_tsvector('english', title || ' ' || COALESCE(abstract, '')));

-- Vector similarity search (IVFFlat for performance)
CREATE INDEX idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_companies_embedding ON companies USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_papers_embedding ON papers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX idx_repositories_embedding ON repositories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Common query indexes
CREATE INDEX idx_articles_source_type ON articles(source_type);
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_articles_relevance ON articles(relevance_score DESC);
CREATE INDEX idx_articles_starred ON articles(is_starred) WHERE is_starred = true;
CREATE INDEX idx_articles_themes ON articles USING gin(themes);
CREATE INDEX idx_articles_created ON articles(created_at DESC);

CREATE INDEX idx_repositories_stars ON repositories(stars DESC);
CREATE INDEX idx_repositories_trending ON repositories(stars_today DESC);
CREATE INDEX idx_repositories_language ON repositories(language);

CREATE INDEX idx_companies_yc_batch ON companies(yc_batch);
CREATE INDEX idx_companies_industry ON companies(industry);

CREATE INDEX idx_papers_category ON papers(primary_category);
CREATE INDEX idx_papers_submitted ON papers(submitted_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Semantic search function
CREATE OR REPLACE FUNCTION search_similar_articles(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    url TEXT,
    source_type TEXT,
    published_at TIMESTAMPTZ,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.title,
        a.url,
        a.source_type,
        a.published_at,
        1 - (a.embedding <=> query_embedding) as similarity
    FROM articles a
    WHERE a.embedding IS NOT NULL
      AND 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Hybrid search function (keyword + semantic)
CREATE OR REPLACE FUNCTION hybrid_search_articles(
    search_query TEXT DEFAULT '',
    query_embedding vector(1536) DEFAULT NULL,
    source_filter TEXT[] DEFAULT NULL,
    theme_filter TEXT[] DEFAULT NULL,
    date_from TIMESTAMPTZ DEFAULT NULL,
    date_to TIMESTAMPTZ DEFAULT NULL,
    min_score INTEGER DEFAULT 0,
    result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    url TEXT,
    source_type TEXT,
    published_at TIMESTAMPTZ,
    score INTEGER,
    comments_count INTEGER,
    relevance_score DECIMAL,
    themes TEXT[],
    summary TEXT,
    author TEXT,
    company TEXT,
    metadata JSONB,
    is_starred BOOLEAN,
    text_rank float,
    semantic_rank float,
    combined_rank float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH text_search AS (
        SELECT
            a.id,
            ts_rank(to_tsvector('english', a.title || ' ' || COALESCE(a.summary, '')),
                    plainto_tsquery('english', search_query)) as rank
        FROM articles a
        WHERE search_query IS NOT NULL
          AND search_query != ''
          AND to_tsvector('english', a.title || ' ' || COALESCE(a.summary, ''))
              @@ plainto_tsquery('english', search_query)
    ),
    semantic_search AS (
        SELECT
            a.id,
            1 - (a.embedding <=> query_embedding) as rank
        FROM articles a
        WHERE query_embedding IS NOT NULL
          AND a.embedding IS NOT NULL
          AND 1 - (a.embedding <=> query_embedding) > 0.5
    )
    SELECT
        a.id,
        a.title,
        a.url,
        a.source_type,
        a.published_at,
        a.score,
        a.comments_count,
        a.relevance_score,
        a.themes,
        a.summary,
        a.author,
        a.company,
        a.metadata,
        a.is_starred,
        COALESCE(ts.rank, 0)::float as text_rank,
        COALESCE(ss.rank, 0)::float as semantic_rank,
        (COALESCE(ts.rank, 0) * 0.4 + COALESCE(ss.rank, 0) * 0.6)::float as combined_rank
    FROM articles a
    LEFT JOIN text_search ts ON a.id = ts.id
    LEFT JOIN semantic_search ss ON a.id = ss.id
    WHERE (search_query = '' OR search_query IS NULL OR ts.id IS NOT NULL OR ss.id IS NOT NULL)
      AND (source_filter IS NULL OR a.source_type = ANY(source_filter))
      AND (theme_filter IS NULL OR a.themes && theme_filter)
      AND (date_from IS NULL OR a.published_at >= date_from)
      AND (date_to IS NULL OR a.published_at <= date_to)
      AND (COALESCE(a.relevance_score, 0) >= min_score OR COALESCE(a.score, 0) >= min_score)
    ORDER BY
        CASE WHEN search_query != '' AND search_query IS NOT NULL
             THEN (COALESCE(ts.rank, 0) * 0.4 + COALESCE(ss.rank, 0) * 0.6)
             ELSE 0
        END DESC,
        a.published_at DESC
    LIMIT result_limit;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY (Basic - single user)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (single-user app)
-- For anon key access (public read)
CREATE POLICY "Allow public read on articles" ON articles FOR SELECT USING (true);
CREATE POLICY "Allow public read on repositories" ON repositories FOR SELECT USING (true);
CREATE POLICY "Allow public read on companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Allow public read on papers" ON papers FOR SELECT USING (true);
CREATE POLICY "Allow public read on reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Allow public read on sources" ON sources FOR SELECT USING (true);

-- Allow insert/update/delete for service role (edge functions)
CREATE POLICY "Allow service role full access on articles" ON articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on repositories" ON repositories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on papers" ON papers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on reports" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on sources" ON sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);

-- Allow starring from frontend (anon key)
CREATE POLICY "Allow starring articles" ON articles FOR UPDATE USING (true) WITH CHECK (true);
