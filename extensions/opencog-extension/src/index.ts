import {
  OpenCogExtension,
  MCPTool,
  MCPToolCallResult,
  type OrchestrationPlan,
  type OrchestrationTask,
  type OrchestrationContext,
  type SettingComponentProps,
} from '@janhq/core'

import {
  getOpenCogTools,
  CREATE_PLAN,
  EXECUTE_PLAN,
  GET_PLAN,
  LIST_PLANS,
  CANCEL_PLAN,
  ANALYZE_GOAL,
  REASON_ABOUT_TASK,
} from './tools'

import { TaskExecutor, type TaskExecutionResult } from './task-executor'
import { PlanPersistence, type TaskHistoryEntry } from './persistence'
import { CognitiveReasoning, type GoalAnalysis, type ReplanDecision } from './cognitive-reasoning'
import { MultiAgentCoordinator } from './multi-agent'

/**
 * OpenCog Extension for Jan - Autonomous Orchestration Engine (v2.0)
 *
 * This extension implements OpenCog-inspired cognitive AI capabilities for autonomous
 * task planning, reasoning, and execution. Enhanced features include:
 *
 * - Real task execution: Actual task processing with strategy-based execution
 * - Persistence layer: Plans and execution history are persisted
 * - Dynamic replanning: Adapts plans based on execution results
 * - Learning from history: Improves planning using past execution data
 * - Multi-agent coordination: Parallel task execution with specialized agents
 * - Enhanced cognitive reasoning: Better goal analysis and task decomposition
 */
export default class JanOpenCogExtension extends OpenCogExtension {
  private config = {
    enabled: true,
    maxTasksPerPlan: 20,
    reasoningModel: 'default',
    autoExecute: false,
    enablePersistence: true,
    enableMultiAgent: true,
    enableDynamicReplanning: true,
    maxParallelTasks: 5,
  }

  // Core components
  private taskExecutor: TaskExecutor
  private persistence: PlanPersistence
  private cognitiveReasoning: CognitiveReasoning
  private multiAgentCoordinator: MultiAgentCoordinator

  // In-memory state (synced with persistence)
  private plans: Map<string, OrchestrationPlan> = new Map()
  private executingPlans: Set<string> = new Set()
  private taskResults: Map<string, Map<string, TaskExecutionResult>> = new Map()

  constructor() {
    super()
    // Initialize components with default config
    this.taskExecutor = new TaskExecutor({
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      enableParallel: true,
      maxParallelTasks: this.config.maxParallelTasks,
    })

    this.persistence = new PlanPersistence(false) // Will be re-initialized in onLoad
    this.cognitiveReasoning = new CognitiveReasoning(this.persistence)
    this.multiAgentCoordinator = new MultiAgentCoordinator(this.taskExecutor, this.config.maxParallelTasks)
  }

  async onLoad(): Promise<void> {
    console.log('[OpenCog] Loading autonomous orchestration engine v2.0...')

    const settings = structuredClone(SETTINGS) as SettingComponentProps[]
    await this.registerSettings(settings)

    // Load configuration
    this.config.enabled = await this.getSetting('enabled', this.config.enabled)
    this.config.maxTasksPerPlan = await this.getSetting('max_tasks_per_plan', this.config.maxTasksPerPlan)
    this.config.reasoningModel = await this.getSetting('reasoning_model', this.config.reasoningModel)
    this.config.autoExecute = await this.getSetting('auto_execute', this.config.autoExecute)
    this.config.enablePersistence = await this.getSetting('enable_persistence', this.config.enablePersistence)
    this.config.enableMultiAgent = await this.getSetting('enable_multi_agent', this.config.enableMultiAgent)
    this.config.enableDynamicReplanning = await this.getSetting('enable_dynamic_replanning', this.config.enableDynamicReplanning)
    this.config.maxParallelTasks = await this.getSetting('max_parallel_tasks', this.config.maxParallelTasks)

    // Re-initialize components with loaded config
    this.persistence = new PlanPersistence(this.config.enablePersistence)
    this.cognitiveReasoning = new CognitiveReasoning(this.persistence)
    this.taskExecutor = new TaskExecutor({
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      enableParallel: this.config.enableMultiAgent,
      maxParallelTasks: this.config.maxParallelTasks,
    })
    this.multiAgentCoordinator = new MultiAgentCoordinator(this.taskExecutor, this.config.maxParallelTasks)

    // Load persisted plans
    if (this.config.enablePersistence) {
      const persistedPlans = await this.persistence.loadAll()
      for (const plan of persistedPlans) {
        this.plans.set(plan.id, plan)
      }
      console.log(`[OpenCog] Loaded ${persistedPlans.length} persisted plans`)
    }

    console.log('[OpenCog] Orchestration engine v2.0 loaded successfully')
    console.log(`[OpenCog] Features: persistence=${this.config.enablePersistence}, multi-agent=${this.config.enableMultiAgent}, replanning=${this.config.enableDynamicReplanning}`)
  }

  onUnload(): void {
    console.log('[OpenCog] Unloading orchestration engine...')

    // Cancel all executing plans
    for (const planId of this.executingPlans) {
      this.cancelPlan(planId)
    }

    // Cancel all running tasks
    this.taskExecutor.cancelAllTasks()
  }

  async getTools(): Promise<MCPTool[]> {
    return getOpenCogTools()
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.config.enabled) {
      return {
        error: 'OpenCog orchestration is disabled',
        content: [{ type: 'text', text: 'OpenCog orchestration is disabled in settings' }],
      }
    }

    try {
      switch (toolName) {
        case CREATE_PLAN:
          return await this.handleCreatePlan(args)
        case EXECUTE_PLAN:
          return await this.handleExecutePlan(args)
        case GET_PLAN:
          return await this.handleGetPlan(args)
        case LIST_PLANS:
          return await this.handleListPlans(args)
        case CANCEL_PLAN:
          return await this.handleCancelPlan(args)
        case ANALYZE_GOAL:
          return await this.handleAnalyzeGoal(args)
        case REASON_ABOUT_TASK:
          return await this.handleReasonAboutTask(args)
        default:
          return {
            error: `Unknown tool: ${toolName}`,
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
          }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        error: message,
        content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
      }
    }
  }

  async createPlan(goal: string, context: OrchestrationContext): Promise<OrchestrationPlan> {
    const planId = this.generateId('plan')

    // Use enhanced cognitive reasoning for goal analysis and decomposition
    const goalAnalysis = await this.cognitiveReasoning.analyzeGoal(goal, context)

    // Create tasks from decomposition
    const tasks: OrchestrationTask[] = goalAnalysis.decomposition.map((decomp, index) => ({
      id: this.generateId('task'),
      name: decomp.name,
      description: decomp.description,
      status: 'pending' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }))

    // Ensure we don't exceed max tasks
    const limitedTasks = tasks.slice(0, this.config.maxTasksPerPlan)

    const plan: OrchestrationPlan = {
      id: planId,
      goal,
      tasks: limitedTasks,
      status: 'executing',
      createdAt: Date.now(),
    }

    this.plans.set(planId, plan)

    // Persist the plan
    if (this.config.enablePersistence) {
      await this.persistence.save(plan)
    }

    console.log(`[OpenCog] Created plan ${planId} with ${limitedTasks.length} tasks (complexity: ${goalAnalysis.complexity})`)

    // Auto-execute if enabled
    if (this.config.autoExecute) {
      // Execute asynchronously
      this.executePlan(planId).catch(error => {
        console.error(`[OpenCog] Auto-execute failed for plan ${planId}:`, error)
      })
    }

    return plan
  }

  async executePlan(planId: string): Promise<OrchestrationPlan> {
    const plan = this.plans.get(planId)
    if (!plan) {
      throw new Error(`Plan ${planId} not found`)
    }

    if (this.executingPlans.has(planId)) {
      throw new Error(`Plan ${planId} is already executing`)
    }

    this.executingPlans.add(planId)
    plan.status = 'executing'
    this.taskResults.set(planId, new Map())

    const context: OrchestrationContext = {
      availableTools: ['read', 'write', 'search', 'execute'],
    }

    try {
      let results: Map<string, TaskExecutionResult>

      // Choose execution strategy based on config
      if (this.config.enableMultiAgent) {
        // Multi-agent parallel execution
        results = await this.multiAgentCoordinator.coordinatePlanExecution(
          plan,
          context,
          (task, agent, result) => {
            console.log(`[OpenCog] Task "${task.name}" completed by ${agent.role} agent (success: ${result.success})`)
            this.taskResults.get(planId)?.set(task.id, result)
          }
        )
      } else {
        // Sequential execution with task executor
        for (const task of plan.tasks) {
          if (!this.executingPlans.has(planId)) {
            // Plan was cancelled
            break
          }

          const result = await this.taskExecutor.executeTask(task, plan, context)
          this.taskResults.get(planId)?.set(task.id, result)

          // Update task status
          task.status = result.success ? 'completed' : 'failed'
          task.result = result.output
          if (!result.success) {
            task.error = result.error
          }
          task.updatedAt = Date.now()

          // Check for dynamic replanning
          if (this.config.enableDynamicReplanning && !result.success) {
            const replanDecision = await this.evaluateAndReplan(plan, this.taskResults.get(planId)!)
            if (replanDecision.shouldReplan) {
              console.log(`[OpenCog] Replanning triggered: ${replanDecision.reason}`)
            }
          }
        }

        results = this.taskResults.get(planId)!
      }

      // Record execution for learning
      const taskHistoryMap = new Map<string, TaskHistoryEntry>()
      for (const [taskId, result] of results) {
        const task = plan.tasks.find(t => t.id === taskId)
        if (task) {
          taskHistoryMap.set(taskId, {
            taskId,
            name: task.name,
            description: task.description,
            status: task.status,
            executionTime: result.executionTime,
            retryCount: result.metrics.retryCount,
            confidence: result.metrics.confidence,
            error: task.error,
          })
        }
      }

      // Check completion status
      const allCompleted = plan.tasks.every(t => t.status === 'completed')
      plan.status = allCompleted ? 'completed' : 'failed'
      plan.completedAt = Date.now()

      // Record for learning
      this.persistence.recordExecution(plan, taskHistoryMap)

      // Persist updated plan
      if (this.config.enablePersistence) {
        await this.persistence.save(plan)
      }

      console.log(`[OpenCog] Plan ${planId} ${plan.status} (${plan.tasks.filter(t => t.status === 'completed').length}/${plan.tasks.length} tasks completed)`)
    } catch (error) {
      plan.status = 'failed'
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[OpenCog] Plan execution failed:`, message)
    } finally {
      this.executingPlans.delete(planId)
    }

    return plan
  }

  /**
   * Evaluate execution and apply replanning if needed
   */
  private async evaluateAndReplan(
    plan: OrchestrationPlan,
    results: Map<string, TaskExecutionResult>
  ): Promise<ReplanDecision> {
    const decision = this.cognitiveReasoning.evaluateReplan(plan, results)

    if (decision.shouldReplan && decision.suggestedChanges.length > 0) {
      const updatedPlan = this.cognitiveReasoning.applyReplanChanges(plan, decision.suggestedChanges)

      // Update the plan in memory
      this.plans.set(plan.id, updatedPlan)
      Object.assign(plan, updatedPlan)

      // Persist the updated plan
      if (this.config.enablePersistence) {
        await this.persistence.save(updatedPlan)
      }

      console.log(`[OpenCog] Applied ${decision.suggestedChanges.length} replan changes to plan ${plan.id}`)
    }

    return decision
  }

  async getPlan(planId: string): Promise<OrchestrationPlan | null> {
    return this.plans.get(planId) || null
  }

  async listPlans(): Promise<OrchestrationPlan[]> {
    return Array.from(this.plans.values())
  }

  async cancelPlan(planId: string): Promise<boolean> {
    if (!this.executingPlans.has(planId)) {
      return false
    }

    this.executingPlans.delete(planId)

    const plan = this.plans.get(planId)
    if (plan) {
      plan.status = 'failed'
      plan.tasks.forEach(task => {
        if (task.status === 'pending' || task.status === 'running') {
          task.status = 'failed'
          task.error = 'Plan cancelled'
          task.updatedAt = Date.now()

          // Cancel running task
          this.taskExecutor.cancelTask(task.id)
        }
      })

      // Persist the cancelled plan
      if (this.config.enablePersistence) {
        await this.persistence.save(plan)
      }
    }

    return true
  }

  private async handleCreatePlan(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const goal = String(args['goal'] || '')
    if (!goal) {
      return {
        error: 'Missing goal',
        content: [{ type: 'text', text: 'Goal is required to create a plan' }],
      }
    }

    const context: OrchestrationContext = (args['context'] as OrchestrationContext) || {}
    const plan = await this.createPlan(goal, context)

    // Get recommendations from learning
    const recommendations = this.persistence.getRecommendations(goal)

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            plan_id: plan.id,
            goal: plan.goal,
            tasks: plan.tasks.map(t => ({
              id: t.id,
              name: t.name,
              description: t.description,
              status: t.status,
            })),
            status: plan.status,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
          }, null, 2),
        },
      ],
    }
  }

  private async handleExecutePlan(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const planId = String(args['plan_id'] || '')
    if (!planId) {
      return {
        error: 'Missing plan_id',
        content: [{ type: 'text', text: 'plan_id is required' }],
      }
    }

    const plan = await this.executePlan(planId)
    const results = this.taskResults.get(planId)

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            plan_id: plan.id,
            status: plan.status,
            tasks: plan.tasks.map(t => {
              const result = results?.get(t.id)
              return {
                id: t.id,
                name: t.name,
                status: t.status,
                result: t.result,
                error: t.error,
                execution_time: result?.executionTime,
                confidence: result?.metrics.confidence,
              }
            }),
            completed_at: plan.completedAt,
            total_duration: plan.completedAt ? plan.completedAt - plan.createdAt : undefined,
          }, null, 2),
        },
      ],
    }
  }

  private async handleGetPlan(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const planId = String(args['plan_id'] || '')
    if (!planId) {
      return {
        error: 'Missing plan_id',
        content: [{ type: 'text', text: 'plan_id is required' }],
      }
    }

    const plan = await this.getPlan(planId)
    if (!plan) {
      return {
        error: 'Plan not found',
        content: [{ type: 'text', text: `Plan ${planId} not found` }],
      }
    }

    return {
      error: '',
      content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
    }
  }

  private async handleListPlans(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const statusFilter = String(args['status'] || 'all')
    let plans = await this.listPlans()

    if (statusFilter !== 'all') {
      plans = plans.filter(p => p.status === statusFilter)
    }

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            plans: plans.map(p => ({
              id: p.id,
              goal: p.goal,
              status: p.status,
              created_at: p.createdAt,
              completed_at: p.completedAt,
              task_count: p.tasks.length,
              completed_tasks: p.tasks.filter(t => t.status === 'completed').length,
            })),
            total_count: plans.length,
          }, null, 2),
        },
      ],
    }
  }

  private async handleCancelPlan(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const planId = String(args['plan_id'] || '')
    if (!planId) {
      return {
        error: 'Missing plan_id',
        content: [{ type: 'text', text: 'plan_id is required' }],
      }
    }

    const cancelled = await this.cancelPlan(planId)

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({ cancelled, plan_id: planId }),
        },
      ],
    }
  }

  private async handleAnalyzeGoal(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const goal = String(args['goal'] || '')
    if (!goal) {
      return {
        error: 'Missing goal',
        content: [{ type: 'text', text: 'Goal is required for analysis' }],
      }
    }

    const context: OrchestrationContext = (args['context'] as OrchestrationContext) || {}

    // Use enhanced cognitive reasoning
    const analysis = await this.cognitiveReasoning.analyzeGoal(goal, context)

    // Add learning-based insights
    const historicalInsights = this.persistence.getInsightsForGoal(goal)

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            goal: analysis.goal,
            complexity: analysis.complexity,
            complexity_score: analysis.complexityScore,
            estimated_tasks: analysis.estimatedTasks,
            feasibility: analysis.feasibility,
            feasibility_score: analysis.feasibilityScore,
            required_capabilities: analysis.requiredCapabilities,
            potential_risks: analysis.potentialRisks,
            recommendations: analysis.recommendations,
            suggested_decomposition: analysis.decomposition.map(d => ({
              name: d.name,
              type: d.type,
              parallelizable: d.parallelizable,
            })),
            historical_insights: historicalInsights ? {
              similar_goals_executed: historicalInsights.occurrences,
              average_success_rate: historicalInsights.averageSuccessRate,
              best_task_structure: historicalInsights.bestDecomposition,
            } : null,
          }, null, 2),
        },
      ],
    }
  }

  private async handleReasonAboutTask(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const taskDescription = String(args['task_description'] || '')
    if (!taskDescription) {
      return {
        error: 'Missing task_description',
        content: [{ type: 'text', text: 'task_description is required' }],
      }
    }

    const context = (args['context'] as Record<string, unknown>) || {}

    // Use enhanced cognitive reasoning
    const reasoning = await this.cognitiveReasoning.reasonAboutTask(taskDescription, context)

    // Add historical performance data
    const historicalSuccessRate = this.persistence.getTaskSuccessRate(taskDescription)
    const averageExecutionTime = this.persistence.getAverageExecutionTime(taskDescription)

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            task: reasoning.task,
            reasoning: reasoning.reasoning,
            approach: reasoning.approach,
            optimal_strategy: reasoning.optimalStrategy,
            estimated_duration: reasoning.estimatedDuration,
            confidence: reasoning.confidence,
            dependencies: reasoning.dependencies,
            alternatives: reasoning.alternatives,
            risks: reasoning.risks,
            historical_performance: {
              success_rate: historicalSuccessRate,
              average_execution_time_ms: averageExecutionTime,
            },
          }, null, 2),
        },
      ],
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  onSettingUpdate<T>(key: string, value: T): void {
    switch (key) {
      case 'enabled':
        this.config.enabled = Boolean(value)
        break
      case 'max_tasks_per_plan':
        this.config.maxTasksPerPlan = Number(value)
        break
      case 'reasoning_model':
        this.config.reasoningModel = String(value)
        break
      case 'auto_execute':
        this.config.autoExecute = Boolean(value)
        break
      case 'enable_persistence':
        this.config.enablePersistence = Boolean(value)
        break
      case 'enable_multi_agent':
        this.config.enableMultiAgent = Boolean(value)
        break
      case 'enable_dynamic_replanning':
        this.config.enableDynamicReplanning = Boolean(value)
        break
      case 'max_parallel_tasks':
        this.config.maxParallelTasks = Number(value)
        break
    }
  }
}

const SETTINGS: SettingComponentProps[] = [
  {
    key: 'enabled',
    title: 'Enable OpenCog Orchestration',
    description: 'Enable autonomous task orchestration and cognitive reasoning',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'max_tasks_per_plan',
    title: 'Maximum Tasks Per Plan',
    description: 'Maximum number of tasks that can be generated in a single orchestration plan',
    controllerType: 'slider',
    controllerProps: {
      value: 20,
      min: 1,
      max: 50,
      step: 1,
    },
  },
  {
    key: 'reasoning_model',
    title: 'Reasoning Model',
    description: 'Model to use for cognitive reasoning and goal decomposition',
    controllerType: 'input',
    controllerProps: {
      value: 'default',
      placeholder: 'default',
    },
  },
  {
    key: 'auto_execute',
    title: 'Auto-Execute Plans',
    description: 'Automatically execute plans after creation',
    controllerType: 'checkbox',
    controllerProps: {
      value: false,
    },
  },
  {
    key: 'enable_persistence',
    title: 'Enable Persistence',
    description: 'Persist plans and execution history for learning',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'enable_multi_agent',
    title: 'Enable Multi-Agent Execution',
    description: 'Use multiple specialized agents for parallel task execution',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'enable_dynamic_replanning',
    title: 'Enable Dynamic Replanning',
    description: 'Automatically adjust plans based on execution results',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'max_parallel_tasks',
    title: 'Maximum Parallel Tasks',
    description: 'Maximum number of tasks to execute in parallel',
    controllerType: 'slider',
    controllerProps: {
      value: 5,
      min: 1,
      max: 10,
      step: 1,
    },
  },
]
