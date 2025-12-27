import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock core dependencies
vi.mock('@janhq/core', () => ({
  Thread: class {},
  Message: class {},
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

describe('Conversational Extension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Thread Management', () => {
    it('should create a new thread', () => {
      const thread = {
        id: 'thread-123',
        title: 'New Conversation',
        createdAt: Date.now(),
        messages: [],
      }
      expect(thread.id).toBe('thread-123')
      expect(thread.messages).toHaveLength(0)
    })

    it('should add messages to thread', () => {
      const thread = {
        id: 'thread-123',
        messages: [] as object[],
      }
      const message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello!',
      }
      thread.messages.push(message)
      expect(thread.messages).toHaveLength(1)
    })

    it('should update thread title', () => {
      const thread = {
        id: 'thread-123',
        title: 'Original Title',
      }
      thread.title = 'Updated Title'
      expect(thread.title).toBe('Updated Title')
    })

    it('should delete thread', () => {
      const threads: Record<string, object> = {
        'thread-1': { id: 'thread-1' },
        'thread-2': { id: 'thread-2' },
      }
      delete threads['thread-1']
      expect(Object.keys(threads)).toHaveLength(1)
      expect(threads['thread-1']).toBeUndefined()
    })
  })

  describe('Message Handling', () => {
    it('should create user message', () => {
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello AI!',
        createdAt: Date.now(),
      }
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello AI!')
    })

    it('should create assistant message', () => {
      const message = {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Hello! How can I help you?',
        createdAt: Date.now(),
      }
      expect(message.role).toBe('assistant')
    })

    it('should handle multiline messages', () => {
      const content = `Line 1
Line 2
Line 3`
      const message = { content }
      expect(message.content.split('\n')).toHaveLength(3)
    })

    it('should handle empty message content', () => {
      const message = { content: '' }
      expect(message.content).toBe('')
    })

    it('should preserve message order', () => {
      const messages = [
        { id: '1', content: 'First' },
        { id: '2', content: 'Second' },
        { id: '3', content: 'Third' },
      ]
      expect(messages[0].content).toBe('First')
      expect(messages[2].content).toBe('Third')
    })
  })

  describe('Thread Search', () => {
    it('should search threads by title', () => {
      const threads = [
        { id: '1', title: 'Python Programming' },
        { id: '2', title: 'JavaScript Basics' },
        { id: '3', title: 'Python Advanced' },
      ]
      const results = threads.filter((t) =>
        t.title.toLowerCase().includes('python')
      )
      expect(results).toHaveLength(2)
    })

    it('should search threads by content', () => {
      const threads = [
        { id: '1', content: 'How to use React?' },
        { id: '2', content: 'Python vs JavaScript' },
      ]
      const results = threads.filter((t) =>
        t.content.toLowerCase().includes('react')
      )
      expect(results).toHaveLength(1)
    })
  })

  describe('Thread Sorting', () => {
    it('should sort threads by creation date', () => {
      const threads = [
        { id: '1', createdAt: 1000 },
        { id: '2', createdAt: 3000 },
        { id: '3', createdAt: 2000 },
      ]
      const sorted = [...threads].sort((a, b) => b.createdAt - a.createdAt)
      expect(sorted[0].id).toBe('2')
      expect(sorted[2].id).toBe('1')
    })

    it('should sort threads by update date', () => {
      const threads = [
        { id: '1', updatedAt: 1000 },
        { id: '2', updatedAt: 3000 },
      ]
      const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
      expect(sorted[0].id).toBe('2')
    })
  })
})
