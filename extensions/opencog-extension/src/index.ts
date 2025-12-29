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
  // New v3.0 tools
  QUERY_KNOWLEDGE,
  INFER_KNOWLEDGE,
  EXECUTE_TOOL,
  GET_KNOWLEDGE_STATS,
} from './tools'

import { TaskExecutor, type TaskExecutionResult } from './task-executor'
import { PlanPersistence, type TaskHistoryEntry } from './persistence'
import { CognitiveReasoning, type GoalAnalysis, type ReplanDecision } from './cognitive-reasoning'
import { MultiAgentCoordinator } from './multi-agent'

// v3.0 imports - Atomspace, PLN, and Tool Integration
import { Atomspace, getAtomspace, resetAtomspace, type AtomPattern } from './atomspace'
import { PLNEngine, getPLNEngine, resetPLNEngine, type ForwardChainingConfig, type BackwardChainingConfig } from './pln'
import { ToolManager, getToolManager, resetToolManager } from './tool-integration'

/**
 * OpenCog Extension for Jan - Autonomous Orchestration Engine (v3.0)
 *
 * This extension implements OpenCog-inspired cognitive AI capabilities for autonomous
 * task planning, reasoning, and execution. Enhanced features include:
 *
 * v2.0 Features:
 * - Real task execution: Actual task processing with strategy-based execution
 * - Persistence layer: Plans and execution history are persisted
 * - Dynamic replanning: Adapts plans based on execution results
 * - Learning from history: Improves planning using past execution data
 * - Multi-agent coordination: Parallel task execution with specialized agents
 * - Enhanced cognitive reasoning: Better goal analysis and task decomposition
 *
 * v3.0 Features (NEW):
 * - Atomspace: Graph-based knowledge representation with nodes and links
 * - PLN (Probabilistic Logic Networks): Probabilistic inference and reasoning
 * - Tool Integration: Connect orchestration to Jan's tools (RAG, files, web, LLM)
 * - Knowledge-driven planning: Use stored knowledge to improve planning
 * - Inference-based task selection: PLN-powered optimal strategy selection
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
    // v3.0 settings
    enableAtomspace: true,
    enablePLN: true,
    enableToolIntegration: true,
    plnMaxIterations: 10,
    plnMinConfidence: 0.3,
  }

  // Core components (v2.0)
  private taskExecutor: TaskExecutor
  private persistence: PlanPersistence
  private cognitiveReasoning: CognitiveReasoning
  private multiAgentCoordinator: MultiAgentCoordinator

  // v3.0 components
  private atomspace: Atomspace
  private plnEngine: PLNEngine
  private toolManager: ToolManager

  // In-memory state (synced with persistence)
  private plans: Map<string, OrchestrationPlan> = new Map()
  private executingPlans: Set<string> = new Set()
  private taskResults: Map<string, Map<string, TaskExecutionResult>> = new Map()

  constructor() {
    super()
    // Initialize v2.0 components with default config
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

    // Initialize v3.0 components
    this.atomspace = getAtomspace()
    this.plnEngine = getPLNEngine()
    this.toolManager = getToolManager()
  }

  async onLoad(): Promise<void> {
    console.log('[OpenCog] Loading autonomous orchestration engine v3.0...')

    const settings = structuredClone(SETTINGS) as SettingComponentProps[]
    await this.registerSettings(settings)

    // Load v2.0 configuration
    this.config.enabled = await this.getSetting('enabled', this.config.enabled)
    this.config.maxTasksPerPlan = await this.getSetting('max_tasks_per_plan', this.config.maxTasksPerPlan)
    this.config.reasoningModel = await this.getSetting('reasoning_model', this.config.reasoningModel)
    this.config.autoExecute = await this.getSetting('auto_execute', this.config.autoExecute)
    this.config.enablePersistence = await this.getSetting('enable_persistence', this.config.enablePersistence)
    this.config.enableMultiAgent = await this.getSetting('enable_multi_agent', this.config.enableMultiAgent)
    this.config.enableDynamicReplanning = await this.getSetting('enable_dynamic_replanning', this.config.enableDynamicReplanning)
    this.config.maxParallelTasks = await this.getSetting('max_parallel_tasks', this.config.maxParallelTasks)

    // Load v3.0 configuration
    this.config.enableAtomspace = await this.getSetting('enable_atomspace', this.config.enableAtomspace)
    this.config.enablePLN = await this.getSetting('enable_pln', this.config.enablePLN)
    this.config.enableToolIntegration = await this.getSetting('enable_tool_integration', this.config.enableToolIntegration)
    this.config.plnMaxIterations = await this.getSetting('pln_max_iterations', this.config.plnMaxIterations)
    this.config.plnMinConfidence = await this.getSetting('pln_min_confidence', this.config.plnMinConfidence)

    // Re-initialize v2.0 components with loaded config
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

    // Initialize v3.0 components
    if (this.config.enableAtomspace) {
      this.atomspace = getAtomspace()
      console.log(`[OpenCog] Atomspace initialized with ${this.atomspace.getStats().atomCount} atoms`)
    }

    if (this.config.enablePLN) {
      this.plnEngine = getPLNEngine()
      console.log(`[OpenCog] PLN engine initialized with ${this.plnEngine.getRules().length} inference rules`)
    }

    if (this.config.enableToolIntegration) {
      this.toolManager = getToolManager()
      console.log(`[OpenCog] Tool manager initialized with ${this.toolManager.getAvailableTools().length} tools`)
    }

    // Load persisted plans
    if (this.config.enablePersistence) {
      const persistedPlans = await this.persistence.loadAll()
      for (const plan of persistedPlans) {
        this.plans.set(plan.id, plan)

        // Index plan knowledge in Atomspace
        if (this.config.enableAtomspace) {
          this.atomspace.addPlanKnowledge(plan)
        }
      }
      console.log(`[OpenCog] Loaded ${persistedPlans.length} persisted plans`)
    }

    console.log('[OpenCog] Orchestration engine v3.0 loaded successfully')
    console.log(`[OpenCog] v2.0 Features: persistence=${this.config.enablePersistence}, multi-agent=${this.config.enableMultiAgent}, replanning=${this.config.enableDynamicReplanning}`)
    console.log(`[OpenCog] v3.0 Features: atomspace=${this.config.enableAtomspace}, pln=${this.config.enablePLN}, tools=${this.config.enableToolIntegration}`)
  }

  onUnload(): void {
    console.log('[OpenCog] Unloading orchestration engine...')

    // Cancel all executing plans
    for (const planId of this.executingPlans) {
      this.cancelPlan(planId)
    }

    // Cancel all running tasks
    this.taskExecutor.cancelAllTasks()

    // Cleanup v3.0 components
    resetAtomspace()
    resetPLNEngine()
    resetToolManager()
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
        // v2.0 tools
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
        // v3.0 tools
        case QUERY_KNOWLEDGE:
          return await this.handleQueryKnowledge(args)
        case INFER_KNOWLEDGE:
          return await this.handleInferKnowledge(args)
        case EXECUTE_TOOL:
          return await this.handleExecuteTool(args)
        case GET_KNOWLEDGE_STATS:
          return await this.handleGetKnowledgeStats(args)
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

  // ==========================================================================
  // v3.0 Tool Handlers - Atomspace, PLN, and Tool Integration
  // ==========================================================================

  private async handleQueryKnowledge(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.config.enableAtomspace) {
      return {
        error: 'Atomspace is disabled',
        content: [{ type: 'text', text: 'Enable Atomspace in settings to use knowledge queries' }],
      }
    }

    const pattern: AtomPattern = {}
    if (args['type']) pattern.type = args['type'] as any
    if (args['name']) pattern.name = String(args['name'])
    if (args['min_confidence']) pattern.tvConfidenceMin = Number(args['min_confidence'])
    if (args['min_strength']) pattern.tvStrengthMin = Number(args['min_strength'])
    if (args['limit']) pattern.limit = Number(args['limit'])

    const result = this.atomspace.query(pattern)

    // Find similar goals if querying goals
    let similarGoals: any[] = []
    if (args['find_similar'] && args['goal']) {
      const similar = this.atomspace.findSimilarGoals(String(args['goal']))
      similarGoals = similar.map(s => ({
        goal: s.goal.name,
        similarity: s.similarity,
        truthValue: s.goal.tv,
      }))
    }

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: pattern,
            results: result.atoms.map(a => ({
              id: a.id,
              type: a.type,
              name: 'name' in a ? (a as any).name : undefined,
              truthValue: a.tv,
              attentionValue: a.av,
              meta: a.meta,
            })),
            count: result.atoms.length,
            execution_time_ms: result.executionTime,
            similar_goals: similarGoals.length > 0 ? similarGoals : undefined,
          }, null, 2),
        },
      ],
    }
  }

  private async handleInferKnowledge(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.config.enablePLN) {
      return {
        error: 'PLN is disabled',
        content: [{ type: 'text', text: 'Enable PLN in settings to use knowledge inference' }],
      }
    }

    const mode = String(args['mode'] || 'forward')
    const targetAtomId = args['target_atom_id'] ? String(args['target_atom_id']) : undefined

    if (mode === 'forward') {
      // Forward chaining - derive new knowledge
      const config: ForwardChainingConfig = {
        maxIterations: Number(args['max_iterations']) || this.config.plnMaxIterations,
        minConfidence: Number(args['min_confidence']) || this.config.plnMinConfidence,
        maxNewAtoms: Number(args['max_new_atoms']) || 20,
        focusAtomIds: args['focus_atoms'] as string[] | undefined,
      }

      const results = this.plnEngine.forwardChain(config)

      return {
        error: '',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              mode: 'forward',
              inferences: results.map(r => ({
                rule: r.rule,
                atom_id: r.atom.id,
                atom_type: r.atom.type,
                truth_value: r.truthValue,
                confidence: r.confidence,
                trace: r.trace,
              })),
              count: results.length,
            }, null, 2),
          },
        ],
      }
    } else if (mode === 'backward' && targetAtomId) {
      // Backward chaining - prove a goal
      const config: BackwardChainingConfig = {
        maxDepth: Number(args['max_depth']) || 5,
        minConfidence: Number(args['min_confidence']) || this.config.plnMinConfidence,
        maxPaths: Number(args['max_paths']) || 10,
      }

      const result = this.plnEngine.backwardChain(targetAtomId, config)

      return {
        error: '',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              mode: 'backward',
              target: targetAtomId,
              proven: result.proven,
              confidence: result.confidence,
              proof_paths: result.proofPaths.length,
            }, null, 2),
          },
        ],
      }
    } else if (mode === 'task_success') {
      // Infer task success likelihood
      const taskDescription = String(args['task_description'] || '')
      const context = (args['context'] as Record<string, unknown>) || {}

      const inference = this.plnEngine.inferTaskSuccess(taskDescription, context)

      return {
        error: '',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              mode: 'task_success',
              task: taskDescription,
              likelihood: inference.likelihood,
              confidence: inference.confidence,
              reasoning: inference.reasoning,
            }, null, 2),
          },
        ],
      }
    }

    return {
      error: 'Invalid mode. Use "forward", "backward", or "task_success"',
      content: [{ type: 'text', text: 'Invalid mode. Use "forward", "backward", or "task_success"' }],
    }
  }

  private async handleExecuteTool(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this.config.enableToolIntegration) {
      return {
        error: 'Tool integration is disabled',
        content: [{ type: 'text', text: 'Enable tool integration in settings to execute tools' }],
      }
    }

    const toolName = String(args['tool_name'] || '')
    if (!toolName) {
      return {
        error: 'Missing tool_name',
        content: [{ type: 'text', text: 'tool_name is required' }],
      }
    }

    const toolArgs = (args['args'] as Record<string, unknown>) || {}
    const timeout = Number(args['timeout']) || 30000

    // Check if it's a tool chain
    if (args['chain']) {
      const chainResult = await this.toolManager.executeChain(toolName, toolArgs, { timeout })
      return {
        error: chainResult.success ? '' : 'Chain execution failed',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              chain: toolName,
              success: chainResult.success,
              steps: chainResult.results.length,
              final_output: chainResult.finalOutput,
            }, null, 2),
          },
        ],
      }
    }

    // Execute single tool
    const result = await this.toolManager.getAvailableTools()
      .find(t => t.name === toolName) !== undefined
      ? await (this.toolManager as any).registry.execute(toolName, toolArgs, { timeout })
      : { success: false, output: null, error: `Tool "${toolName}" not found`, executionTime: 0 }

    return {
      error: result.success ? '' : result.error || 'Tool execution failed',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tool: toolName,
            success: result.success,
            output: result.output,
            error: result.error,
            execution_time_ms: result.executionTime,
          }, null, 2),
        },
      ],
    }
  }

  private async handleGetKnowledgeStats(args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const stats: Record<string, unknown> = {}

    // Atomspace stats
    if (this.config.enableAtomspace) {
      const atomspaceStats = this.atomspace.getStats()
      stats.atomspace = {
        enabled: true,
        atom_count: atomspaceStats.atomCount,
        node_count: atomspaceStats.nodeCount,
        link_count: atomspaceStats.linkCount,
        queries: atomspaceStats.queries,
        last_query_time_ms: atomspaceStats.lastQueryTime,
      }
    } else {
      stats.atomspace = { enabled: false }
    }

    // PLN stats
    if (this.config.enablePLN) {
      const rules = this.plnEngine.getRules()
      const history = this.plnEngine.getInferenceHistory()
      stats.pln = {
        enabled: true,
        rules: rules.map(r => r.name),
        rule_count: rules.length,
        inferences_made: history.length,
      }
    } else {
      stats.pln = { enabled: false }
    }

    // Tool stats
    if (this.config.enableToolIntegration) {
      const tools = this.toolManager.getAvailableTools()
      const toolStats = this.toolManager.getToolStats()
      stats.tools = {
        enabled: true,
        available_tools: tools.map(t => ({ name: t.name, category: t.category })),
        tool_count: tools.length,
        execution_stats: toolStats,
      }
    } else {
      stats.tools = { enabled: false }
    }

    // Plan stats
    stats.plans = {
      total: this.plans.size,
      executing: this.executingPlans.size,
      completed: Array.from(this.plans.values()).filter(p => p.status === 'completed').length,
      failed: Array.from(this.plans.values()).filter(p => p.status === 'failed').length,
    }

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  onSettingUpdate<T>(key: string, value: T): void {
    switch (key) {
      // v2.0 settings
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
      // v3.0 settings
      case 'enable_atomspace':
        this.config.enableAtomspace = Boolean(value)
        break
      case 'enable_pln':
        this.config.enablePLN = Boolean(value)
        break
      case 'enable_tool_integration':
        this.config.enableToolIntegration = Boolean(value)
        break
      case 'pln_max_iterations':
        this.config.plnMaxIterations = Number(value)
        break
      case 'pln_min_confidence':
        this.config.plnMinConfidence = Number(value)
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
  // v3.0 Settings - Atomspace, PLN, and Tool Integration
  {
    key: 'enable_atomspace',
    title: 'Enable Atomspace Knowledge Graph',
    description: 'Store and query knowledge using a graph-based representation with nodes and links',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'enable_pln',
    title: 'Enable PLN Reasoning',
    description: 'Use Probabilistic Logic Networks for inference and reasoning about knowledge',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'enable_tool_integration',
    title: 'Enable Tool Integration',
    description: 'Connect orchestration to Jan tools (RAG, file operations, web search, LLM)',
    controllerType: 'checkbox',
    controllerProps: {
      value: true,
    },
  },
  {
    key: 'pln_max_iterations',
    title: 'PLN Max Iterations',
    description: 'Maximum iterations for PLN forward chaining inference',
    controllerType: 'slider',
    controllerProps: {
      value: 10,
      min: 1,
      max: 50,
      step: 1,
    },
  },
  {
    key: 'pln_min_confidence',
    title: 'PLN Min Confidence',
    description: 'Minimum confidence threshold for PLN inferences (0.0 to 1.0)',
    controllerType: 'slider',
    controllerProps: {
      value: 0.3,
      min: 0.1,
      max: 1.0,
      step: 0.1,
    },
  },
]
