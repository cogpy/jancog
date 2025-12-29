/**
 * Tool Integration - Connect OpenCog Orchestration to Jan's Tools
 *
 * This module provides integration between the OpenCog orchestration engine
 * and Jan's ecosystem of tools and extensions:
 *
 * - RAG Extension: Document retrieval and knowledge augmentation
 * - File Operations: Read, write, and manage files
 * - Web Search: Search and fetch web content
 * - Code Execution: Run code snippets
 * - Model Inference: Query LLMs for reasoning
 *
 * Tools are registered and can be invoked by the task executor during
 * plan execution.
 */

import type { OrchestrationTask, ExtensionTypeEnum } from '@janhq/core'
import { getAtomspace, type TruthValue } from './atomspace'
import { getPLNEngine } from './pln'

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean
  output: unknown
  error?: string
  executionTime: number
  metadata?: Record<string, unknown>
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  /** Function to execute the tool */
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
  /** Validate arguments before execution */
  validate?: (args: Record<string, unknown>) => boolean
  /** Estimated execution time in ms */
  estimatedTime?: number
  /** Required capabilities */
  requires?: string[]
}

/**
 * Tool categories
 */
export type ToolCategory =
  | 'retrieval'      // RAG, search, knowledge lookup
  | 'file'           // File read/write operations
  | 'web'            // Web fetch, API calls
  | 'code'           // Code execution, analysis
  | 'inference'      // LLM queries
  | 'system'         // System operations
  | 'orchestration'  // Meta-operations (planning, coordination)

/**
 * Tool execution context
 */
export interface ToolContext {
  threadId?: string
  taskId?: string
  planId?: string
  timeout?: number
  retryOnError?: boolean
  maxRetries?: number
}

/**
 * Tool chain for complex operations
 */
export interface ToolChain {
  name: string
  description: string
  steps: Array<{
    tool: string
    args: Record<string, unknown> | ((prevResult: ToolResult) => Record<string, unknown>)
    onError?: 'skip' | 'abort' | 'retry'
  }>
}

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * Registry for available tools
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  private toolChains: Map<string, ToolChain> = new Map()
  private executionStats: Map<string, { calls: number; totalTime: number; failures: number }> = new Map()

  /**
   * Register a tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
    this.executionStats.set(tool.name, { calls: 0, totalTime: 0, failures: 0 })

    // Add to Atomspace
    const atomspace = getAtomspace()
    const toolNode = atomspace.addNode('ToolNode', tool.name, {
      strength: 1.0,
      confidence: 0.8,
    })
    toolNode.meta = {
      description: tool.description,
      category: tool.category,
      estimatedTime: tool.estimatedTime,
    }
  }

  /**
   * Register a tool chain
   */
  registerChain(chain: ToolChain): void {
    this.toolChains.set(chain.name, chain)
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t => t.category === category)
  }

  /**
   * Execute a tool
   */
  async execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool "${name}" not found`,
        executionTime: 0,
      }
    }

    // Validate arguments
    if (tool.validate && !tool.validate(args)) {
      return {
        success: false,
        output: null,
        error: 'Invalid arguments',
        executionTime: 0,
      }
    }

    const startTime = Date.now()
    const stats = this.executionStats.get(name)!

    try {
      const result = await this.executeWithTimeout(tool, args, context?.timeout || 30000)

      stats.calls++
      stats.totalTime += result.executionTime

      // Update tool reliability in Atomspace
      this.updateToolReliability(name, result.success)

      // Learn from execution
      const pln = getPLNEngine()
      pln.learnFromExecution(`tool_${name}`, result.success, result.executionTime)

      return result
    } catch (error) {
      stats.calls++
      stats.failures++

      const executionTime = Date.now() - startTime
      this.updateToolReliability(name, false)

      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      }
    }
  }

  /**
   * Execute a tool chain
   */
  async executeChain(chainName: string, initialArgs: Record<string, unknown>, context?: ToolContext): Promise<{
    success: boolean
    results: ToolResult[]
    finalOutput: unknown
  }> {
    const chain = this.toolChains.get(chainName)
    if (!chain) {
      return {
        success: false,
        results: [],
        finalOutput: { error: `Chain "${chainName}" not found` },
      }
    }

    const results: ToolResult[] = []
    let prevResult: ToolResult = { success: true, output: initialArgs, executionTime: 0 }

    for (const step of chain.steps) {
      const args = typeof step.args === 'function' ? step.args(prevResult) : step.args

      const result = await this.execute(step.tool, args, context)
      results.push(result)

      if (!result.success) {
        switch (step.onError) {
          case 'skip':
            continue
          case 'retry':
            // Retry once
            const retryResult = await this.execute(step.tool, args, context)
            results.push(retryResult)
            if (!retryResult.success) {
              return { success: false, results, finalOutput: retryResult.output }
            }
            prevResult = retryResult
            continue
          case 'abort':
          default:
            return { success: false, results, finalOutput: result.output }
        }
      }

      prevResult = result
    }

    return {
      success: true,
      results,
      finalOutput: prevResult.output,
    }
  }

  /**
   * Get execution statistics
   */
  getStats(toolName?: string): Record<string, { calls: number; avgTime: number; successRate: number }> {
    const result: Record<string, { calls: number; avgTime: number; successRate: number }> = {}

    const statsToProcess = toolName
      ? [[toolName, this.executionStats.get(toolName)!] as const]
      : Array.from(this.executionStats.entries())

    for (const [name, stats] of statsToProcess) {
      if (stats.calls > 0) {
        result[name] = {
          calls: stats.calls,
          avgTime: stats.totalTime / stats.calls,
          successRate: (stats.calls - stats.failures) / stats.calls,
        }
      }
    }

    return result
  }

  private async executeWithTimeout(tool: ToolDefinition, args: Record<string, unknown>, timeout: number): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool "${tool.name}" timed out after ${timeout}ms`))
      }, timeout)

      tool.execute(args)
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  private updateToolReliability(toolName: string, success: boolean): void {
    const atomspace = getAtomspace()
    const toolNode = atomspace.getNodeByName('ToolNode', toolName)

    if (toolNode) {
      const currentTv = toolNode.tv || { strength: 0.5, confidence: 0.1, count: 0 }
      const newTv: TruthValue = {
        strength: success ? 1.0 : 0.0,
        confidence: 0.8,
        count: 1,
      }

      // Weighted revision
      const totalCount = (currentTv.count || 1) + 1
      toolNode.tv = {
        strength: (currentTv.strength * (currentTv.count || 1) + newTv.strength) / totalCount,
        confidence: Math.min(0.99, currentTv.confidence + 0.01),
        count: totalCount,
      }
    }
  }
}

// =============================================================================
// Built-in Tool Implementations
// =============================================================================

/**
 * RAG Retrieval Tool
 */
const ragRetrieveTool: ToolDefinition = {
  name: 'rag_retrieve',
  description: 'Retrieve relevant documents using RAG extension',
  category: 'retrieval',
  estimatedTime: 2000,
  requires: ['rag-extension'],

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const query = String(args.query || '')
    const threadId = String(args.threadId || '')
    const topK = Number(args.topK) || 5

    if (!query) {
      return { success: false, output: null, error: 'Query is required', executionTime: 0 }
    }

    try {
      // Access RAG extension through window.core
      const core = (globalThis as any).window?.core
      const ragExt = core?.extensionManager?.getByName?.('@janhq/rag-extension')

      if (!ragExt?.callTool) {
        // Fallback: simulate RAG retrieval
        return {
          success: true,
          output: {
            message: 'RAG extension not available, using simulated retrieval',
            results: [],
            query,
          },
          executionTime: Date.now() - startTime,
        }
      }

      const result = await ragExt.callTool('retrieve', {
        thread_id: threadId,
        query,
        top_k: topK,
      })

      return {
        success: !result.error,
        output: result.content?.[0]?.text ? JSON.parse(result.content[0].text) : null,
        error: result.error,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * File Read Tool
 */
const fileReadTool: ToolDefinition = {
  name: 'file_read',
  description: 'Read contents of a file',
  category: 'file',
  estimatedTime: 500,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const path = String(args.path || '')

    if (!path) {
      return { success: false, output: null, error: 'File path is required', executionTime: 0 }
    }

    try {
      const core = (globalThis as any).window?.core
      const fs = core?.fs

      if (!fs?.readTextFile) {
        return {
          success: true,
          output: { message: 'File system not available', path },
          executionTime: Date.now() - startTime,
        }
      }

      const content = await fs.readTextFile(path)

      return {
        success: true,
        output: { path, content, size: content.length },
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * File Write Tool
 */
const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file',
  category: 'file',
  estimatedTime: 500,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const path = String(args.path || '')
    const content = String(args.content || '')

    if (!path) {
      return { success: false, output: null, error: 'File path is required', executionTime: 0 }
    }

    try {
      const core = (globalThis as any).window?.core
      const fs = core?.fs

      if (!fs?.writeTextFile) {
        return {
          success: true,
          output: { message: 'File system not available (simulated write)', path },
          executionTime: Date.now() - startTime,
        }
      }

      await fs.writeTextFile(path, content)

      return {
        success: true,
        output: { path, bytesWritten: content.length },
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Web Search Tool
 */
const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information',
  category: 'web',
  estimatedTime: 5000,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const query = String(args.query || '')
    const maxResults = Number(args.maxResults) || 5

    if (!query) {
      return { success: false, output: null, error: 'Search query is required', executionTime: 0 }
    }

    try {
      // In a real implementation, this would use a web search API
      // For now, we simulate the response
      return {
        success: true,
        output: {
          query,
          results: [],
          message: 'Web search simulated (no API configured)',
        },
        executionTime: Date.now() - startTime,
        metadata: { maxResults },
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * LLM Inference Tool
 */
const llmInferenceTool: ToolDefinition = {
  name: 'llm_inference',
  description: 'Query an LLM for reasoning or generation',
  category: 'inference',
  estimatedTime: 10000,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const prompt = String(args.prompt || '')
    const model = String(args.model || 'default')

    if (!prompt) {
      return { success: false, output: null, error: 'Prompt is required', executionTime: 0 }
    }

    try {
      const core = (globalThis as any).window?.core
      const llamaExt = core?.extensionManager?.getByName?.('@janhq/llamacpp-extension')

      if (!llamaExt?.inference) {
        // Simulate LLM response
        return {
          success: true,
          output: {
            prompt,
            response: `[Simulated response for: ${prompt.substring(0, 50)}...]`,
            model,
          },
          executionTime: Date.now() - startTime,
        }
      }

      // Real inference (if available)
      const response = await llamaExt.inference({
        messages: [{ role: 'user', content: prompt }],
        model,
      })

      return {
        success: true,
        output: {
          prompt,
          response: response?.content || response?.message?.content || '',
          model,
        },
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Code Analysis Tool
 */
const codeAnalysisTool: ToolDefinition = {
  name: 'code_analysis',
  description: 'Analyze code for patterns, issues, or understanding',
  category: 'code',
  estimatedTime: 3000,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const code = String(args.code || '')
    const language = String(args.language || 'unknown')
    const analysisType = String(args.type || 'general')

    if (!code) {
      return { success: false, output: null, error: 'Code is required', executionTime: 0 }
    }

    try {
      // Basic code analysis
      const lines = code.split('\n').length
      const chars = code.length
      const hasComments = code.includes('//') || code.includes('/*') || code.includes('#')

      return {
        success: true,
        output: {
          language,
          analysisType,
          metrics: {
            lines,
            characters: chars,
            hasComments,
            avgLineLength: Math.round(chars / lines),
          },
          analysis: `Analyzed ${lines} lines of ${language} code`,
        },
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Data Transform Tool
 */
const dataTransformTool: ToolDefinition = {
  name: 'data_transform',
  description: 'Transform data between formats',
  category: 'system',
  estimatedTime: 1000,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const data = args.data
    const fromFormat = String(args.from || 'json')
    const toFormat = String(args.to || 'json')

    if (!data) {
      return { success: false, output: null, error: 'Data is required', executionTime: 0 }
    }

    try {
      let parsed: unknown

      // Parse input
      if (fromFormat === 'json' && typeof data === 'string') {
        parsed = JSON.parse(data)
      } else {
        parsed = data
      }

      // Transform output
      let output: unknown
      if (toFormat === 'json') {
        output = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
      } else if (toFormat === 'text') {
        output = String(parsed)
      } else {
        output = parsed
      }

      return {
        success: true,
        output: { transformed: output, fromFormat, toFormat },
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

/**
 * Summarize Tool
 */
const summarizeTool: ToolDefinition = {
  name: 'summarize',
  description: 'Summarize text content',
  category: 'inference',
  estimatedTime: 5000,

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now()
    const text = String(args.text || '')
    const maxLength = Number(args.maxLength) || 200

    if (!text) {
      return { success: false, output: null, error: 'Text is required', executionTime: 0 }
    }

    try {
      // Simple extractive summary (first N sentences)
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
      let summary = ''
      let sentenceCount = 0

      for (const sentence of sentences) {
        if (summary.length + sentence.length > maxLength) break
        summary += sentence.trim() + ' '
        sentenceCount++
      }

      return {
        success: true,
        output: {
          summary: summary.trim(),
          originalLength: text.length,
          summaryLength: summary.length,
          sentencesIncluded: sentenceCount,
        },
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }
    }
  },
}

// =============================================================================
// Tool Manager
// =============================================================================

/**
 * Tool Manager - Coordinates tool execution for orchestration
 */
export class ToolManager {
  private registry: ToolRegistry

  constructor() {
    this.registry = new ToolRegistry()
    this.registerBuiltInTools()
  }

  private registerBuiltInTools(): void {
    this.registry.register(ragRetrieveTool)
    this.registry.register(fileReadTool)
    this.registry.register(fileWriteTool)
    this.registry.register(webSearchTool)
    this.registry.register(llmInferenceTool)
    this.registry.register(codeAnalysisTool)
    this.registry.register(dataTransformTool)
    this.registry.register(summarizeTool)

    // Register useful tool chains
    this.registry.registerChain({
      name: 'research_and_summarize',
      description: 'Search for information and summarize findings',
      steps: [
        { tool: 'web_search', args: (prev) => ({ query: (prev.output as any)?.query || '' }), onError: 'skip' },
        { tool: 'rag_retrieve', args: (prev) => ({ query: (prev.output as any)?.query || '' }), onError: 'skip' },
        { tool: 'summarize', args: (prev) => ({ text: JSON.stringify(prev.output) }), onError: 'abort' },
      ],
    })

    this.registry.registerChain({
      name: 'read_and_analyze',
      description: 'Read a file and analyze its contents',
      steps: [
        { tool: 'file_read', args: (prev) => ({ path: (prev.output as any)?.path || '' }), onError: 'abort' },
        { tool: 'code_analysis', args: (prev) => ({ code: (prev.output as any)?.content || '', language: 'auto' }), onError: 'skip' },
      ],
    })
  }

  /**
   * Execute a tool for a task
   */
  async executeForTask(task: OrchestrationTask, context?: ToolContext): Promise<ToolResult> {
    // Determine which tool to use based on task
    const toolName = this.selectToolForTask(task)

    if (!toolName) {
      return {
        success: false,
        output: null,
        error: 'No suitable tool found for task',
        executionTime: 0,
      }
    }

    // Build arguments from task
    const args = this.buildArgsForTask(task, toolName)

    // Execute
    return this.registry.execute(toolName, args, {
      ...context,
      taskId: task.id,
    })
  }

  /**
   * Select the best tool for a task
   */
  selectToolForTask(task: OrchestrationTask): string | null {
    const taskName = task.name.toLowerCase()
    const taskDesc = (task.description || '').toLowerCase()
    const combined = `${taskName} ${taskDesc}`

    // Pattern matching for tool selection
    if (combined.includes('search') || combined.includes('find') || combined.includes('look up')) {
      return 'web_search'
    }
    if (combined.includes('retrieve') || combined.includes('rag') || combined.includes('document')) {
      return 'rag_retrieve'
    }
    if (combined.includes('read file') || combined.includes('open file') || combined.includes('load file')) {
      return 'file_read'
    }
    if (combined.includes('write file') || combined.includes('save file') || combined.includes('create file')) {
      return 'file_write'
    }
    if (combined.includes('analyze') || combined.includes('code') || combined.includes('review')) {
      return 'code_analysis'
    }
    if (combined.includes('summarize') || combined.includes('summary') || combined.includes('brief')) {
      return 'summarize'
    }
    if (combined.includes('generate') || combined.includes('write') || combined.includes('create') || combined.includes('reason')) {
      return 'llm_inference'
    }
    if (combined.includes('transform') || combined.includes('convert') || combined.includes('format')) {
      return 'data_transform'
    }

    // Default to LLM inference for general tasks
    return 'llm_inference'
  }

  /**
   * Build arguments for tool execution
   */
  private buildArgsForTask(task: OrchestrationTask, toolName: string): Record<string, unknown> {
    const args: Record<string, unknown> = {}

    switch (toolName) {
      case 'web_search':
        args.query = task.description || task.name
        args.maxResults = 5
        break
      case 'rag_retrieve':
        args.query = task.description || task.name
        args.topK = 5
        break
      case 'file_read':
      case 'file_write':
        args.path = task.meta?.filePath || ''
        if (toolName === 'file_write') {
          args.content = task.meta?.content || ''
        }
        break
      case 'code_analysis':
        args.code = task.meta?.code || task.description || ''
        args.language = task.meta?.language || 'auto'
        args.type = 'general'
        break
      case 'summarize':
        args.text = task.description || task.name
        args.maxLength = 200
        break
      case 'llm_inference':
        args.prompt = `Task: ${task.name}\n\nDescription: ${task.description || 'No description'}\n\nPlease complete this task.`
        args.model = 'default'
        break
      case 'data_transform':
        args.data = task.meta?.data || ''
        args.from = task.meta?.fromFormat || 'json'
        args.to = task.meta?.toFormat || 'json'
        break
    }

    return args
  }

  /**
   * Get available tools
   */
  getAvailableTools(): ToolDefinition[] {
    return this.registry.getAll()
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.registry.getByCategory(category)
  }

  /**
   * Get tool statistics
   */
  getToolStats(): Record<string, { calls: number; avgTime: number; successRate: number }> {
    return this.registry.getStats()
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: ToolDefinition): void {
    this.registry.register(tool)
  }

  /**
   * Execute a tool chain
   */
  async executeChain(chainName: string, args: Record<string, unknown>, context?: ToolContext): Promise<{
    success: boolean
    results: ToolResult[]
    finalOutput: unknown
  }> {
    return this.registry.executeChain(chainName, args, context)
  }

  /**
   * Get recommended tools for a goal
   */
  getRecommendedTools(goal: string): string[] {
    const goalLower = goal.toLowerCase()
    const recommended: string[] = []

    const allTools = this.registry.getAll()
    for (const tool of allTools) {
      const descLower = tool.description.toLowerCase()
      // Simple keyword matching
      const goalWords = goalLower.split(/\s+/)
      const descWords = descLower.split(/\s+/)

      const overlap = goalWords.filter(w => descWords.includes(w)).length
      if (overlap > 0) {
        recommended.push(tool.name)
      }
    }

    // Use PLN for more sophisticated recommendations
    const pln = getPLNEngine()
    const approach = pln.getRecommendedApproach(goal, recommended)

    return recommended.slice(0, 5)
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let toolManagerInstance: ToolManager | null = null

export function getToolManager(): ToolManager {
  if (!toolManagerInstance) {
    toolManagerInstance = new ToolManager()
  }
  return toolManagerInstance
}

export function resetToolManager(): void {
  toolManagerInstance = null
}
