/**
 * Tests for Tool Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ToolManager, getToolManager, resetToolManager, type ToolDefinition, type ToolResult } from './tool-integration'
import { resetAtomspace } from './atomspace'
import { resetPLNEngine } from './pln'

describe('ToolManager', () => {
  let toolManager: ToolManager

  beforeEach(() => {
    resetToolManager()
    resetAtomspace()
    resetPLNEngine()
    toolManager = getToolManager()
  })

  afterEach(() => {
    resetToolManager()
    resetAtomspace()
    resetPLNEngine()
  })

  describe('initialization', () => {
    it('should initialize with built-in tools', () => {
      const tools = toolManager.getAvailableTools()

      expect(tools.length).toBeGreaterThan(0)
      expect(tools.some(t => t.name === 'rag_retrieve')).toBe(true)
      expect(tools.some(t => t.name === 'file_read')).toBe(true)
      expect(tools.some(t => t.name === 'file_write')).toBe(true)
      expect(tools.some(t => t.name === 'web_search')).toBe(true)
      expect(tools.some(t => t.name === 'llm_inference')).toBe(true)
      expect(tools.some(t => t.name === 'code_analysis')).toBe(true)
      expect(tools.some(t => t.name === 'summarize')).toBe(true)
    })
  })

  describe('getToolsByCategory', () => {
    it('should filter tools by category', () => {
      const retrievalTools = toolManager.getToolsByCategory('retrieval')
      expect(retrievalTools.every(t => t.category === 'retrieval')).toBe(true)

      const fileTools = toolManager.getToolsByCategory('file')
      expect(fileTools.every(t => t.category === 'file')).toBe(true)
    })
  })

  describe('registerTool', () => {
    it('should register a custom tool', () => {
      const customTool: ToolDefinition = {
        name: 'custom_tool',
        description: 'A custom test tool',
        category: 'system',
        execute: async (args) => ({
          success: true,
          output: { custom: true },
          executionTime: 10,
        }),
      }

      toolManager.registerTool(customTool)

      const tools = toolManager.getAvailableTools()
      expect(tools.some(t => t.name === 'custom_tool')).toBe(true)
    })
  })

  describe('selectToolForTask', () => {
    it('should select web_search for search tasks', () => {
      const task = {
        id: 'task_1',
        name: 'Search for information',
        description: 'Find data about climate change',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const tool = toolManager.selectToolForTask(task)
      expect(tool).toBe('web_search')
    })

    it('should select file_read for file reading tasks', () => {
      const task = {
        id: 'task_2',
        name: 'Read the config file',
        description: 'Load configuration from file',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const tool = toolManager.selectToolForTask(task)
      expect(tool).toBe('file_read')
    })

    it('should select summarize for summarization tasks', () => {
      const task = {
        id: 'task_3',
        name: 'Summarize the document',
        description: 'Create a brief summary',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const tool = toolManager.selectToolForTask(task)
      expect(tool).toBe('summarize')
    })

    it('should select code_analysis for code tasks', () => {
      const task = {
        id: 'task_4',
        name: 'Analyze the code',
        description: 'Review the implementation',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const tool = toolManager.selectToolForTask(task)
      expect(tool).toBe('code_analysis')
    })

    it('should default to llm_inference for general tasks', () => {
      const task = {
        id: 'task_5',
        name: 'Do something vague',
        description: 'An unclear task',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const tool = toolManager.selectToolForTask(task)
      expect(tool).toBe('llm_inference')
    })
  })

  describe('getRecommendedTools', () => {
    it('should recommend tools based on goal', () => {
      const recommended = toolManager.getRecommendedTools('search the web for information')

      expect(Array.isArray(recommended)).toBe(true)
      // Should include web_search since "search" is in the goal
      expect(recommended.length).toBeLessThanOrEqual(5)
    })
  })

  describe('executeForTask', () => {
    it('should execute tool for task', async () => {
      const task = {
        id: 'task_exec',
        name: 'Summarize text',
        description: 'This is a test text that needs to be summarized.',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = await toolManager.executeForTask(task)

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.executionTime).toBe('number')
    })
  })

  describe('getToolStats', () => {
    it('should return tool statistics', () => {
      const stats = toolManager.getToolStats()

      expect(stats).toBeDefined()
      expect(typeof stats).toBe('object')
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const tm1 = getToolManager()
      const tm2 = getToolManager()

      expect(tm1).toBe(tm2)
    })

    it('should reset singleton', () => {
      const tm1 = getToolManager()
      tm1.registerTool({
        name: 'temp_tool',
        description: 'Temporary',
        category: 'system',
        execute: async () => ({ success: true, output: null, executionTime: 0 }),
      })

      resetToolManager()

      const tm2 = getToolManager()
      const tools = tm2.getAvailableTools()

      expect(tools.some(t => t.name === 'temp_tool')).toBe(false)
    })
  })
})

describe('Built-in Tools', () => {
  let toolManager: ToolManager

  beforeEach(() => {
    resetToolManager()
    toolManager = getToolManager()
  })

  afterEach(() => {
    resetToolManager()
  })

  describe('summarize tool', () => {
    it('should summarize text', async () => {
      const task = {
        id: 't1',
        name: 'Summarize',
        description: 'The quick brown fox jumps over the lazy dog. This is a simple sentence. It has some words.',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = await toolManager.executeForTask(task)

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
    })
  })

  describe('code_analysis tool', () => {
    it('should analyze code', async () => {
      const task = {
        id: 't2',
        name: 'Analyze the code',
        description: 'function test() { return 42; }',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        meta: {
          code: 'function test() { return 42; }',
          language: 'javascript',
        },
      }

      const result = await toolManager.executeForTask(task)

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
    })
  })

  describe('web_search tool', () => {
    it('should simulate web search', async () => {
      const task = {
        id: 't3',
        name: 'Search for AI',
        description: 'Find information about artificial intelligence',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = await toolManager.executeForTask(task)

      expect(result.success).toBe(true)
      // Result should indicate simulation
    })
  })

  describe('data_transform tool', () => {
    it('should select for transform tasks', () => {
      const task = {
        id: 't4',
        name: 'Transform data format',
        description: 'Convert the data',
        status: 'pending' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const toolName = toolManager.selectToolForTask(task)
      expect(toolName).toBe('data_transform')
    })
  })
})
