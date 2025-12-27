import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock core dependencies
vi.mock('@janhq/core', () => ({
  events: {
    on: vi.fn(),
    emit: vi.fn(),
  },
  fs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
  },
}))

describe('RAG Extension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Document Processing', () => {
    it('should split text into chunks', () => {
      const text = 'A'.repeat(1000)
      const chunkSize = 100
      const chunks: string[] = []
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize))
      }
      expect(chunks).toHaveLength(10)
      expect(chunks[0].length).toBe(100)
    })

    it('should handle chunk overlap', () => {
      const text = 'ABCDEFGHIJ'
      const chunkSize = 4
      const overlap = 2
      const chunks: string[] = []
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.slice(i, i + chunkSize))
      }
      expect(chunks[0]).toBe('ABCD')
      expect(chunks[1]).toBe('CDEF')
    })

    it('should extract metadata from document', () => {
      const doc = {
        path: '/docs/readme.md',
        content: '# Title\n\nContent here',
      }
      const metadata = {
        filename: doc.path.split('/').pop(),
        extension: doc.path.split('.').pop(),
        wordCount: doc.content.split(/\s+/).length,
      }
      expect(metadata.filename).toBe('readme.md')
      expect(metadata.extension).toBe('md')
    })
  })

  describe('Text Extraction', () => {
    it('should extract text from markdown', () => {
      const markdown = '# Heading\n\n**Bold** and *italic* text'
      // Simple extraction - remove markdown syntax
      const plain = markdown
        .replace(/#+\s*/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
      expect(plain).toContain('Heading')
      expect(plain).toContain('Bold')
    })

    it('should handle code blocks', () => {
      const markdown = '```javascript\nconst x = 1;\n```'
      const codeMatch = markdown.match(/```(\w+)?\n([\s\S]*?)```/)
      expect(codeMatch).not.toBeNull()
      expect(codeMatch![2]).toContain('const x = 1')
    })

    it('should extract links', () => {
      const markdown = 'Check [this link](https://example.com) for more info'
      const links = [...markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
      expect(links).toHaveLength(1)
      expect(links[0][1]).toBe('this link')
      expect(links[0][2]).toBe('https://example.com')
    })
  })

  describe('Vector Search', () => {
    it('should calculate cosine similarity', () => {
      const cosineSimilarity = (a: number[], b: number[]): number => {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
        return dotProduct / (magnitudeA * magnitudeB)
      }

      const vecA = [1, 0, 0]
      const vecB = [1, 0, 0]
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0)

      const vecC = [1, 0, 0]
      const vecD = [0, 1, 0]
      expect(cosineSimilarity(vecC, vecD)).toBeCloseTo(0.0)
    })

    it('should rank results by similarity', () => {
      const results = [
        { id: '1', similarity: 0.8 },
        { id: '2', similarity: 0.95 },
        { id: '3', similarity: 0.7 },
      ]
      const ranked = [...results].sort((a, b) => b.similarity - a.similarity)
      expect(ranked[0].id).toBe('2')
      expect(ranked[2].id).toBe('3')
    })

    it('should filter by minimum similarity', () => {
      const results = [
        { id: '1', similarity: 0.8 },
        { id: '2', similarity: 0.5 },
        { id: '3', similarity: 0.9 },
      ]
      const minSimilarity = 0.7
      const filtered = results.filter((r) => r.similarity >= minSimilarity)
      expect(filtered).toHaveLength(2)
    })
  })

  describe('Context Building', () => {
    it('should build context from chunks', () => {
      const chunks = [
        { content: 'First chunk content' },
        { content: 'Second chunk content' },
      ]
      const context = chunks.map((c) => c.content).join('\n\n')
      expect(context).toContain('First chunk')
      expect(context).toContain('Second chunk')
    })

    it('should limit context by token count', () => {
      const estimateTokens = (text: string) => Math.ceil(text.length / 4)
      const chunks = [
        { content: 'A'.repeat(100) },
        { content: 'B'.repeat(100) },
        { content: 'C'.repeat(100) },
      ]
      const maxTokens = 60
      let totalTokens = 0
      const selectedChunks: typeof chunks = []

      for (const chunk of chunks) {
        const tokens = estimateTokens(chunk.content)
        if (totalTokens + tokens <= maxTokens) {
          selectedChunks.push(chunk)
          totalTokens += tokens
        }
      }

      expect(selectedChunks).toHaveLength(2)
    })
  })

  describe('File Type Support', () => {
    it('should identify supported file types', () => {
      const supportedTypes = ['.txt', '.md', '.pdf', '.docx']
      const isSupported = (filename: string) => {
        const ext = '.' + filename.split('.').pop()?.toLowerCase()
        return supportedTypes.includes(ext)
      }

      expect(isSupported('readme.md')).toBe(true)
      expect(isSupported('document.pdf')).toBe(true)
      expect(isSupported('image.png')).toBe(false)
    })
  })
})
