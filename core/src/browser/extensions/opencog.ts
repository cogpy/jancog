import { BaseExtension, ExtensionTypeEnum } from '../extension'
import type { MCPTool, MCPToolCallResult } from '../../types'

export interface OrchestrationTask {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: number
  updatedAt: number
  result?: any
  error?: string
}

export interface OrchestrationPlan {
  id: string
  goal: string
  tasks: OrchestrationTask[]
  status: 'planning' | 'executing' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
}

export interface OrchestrationContext {
  threadId?: string
  conversationHistory?: any[]
  availableTools?: string[]
  modelId?: string
}

/**
 * OpenCog extension base: provides autonomous orchestration and cognitive AI capabilities.
 * OpenCog is a cognitive AI framework that enables autonomous task planning, reasoning,
 * and execution through a graph-based knowledge representation (Atomspace).
 */
export abstract class OpenCogExtension extends BaseExtension {
  type(): ExtensionTypeEnum | undefined {
    return ExtensionTypeEnum.OpenCog
  }

  /**
   * Get available orchestration tools
   */
  abstract getTools(): Promise<MCPTool[]>

  /**
   * Execute an orchestration tool
   */
  abstract callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult>

  /**
   * Create an orchestration plan from a high-level goal
   */
  abstract createPlan(goal: string, context: OrchestrationContext): Promise<OrchestrationPlan>

  /**
   * Execute an orchestration plan
   */
  abstract executePlan(planId: string): Promise<OrchestrationPlan>

  /**
   * Get the status of an orchestration plan
   */
  abstract getPlan(planId: string): Promise<OrchestrationPlan | null>

  /**
   * List all orchestration plans
   */
  abstract listPlans(): Promise<OrchestrationPlan[]>

  /**
   * Cancel a running orchestration plan
   */
  abstract cancelPlan(planId: string): Promise<boolean>
}
