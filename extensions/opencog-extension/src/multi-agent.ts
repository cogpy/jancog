import type { OrchestrationTask, OrchestrationPlan, OrchestrationContext } from '@janhq/core'
import type { TaskExecutionResult, TaskExecutor } from './task-executor'

/**
 * Agent role definition
 */
export type AgentRole =
  | 'coordinator'
  | 'researcher'
  | 'analyst'
  | 'creator'
  | 'validator'
  | 'executor'

/**
 * Agent state
 */
export interface Agent {
  id: string
  role: AgentRole
  status: 'idle' | 'working' | 'blocked' | 'completed'
  currentTask: string | null
  capabilities: string[]
  workload: number
  performance: AgentPerformance
}

/**
 * Agent performance metrics
 */
export interface AgentPerformance {
  tasksCompleted: number
  tasksFailed: number
  averageExecutionTime: number
  successRate: number
}

/**
 * Task assignment for an agent
 */
export interface TaskAssignment {
  taskId: string
  agentId: string
  priority: number
  estimatedDuration: number
  dependencies: string[]
}

/**
 * Coordination result
 */
export interface CoordinationResult {
  assignments: TaskAssignment[]
  parallelGroups: string[][]
  estimatedTotalDuration: number
  agentUtilization: Map<string, number>
}

/**
 * Agent communication message
 */
export interface AgentMessage {
  from: string
  to: string
  type: 'task_result' | 'status_update' | 'request_help' | 'coordination'
  payload: unknown
  timestamp: number
}

/**
 * Multi-Agent Coordination System
 *
 * Provides:
 * - Agent pool management with specialized roles
 * - Intelligent task assignment based on capabilities
 * - Parallel execution coordination
 * - Load balancing across agents
 * - Inter-agent communication
 */
export class MultiAgentCoordinator {
  private agents: Map<string, Agent> = new Map()
  private taskAssignments: Map<string, TaskAssignment> = new Map()
  private messageQueue: AgentMessage[] = []
  private maxAgents: number
  private taskExecutor: TaskExecutor

  constructor(taskExecutor: TaskExecutor, maxAgents = 5) {
    this.taskExecutor = taskExecutor
    this.maxAgents = maxAgents
    this.initializeAgentPool()
  }

  /**
   * Initialize the agent pool with specialized agents
   */
  private initializeAgentPool(): void {
    const roles: AgentRole[] = ['coordinator', 'researcher', 'analyst', 'creator', 'validator']

    for (const role of roles) {
      const agent: Agent = {
        id: this.generateAgentId(role),
        role,
        status: 'idle',
        currentTask: null,
        capabilities: this.getCapabilitiesForRole(role),
        workload: 0,
        performance: {
          tasksCompleted: 0,
          tasksFailed: 0,
          averageExecutionTime: 0,
          successRate: 1.0,
        },
      }
      this.agents.set(agent.id, agent)
    }
  }

  /**
   * Get capabilities for a specific role
   */
  private getCapabilitiesForRole(role: AgentRole): string[] {
    const capabilities: Record<AgentRole, string[]> = {
      coordinator: ['planning', 'orchestration', 'delegation', 'monitoring'],
      researcher: ['search', 'information_gathering', 'fact_checking', 'web_search'],
      analyst: ['analysis', 'evaluation', 'pattern_recognition', 'data_processing'],
      creator: ['content_generation', 'writing', 'drafting', 'synthesis'],
      validator: ['testing', 'verification', 'quality_assurance', 'review'],
      executor: ['task_execution', 'automation', 'implementation', 'deployment'],
    }
    return capabilities[role]
  }

  /**
   * Coordinate task execution across multiple agents
   */
  async coordinatePlanExecution(
    plan: OrchestrationPlan,
    context: OrchestrationContext,
    onProgress?: (task: OrchestrationTask, agent: Agent, result: TaskExecutionResult) => void
  ): Promise<Map<string, TaskExecutionResult>> {
    const results = new Map<string, TaskExecutionResult>()

    // Create coordination plan
    const coordination = this.createCoordinationPlan(plan.tasks)

    // Execute parallel groups
    for (const group of coordination.parallelGroups) {
      const groupTasks = plan.tasks.filter(t => group.includes(t.id))

      // Assign tasks to agents
      const assignments = this.assignTasksToAgents(groupTasks)

      // Execute group in parallel
      const groupPromises = assignments.map(async assignment => {
        const task = plan.tasks.find(t => t.id === assignment.taskId)!
        const agent = this.agents.get(assignment.agentId)!

        // Update agent status
        agent.status = 'working'
        agent.currentTask = task.id

        try {
          const result = await this.taskExecutor.executeTask(task, plan, context)
          results.set(task.id, result)

          // Update task status
          task.status = result.success ? 'completed' : 'failed'
          task.result = result.output
          if (!result.success) {
            task.error = result.error
          }

          // Update agent performance
          this.updateAgentPerformance(agent, result)

          onProgress?.(task, agent, result)

          return { task, agent, result }
        } finally {
          agent.status = 'idle'
          agent.currentTask = null
        }
      })

      await Promise.all(groupPromises)
    }

    return results
  }

  /**
   * Create a coordination plan for tasks
   */
  createCoordinationPlan(tasks: OrchestrationTask[]): CoordinationResult {
    const parallelGroups: string[][] = []
    const assignments: TaskAssignment[] = []
    const processedTasks = new Set<string>()

    // Build dependency graph
    const dependencies = this.buildDependencyMap(tasks)

    // Group tasks that can run in parallel
    while (processedTasks.size < tasks.length) {
      const group: string[] = []

      for (const task of tasks) {
        if (processedTasks.has(task.id)) continue

        // Check if all dependencies are processed
        const taskDeps = dependencies.get(task.id) || []
        const allDepsProcessed = taskDeps.every(depId => processedTasks.has(depId))

        if (allDepsProcessed) {
          group.push(task.id)
        }
      }

      if (group.length === 0) {
        // Deadlock - add remaining tasks sequentially
        for (const task of tasks) {
          if (!processedTasks.has(task.id)) {
            parallelGroups.push([task.id])
            processedTasks.add(task.id)
          }
        }
        break
      }

      // Limit parallel group size
      const limitedGroup = group.slice(0, this.maxAgents)
      parallelGroups.push(limitedGroup)
      limitedGroup.forEach(id => processedTasks.add(id))
    }

    // Create assignments
    for (const task of tasks) {
      const assignment = this.createAssignment(task, dependencies.get(task.id) || [])
      assignments.push(assignment)
    }

    // Calculate utilization
    const agentUtilization = this.calculateUtilization(assignments)

    // Calculate estimated duration
    const estimatedTotalDuration = this.estimateTotalDuration(parallelGroups, assignments)

    return {
      assignments,
      parallelGroups,
      estimatedTotalDuration,
      agentUtilization,
    }
  }

  /**
   * Assign tasks to the most suitable agents
   */
  private assignTasksToAgents(tasks: OrchestrationTask[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = []
    const agentWorkloads = new Map<string, number>()

    // Initialize workloads
    for (const agent of this.agents.values()) {
      agentWorkloads.set(agent.id, agent.workload)
    }

    for (const task of tasks) {
      const bestAgent = this.findBestAgentForTask(task, agentWorkloads)

      if (bestAgent) {
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: bestAgent.id,
          priority: this.calculateTaskPriority(task),
          estimatedDuration: this.estimateTaskDuration(task),
          dependencies: [],
        }

        assignments.push(assignment)
        this.taskAssignments.set(task.id, assignment)

        // Update workload
        const currentWorkload = agentWorkloads.get(bestAgent.id) || 0
        agentWorkloads.set(bestAgent.id, currentWorkload + 1)
      }
    }

    return assignments
  }

  /**
   * Find the best agent for a specific task
   */
  private findBestAgentForTask(
    task: OrchestrationTask,
    workloads: Map<string, number>
  ): Agent | null {
    const taskType = this.classifyTaskType(task)
    let bestAgent: Agent | null = null
    let bestScore = -1

    for (const agent of this.agents.values()) {
      if (agent.status !== 'idle' && agent.status !== 'completed') continue

      // Calculate suitability score
      let score = 0

      // Capability match
      const requiredCapabilities = this.getRequiredCapabilities(taskType)
      const matchingCapabilities = agent.capabilities.filter(c =>
        requiredCapabilities.includes(c)
      ).length
      score += matchingCapabilities * 10

      // Performance bonus
      score += agent.performance.successRate * 5

      // Workload penalty
      const workload = workloads.get(agent.id) || 0
      score -= workload * 3

      if (score > bestScore) {
        bestScore = score
        bestAgent = agent
      }
    }

    // If no suitable agent, use the least loaded one
    if (!bestAgent) {
      let minWorkload = Infinity
      for (const agent of this.agents.values()) {
        const workload = workloads.get(agent.id) || 0
        if (workload < minWorkload) {
          minWorkload = workload
          bestAgent = agent
        }
      }
    }

    return bestAgent
  }

  /**
   * Classify task type for agent matching
   */
  private classifyTaskType(task: OrchestrationTask): string {
    const nameLower = (task.name + ' ' + task.description).toLowerCase()

    if (nameLower.includes('research') || nameLower.includes('search') || nameLower.includes('find')) {
      return 'research'
    }
    if (nameLower.includes('analyze') || nameLower.includes('evaluate') || nameLower.includes('assess')) {
      return 'analysis'
    }
    if (nameLower.includes('create') || nameLower.includes('write') || nameLower.includes('generate')) {
      return 'creation'
    }
    if (nameLower.includes('validate') || nameLower.includes('test') || nameLower.includes('verify')) {
      return 'validation'
    }
    if (nameLower.includes('execute') || nameLower.includes('run') || nameLower.includes('implement')) {
      return 'execution'
    }

    return 'general'
  }

  /**
   * Get required capabilities for a task type
   */
  private getRequiredCapabilities(taskType: string): string[] {
    const capabilities: Record<string, string[]> = {
      research: ['search', 'information_gathering', 'web_search'],
      analysis: ['analysis', 'evaluation', 'pattern_recognition'],
      creation: ['content_generation', 'writing', 'synthesis'],
      validation: ['testing', 'verification', 'quality_assurance'],
      execution: ['task_execution', 'automation', 'implementation'],
      general: ['task_execution'],
    }
    return capabilities[taskType] || capabilities.general
  }

  /**
   * Update agent performance after task completion
   */
  private updateAgentPerformance(agent: Agent, result: TaskExecutionResult): void {
    const perf = agent.performance

    if (result.success) {
      perf.tasksCompleted++
    } else {
      perf.tasksFailed++
    }

    // Update average execution time
    const totalTasks = perf.tasksCompleted + perf.tasksFailed
    perf.averageExecutionTime =
      (perf.averageExecutionTime * (totalTasks - 1) + result.executionTime) / totalTasks

    // Update success rate
    perf.successRate = perf.tasksCompleted / totalTasks
  }

  /**
   * Build dependency map from tasks
   */
  private buildDependencyMap(tasks: OrchestrationTask[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>()

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const taskDeps: string[] = []
      const taskLower = (task.name + ' ' + task.description).toLowerCase()

      // Check for explicit dependencies
      if (taskLower.includes('after') || taskLower.includes('based on') ||
          taskLower.includes('using results') || taskLower.includes('from previous')) {
        // Depend on all previous tasks
        for (let j = 0; j < i; j++) {
          taskDeps.push(tasks[j].id)
        }
      } else if (taskLower.includes('validate') || taskLower.includes('review') ||
                 taskLower.includes('finalize')) {
        // Validation/review tasks depend on creation tasks
        for (let j = 0; j < i; j++) {
          const prevLower = (tasks[j].name + ' ' + tasks[j].description).toLowerCase()
          if (prevLower.includes('create') || prevLower.includes('draft') ||
              prevLower.includes('write') || prevLower.includes('generate')) {
            taskDeps.push(tasks[j].id)
          }
        }
      }

      dependencies.set(task.id, taskDeps)
    }

    return dependencies
  }

  /**
   * Create a task assignment
   */
  private createAssignment(task: OrchestrationTask, dependencies: string[]): TaskAssignment {
    return {
      taskId: task.id,
      agentId: '', // Will be assigned during execution
      priority: this.calculateTaskPriority(task),
      estimatedDuration: this.estimateTaskDuration(task),
      dependencies,
    }
  }

  /**
   * Calculate task priority
   */
  private calculateTaskPriority(task: OrchestrationTask): number {
    const nameLower = task.name.toLowerCase()

    // Higher priority for earlier phases
    if (nameLower.includes('analyze') || nameLower.includes('research')) return 10
    if (nameLower.includes('plan') || nameLower.includes('design')) return 8
    if (nameLower.includes('create') || nameLower.includes('implement')) return 6
    if (nameLower.includes('review') || nameLower.includes('refine')) return 4
    if (nameLower.includes('validate') || nameLower.includes('finalize')) return 2

    return 5 // Default priority
  }

  /**
   * Estimate task duration
   */
  private estimateTaskDuration(task: OrchestrationTask): number {
    const nameLower = task.name.toLowerCase()

    // Estimate in milliseconds
    if (nameLower.includes('analyze') || nameLower.includes('research')) return 500
    if (nameLower.includes('create') || nameLower.includes('write')) return 800
    if (nameLower.includes('validate') || nameLower.includes('review')) return 300

    return 400 // Default duration
  }

  /**
   * Calculate agent utilization
   */
  private calculateUtilization(assignments: TaskAssignment[]): Map<string, number> {
    const utilization = new Map<string, number>()
    const taskCounts = new Map<string, number>()

    for (const assignment of assignments) {
      if (assignment.agentId) {
        const count = taskCounts.get(assignment.agentId) || 0
        taskCounts.set(assignment.agentId, count + 1)
      }
    }

    for (const [agentId, count] of taskCounts) {
      utilization.set(agentId, count / assignments.length)
    }

    return utilization
  }

  /**
   * Estimate total duration based on parallel groups
   */
  private estimateTotalDuration(
    parallelGroups: string[][],
    assignments: TaskAssignment[]
  ): number {
    let totalDuration = 0

    for (const group of parallelGroups) {
      // Duration is the max of all tasks in the parallel group
      let groupDuration = 0
      for (const taskId of group) {
        const assignment = assignments.find(a => a.taskId === taskId)
        if (assignment && assignment.estimatedDuration > groupDuration) {
          groupDuration = assignment.estimatedDuration
        }
      }
      totalDuration += groupDuration
    }

    return totalDuration
  }

  /**
   * Get all agents
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | null {
    return this.agents.get(agentId) || null
  }

  /**
   * Send message between agents
   */
  sendMessage(from: string, to: string, type: AgentMessage['type'], payload: unknown): void {
    this.messageQueue.push({
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
    })
  }

  /**
   * Get pending messages for an agent
   */
  getMessages(agentId: string): AgentMessage[] {
    const messages = this.messageQueue.filter(m => m.to === agentId)
    this.messageQueue = this.messageQueue.filter(m => m.to !== agentId)
    return messages
  }

  private generateAgentId(role: AgentRole): string {
    return `agent_${role}_${Math.random().toString(36).substring(2, 9)}`
  }
}
