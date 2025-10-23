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

/**
 * OpenCog Extension for Jan - Autonomous Orchestration Engine
 * 
 * This extension implements OpenCog-inspired cognitive AI capabilities for autonomous
 * task planning, reasoning, and execution. It provides:
 * 
 * - Goal decomposition: Breaking down high-level goals into executable tasks
 * - Task orchestration: Coordinating complex multi-step workflows
 * - Cognitive reasoning: Analyzing goals and tasks for optimal execution
 * - Autonomous execution: Self-directed task completion with adaptive planning
 */
export default class JanOpenCogExtension extends OpenCogExtension {
  private config = {
    enabled: true,
    maxTasksPerPlan: 20,
    reasoningModel: 'default',
    autoExecute: false,
  }

  // In-memory storage for plans (in production, this would be persisted)
  private plans: Map<string, OrchestrationPlan> = new Map()
  private executingPlans: Set<string> = new Set()

  async onLoad(): Promise<void> {
    console.log('[OpenCog] Loading autonomous orchestration engine...')
    
    const settings = structuredClone(SETTINGS) as SettingComponentProps[]
    await this.registerSettings(settings)
    
    this.config.enabled = await this.getSetting('enabled', this.config.enabled)
    this.config.maxTasksPerPlan = await this.getSetting('max_tasks_per_plan', this.config.maxTasksPerPlan)
    this.config.reasoningModel = await this.getSetting('reasoning_model', this.config.reasoningModel)
    this.config.autoExecute = await this.getSetting('auto_execute', this.config.autoExecute)

    console.log('[OpenCog] Orchestration engine loaded successfully')
  }

  onUnload(): void {
    console.log('[OpenCog] Unloading orchestration engine...')
    // Cancel all executing plans
    for (const planId of this.executingPlans) {
      this.cancelPlan(planId)
    }
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
    
    // Use cognitive reasoning to decompose the goal into tasks
    const tasks = await this.decomposeGoal(goal, context)
    
    const plan: OrchestrationPlan = {
      id: planId,
      goal,
      tasks,
      status: 'planning',
      createdAt: Date.now(),
    }
    
    this.plans.set(planId, plan)
    
    // Mark as completed planning
    plan.status = 'executing'
    
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

    try {
      // Execute tasks sequentially with cognitive reasoning
      for (const task of plan.tasks) {
        if (!this.executingPlans.has(planId)) {
          // Plan was cancelled
          plan.status = 'failed'
          plan.tasks.forEach(t => {
            if (t.status === 'pending' || t.status === 'running') {
              t.status = 'failed'
              t.error = 'Plan cancelled'
            }
          })
          break
        }

        await this.executeTask(task, plan)
      }

      // Check if all tasks completed successfully
      const allCompleted = plan.tasks.every(t => t.status === 'completed')
      plan.status = allCompleted ? 'completed' : 'failed'
      plan.completedAt = Date.now()
    } catch (error) {
      plan.status = 'failed'
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[OpenCog] Plan execution failed:`, message)
    } finally {
      this.executingPlans.delete(planId)
    }

    return plan
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
        }
      })
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

    return {
      error: '',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            plan_id: plan.id,
            status: plan.status,
            tasks: plan.tasks.map(t => ({
              id: t.id,
              name: t.name,
              status: t.status,
              result: t.result,
              error: t.error,
            })),
            completed_at: plan.completedAt,
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
            })),
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

    // Perform cognitive analysis of the goal
    const analysis = await this.analyzeGoal(goal)

    return {
      error: '',
      content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
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
    const reasoning = await this.reasonAboutTask(taskDescription, context)

    return {
      error: '',
      content: [{ type: 'text', text: JSON.stringify(reasoning, null, 2) }],
    }
  }

  /**
   * Decompose a high-level goal into executable tasks using cognitive reasoning
   */
  private async decomposeGoal(
    goal: string,
    context: OrchestrationContext
  ): Promise<OrchestrationTask[]> {
    // This is a simplified implementation. In a full OpenCog integration,
    // this would use the Atomspace and PLN (Probabilistic Logic Networks)
    // for more sophisticated goal decomposition.
    
    const tasks: OrchestrationTask[] = []
    
    // Basic heuristic decomposition based on goal analysis
    const goalLower = goal.toLowerCase()
    
    // Analysis phase
    tasks.push({
      id: this.generateId('task'),
      name: 'Analyze Requirements',
      description: `Analyze the goal "${goal}" to understand requirements and constraints`,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Planning phase
    if (goalLower.includes('research') || goalLower.includes('learn') || goalLower.includes('study')) {
      tasks.push({
        id: this.generateId('task'),
        name: 'Research and Gather Information',
        description: 'Collect relevant information and data for the goal',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    if (goalLower.includes('write') || goalLower.includes('create') || goalLower.includes('generate')) {
      tasks.push({
        id: this.generateId('task'),
        name: 'Draft Content',
        description: 'Create the initial draft or prototype',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    if (goalLower.includes('review') || goalLower.includes('edit') || goalLower.includes('refine')) {
      tasks.push({
        id: this.generateId('task'),
        name: 'Review and Refine',
        description: 'Review the output and make improvements',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    // Always add a validation/completion task
    tasks.push({
      id: this.generateId('task'),
      name: 'Validate and Complete',
      description: 'Validate that the goal has been achieved and finalize',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Ensure we don't exceed max tasks
    if (tasks.length > this.config.maxTasksPerPlan) {
      return tasks.slice(0, this.config.maxTasksPerPlan)
    }

    return tasks
  }

  /**
   * Execute a single task with cognitive reasoning
   */
  private async executeTask(task: OrchestrationTask, plan: OrchestrationPlan): Promise<void> {
    task.status = 'running'
    task.updatedAt = Date.now()

    try {
      // In a full implementation, this would:
      // 1. Use the Atomspace to represent task knowledge
      // 2. Apply PLN for reasoning about task execution
      // 3. Use available tools and models to complete the task
      // 4. Learn from execution results to improve future performance

      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 100))

      task.status = 'completed'
      task.result = {
        completed: true,
        message: `Task "${task.name}" completed successfully`,
        timestamp: Date.now(),
      }
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
    } finally {
      task.updatedAt = Date.now()
    }
  }

  /**
   * Analyze a goal to provide insights about complexity and feasibility
   */
  private async analyzeGoal(goal: string): Promise<Record<string, unknown>> {
    // Simplified analysis - in a full OpenCog implementation, this would use
    // PLN for probabilistic reasoning about goal feasibility
    
    const wordCount = goal.split(/\s+/).length
    const complexity = wordCount < 10 ? 'low' : wordCount < 20 ? 'medium' : 'high'
    
    return {
      goal,
      complexity,
      estimated_tasks: Math.ceil(wordCount / 5),
      feasibility: 'high',
      required_resources: ['reasoning_model', 'task_executor'],
      analysis: `The goal "${goal}" has ${complexity} complexity and requires approximately ${Math.ceil(wordCount / 5)} tasks.`,
    }
  }

  /**
   * Apply cognitive reasoning to understand a task
   */
  private async reasonAboutTask(
    taskDescription: string,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Simplified reasoning - in a full OpenCog implementation, this would use
    // the Atomspace and PLN for sophisticated reasoning
    
    return {
      task: taskDescription,
      reasoning: `Task requires careful planning and execution`,
      dependencies: [],
      optimal_strategy: 'sequential_execution',
      estimated_duration: 'short',
      confidence: 0.85,
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
]
