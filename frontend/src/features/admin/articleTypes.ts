export type ArticleContent = {
  slug: string
  title: string
  description: string
  category: string
  action: string
  image: string
  sections: { title: string; paragraphs: string[] }[]
  source: { name: string; url: string }
  sources?: { name: string; url: string }[]
}

export type ArticleRecord = {
  id: string
  slug: string
  title: string
  status: string
  category: string
  version: number
  updated_at: string
  content: ArticleContent
}

export const emptyArticle: ArticleContent = {
  slug: '',
  title: '',
  description: '',
  category: '',
  action: 'Baca artikel',
  image: '/assets/education/phishing.jpg',
  sections: [{ title: '', paragraphs: [''] }],
  source: { name: '', url: '' },
  sources: [],
}

export type EditorParagraph = { id: string; text: string }
export type EditorSource = ArticleContent['source'] & { id: string }
export type EditorSection = { id: string; title: string; paragraphs: EditorParagraph[] }
export type EditorContent = Omit<ArticleContent, 'sections' | 'source' | 'sources'> & {
  sections: EditorSection[]
  source: EditorSource
  sources: EditorSource[]
}

export const editorParagraph = (text: string): EditorParagraph => ({
  id: crypto.randomUUID(),
  text,
})

export const editorSource = (source: ArticleContent['source']): EditorSource => ({
  ...source,
  id: crypto.randomUUID(),
})

export const editorSection = (
  section: ArticleContent['sections'][number]
): EditorSection => ({
  ...section,
  id: crypto.randomUUID(),
  paragraphs: section.paragraphs.map(editorParagraph),
})

export function editorContent(content: ArticleContent): EditorContent {
  return {
    ...content,
    sections: content.sections.map(editorSection),
    source: editorSource(content.source),
    sources: (content.sources ?? []).map(editorSource),
  }
}

export function articleContent(content: EditorContent): ArticleContent {
  const source = ({ name, url }: EditorSource) => ({ name, url })
  return {
    ...content,
    sections: content.sections.map(({ title, paragraphs }) => ({
      title,
      paragraphs: paragraphs.map(p => p.text),
    })),
    source: source(content.source),
    sources: content.sources.map(source),
  }
}

export function generateSlug(text: string): string {
  let slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '')
  if (slug.length < 2) {
    slug = slug ? `${slug}-${Date.now().toString(36)}` : `artikel-${Date.now().toString(36)}`
  }
  return slug
}

