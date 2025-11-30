import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Build Notion API URL
  const path = req.url?.replace('/api/notion', '') || ''
  const notionUrl = 'https://api.notion.com' + path

  try {
    const response = await fetch(notionUrl, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization as string,
        'Notion-Version': (req.headers['notion-version'] as string) || '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Notion proxy error:', error)
    res.status(500).json({ error: 'Failed to proxy request to Notion API' })
  }
}
