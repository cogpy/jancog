import type { OrchestrationPlan, OrchestrationTask } from '@janhq/core'

/**
 * Execution history entry for learning
 */
export interface ExecutionHistoryEntry {
  planId: string
  goal: string
  tasks: TaskHistoryEntry[]
  status: OrchestrationPlan['status']
  createdAt: number
  completedAt?: number
  totalDuration: number
  successRate: number
}

/**
 * Task history for learning from past executions
 */
export interface TaskHistoryEntry {
  taskId: string
  name: string
  description: string
  status: OrchestrationTask['status']
  executionTime: number
  retryCount: number
  confidence: number
  error?: string
}

/**
 * Learning insights derived from execution history
 */
export interface LearningInsights {
  goalPatterns: Map<string, GoalPatternInsight>
  taskSuccessRates: Map<string, number>
  averageExecutionTimes: Map<string, number>
  commonFailurePatterns: FailurePattern[]
}

export interface GoalPatternInsight {
  pattern: string
  occurrences: number
  averageTaskCount: number
  averageSuccessRate: number
  bestDecomposition: string[]
}

export interface FailurePattern {
  taskPattern: string
  failureRate: number
  commonErrors: string[]
  suggestedFix: string
}

/**
 * Plan storage interface for abstracted persistence
 */
export interface PlanStorage {
  save(plan: OrchestrationPlan): Promise<void>
  load(planId: string): Promise<OrchestrationPlan | null>
  loadAll(): Promise<OrchestrationPlan[]>
  delete(planId: string): Promise<boolean>
  clear(): Promise<void>
}

/**
 * Persistence Layer for OpenCog Plans
 *
 * Provides:
 * - Plan persistence (in-memory with optional localStorage backing)
 * - Execution history tracking
 * - Learning insights extraction
 */
export class PlanPersistence implements PlanStorage {
  private plans: Map<string, OrchestrationPlan> = new Map()
  private executionHistory: ExecutionHistoryEntry[] = []
  private learningInsights: LearningInsights
  private storageKey = 'opencog_plans'
  private historyKey = 'opencog_history'
  private maxHistorySize = 1000
  private useLocalStorage: boolean

  constructor(useLocalStorage = false) {
    this.useLocalStorage = useLocalStorage && typeof localStorage !== 'undefined'
    this.learningInsights = {
      goalPatterns: new Map(),
      taskSuccessRates: new Map(),
      averageExecutionTimes: new Map(),
      commonFailurePatterns: [],
    }

    // Load from localStorage if available
    if (this.useLocalStorage) {
      this.loadFromStorage()
    }
  }

  /**
   * Save a plan to persistence
   */
  async save(plan: OrchestrationPlan): Promise<void> {
    this.plans.set(plan.id, { ...plan })

    if (this.useLocalStorage) {
      this.saveToStorage()
    }
  }

  /**
   * Load a plan by ID
   */
  async load(planId: string): Promise<OrchestrationPlan | null> {
    const plan = this.plans.get(planId)
    return plan ? { ...plan } : null
  }

  /**
   * Load all plans
   */
  async loadAll(): Promise<OrchestrationPlan[]> {
    return Array.from(this.plans.values()).map(plan => ({ ...plan }))
  }

  /**
   * Delete a plan
   */
  async delete(planId: string): Promise<boolean> {
    const deleted = this.plans.delete(planId)

    if (this.useLocalStorage && deleted) {
      this.saveToStorage()
    }

    return deleted
  }

  /**
   * Clear all plans
   */
  async clear(): Promise<void> {
    this.plans.clear()

    if (this.useLocalStorage) {
      this.saveToStorage()
    }
  }

  /**
   * Record plan completion for learning
   */
  recordExecution(plan: OrchestrationPlan, taskMetrics: Map<string, TaskHistoryEntry>): void {
    const completedTasks = plan.tasks.filter(t => t.status === 'completed').length
    const successRate = plan.tasks.length > 0 ? completedTasks / plan.tasks.length : 0

    const historyEntry: ExecutionHistoryEntry = {
      planId: plan.id,
      goal: plan.goal,
      tasks: plan.tasks.map(t => {
        const metrics = taskMetrics.get(t.id)
        return {
          taskId: t.id,
          name: t.name,
          description: t.description,
          status: t.status,
          executionTime: metrics?.executionTime || 0,
          retryCount: metrics?.retryCount || 0,
          confidence: metrics?.confidence || 0.5,
          error: t.error,
        }
      }),
      status: plan.status,
      createdAt: plan.createdAt,
      completedAt: plan.completedAt,
      totalDuration: (plan.completedAt || Date.now()) - plan.createdAt,
      successRate,
    }

    this.executionHistory.push(historyEntry)

    // Maintain max history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize)
    }

    // Update learning insights
    this.updateLearningInsights(historyEntry)

    if (this.useLocalStorage) {
      this.saveHistoryToStorage()
    }
  }

  /**
   * Get learning insights for a goal pattern
   */
  getInsightsForGoal(goal: string): GoalPatternInsight | null {
    const pattern = this.extractGoalPattern(goal)
    return this.learningInsights.goalPatterns.get(pattern) || null
  }

  /**
   * Get task success rate for a task type
   */
  getTaskSuccessRate(taskName: string): number {
    const pattern = this.extractTaskPattern(taskName)
    return this.learningInsights.taskSuccessRates.get(pattern) ?? 0.8
  }

  /**
   * Get average execution time for a task type
   */
  getAverageExecutionTime(taskName: string): number {
    const pattern = this.extractTaskPattern(taskName)
    return this.learningInsights.averageExecutionTimes.get(pattern) ?? 200
  }

  /**
   * Get common failure patterns
   */
  getFailurePatterns(): FailurePattern[] {
    return [...this.learningInsights.commonFailurePatterns]
  }

  /**
   * Get all execution history
   */
  getExecutionHistory(): ExecutionHistoryEntry[] {
    return [...this.executionHistory]
  }

  /**
   * Get recommendations based on past executions
   */
  getRecommendations(goal: string): string[] {
    const recommendations: string[] = []
    const pattern = this.extractGoalPattern(goal)
    const insights = this.learningInsights.goalPatterns.get(pattern)

    if (insights) {
      if (insights.averageSuccessRate < 0.7) {
        recommendations.push(`Goals matching "${pattern}" have a ${(insights.averageSuccessRate * 100).toFixed(0)}% success rate. Consider breaking into smaller goals.`)
      }

      if (insights.bestDecomposition.length > 0) {
        recommendations.push(`Suggested task structure: ${insights.bestDecomposition.join(' → ')}`)
      }
    }

    // Check for failure patterns
    for (const failurePattern of this.learningInsights.commonFailurePatterns) {
      if (goal.toLowerCase().includes(failurePattern.taskPattern.toLowerCase())) {
        recommendations.push(`Warning: "${failurePattern.taskPattern}" tasks have ${(failurePattern.failureRate * 100).toFixed(0)}% failure rate. ${failurePattern.suggestedFix}`)
      }
    }

    return recommendations
  }

  /**
   * Update learning insights from execution history
   */
  private updateLearningInsights(entry: ExecutionHistoryEntry): void {
    const goalPattern = this.extractGoalPattern(entry.goal)

    // Update goal patterns
    const existingGoalInsight = this.learningInsights.goalPatterns.get(goalPattern)
    if (existingGoalInsight) {
      existingGoalInsight.occurrences++
      existingGoalInsight.averageTaskCount =
        (existingGoalInsight.averageTaskCount * (existingGoalInsight.occurrences - 1) + entry.tasks.length) /
        existingGoalInsight.occurrences
      existingGoalInsight.averageSuccessRate =
        (existingGoalInsight.averageSuccessRate * (existingGoalInsight.occurrences - 1) + entry.successRate) /
        existingGoalInsight.occurrences

      // Update best decomposition if this one was more successful
      if (entry.successRate > existingGoalInsight.averageSuccessRate) {
        existingGoalInsight.bestDecomposition = entry.tasks.map(t => t.name)
      }
    } else {
      this.learningInsights.goalPatterns.set(goalPattern, {
        pattern: goalPattern,
        occurrences: 1,
        averageTaskCount: entry.tasks.length,
        averageSuccessRate: entry.successRate,
        bestDecomposition: entry.successRate >= 0.8 ? entry.tasks.map(t => t.name) : [],
      })
    }

    // Update task success rates and execution times
    for (const task of entry.tasks) {
      const taskPattern = this.extractTaskPattern(task.name)

      // Success rate
      const existingSuccessRate = this.learningInsights.taskSuccessRates.get(taskPattern) ?? 0.8
      const successValue = task.status === 'completed' ? 1 : 0
      this.learningInsights.taskSuccessRates.set(
        taskPattern,
        existingSuccessRate * 0.9 + successValue * 0.1 // Exponential moving average
      )

      // Execution time
      const existingTime = this.learningInsights.averageExecutionTimes.get(taskPattern) ?? 200
      this.learningInsights.averageExecutionTimes.set(
        taskPattern,
        existingTime * 0.9 + task.executionTime * 0.1
      )
    }

    // Update failure patterns
    this.updateFailurePatterns(entry)
  }

  /**
   * Identify and update common failure patterns
   */
  private updateFailurePatterns(entry: ExecutionHistoryEntry): void {
    const failedTasks = entry.tasks.filter(t => t.status === 'failed')

    for (const task of failedTasks) {
      const pattern = this.extractTaskPattern(task.name)

      const existingPattern = this.learningInsights.commonFailurePatterns.find(
        fp => fp.taskPattern === pattern
      )

      if (existingPattern) {
        existingPattern.failureRate = existingPattern.failureRate * 0.9 + 0.1
        if (task.error && !existingPattern.commonErrors.includes(task.error)) {
          existingPattern.commonErrors.push(task.error)
          if (existingPattern.commonErrors.length > 5) {
            existingPattern.commonErrors = existingPattern.commonErrors.slice(-5)
          }
        }
      } else if (this.shouldTrackFailure(task)) {
        this.learningInsights.commonFailurePatterns.push({
          taskPattern: pattern,
          failureRate: 0.5, // Initial estimate
          commonErrors: task.error ? [task.error] : [],
          suggestedFix: this.suggestFix(task),
        })
      }
    }

    // Prune failure patterns with low failure rate
    this.learningInsights.commonFailurePatterns =
      this.learningInsights.commonFailurePatterns.filter(fp => fp.failureRate > 0.2)
  }

  private shouldTrackFailure(task: TaskHistoryEntry): boolean {
    // Track failures that occur more than once
    const pattern = this.extractTaskPattern(task.name)
    const failureCount = this.executionHistory.reduce((count, entry) => {
      return count + entry.tasks.filter(t =>
        this.extractTaskPattern(t.name) === pattern && t.status === 'failed'
      ).length
    }, 0)
    return failureCount >= 2
  }

  private suggestFix(task: TaskHistoryEntry): string {
    const nameLower = task.name.toLowerCase()

    if (task.error?.includes('timeout')) {
      return 'Consider breaking this task into smaller subtasks.'
    }
    if (task.error?.includes('not found')) {
      return 'Ensure prerequisites are completed before this task.'
    }
    if (nameLower.includes('validate') || nameLower.includes('test')) {
      return 'Review validation criteria and add more specific checks.'
    }

    return 'Review task dependencies and ensure proper context is available.'
  }

  private extractGoalPattern(goal: string): string {
    // Extract key action words from goal
    const actionWords = ['write', 'create', 'analyze', 'research', 'build', 'implement', 'fix', 'review', 'test']
    const words = goal.toLowerCase().split(/\s+/)
    const actions = words.filter(w => actionWords.includes(w))

    if (actions.length > 0) {
      return actions.join('_')
    }

    // Fall back to first few words
    return words.slice(0, 3).join('_')
  }

  private extractTaskPattern(taskName: string): string {
    // Normalize task name to pattern
    const normalized = taskName.toLowerCase()
      .replace(/[0-9]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z_]/g, '')

    return normalized.slice(0, 30)
  }

  private loadFromStorage(): void {
    try {
      const plansJson = localStorage.getItem(this.storageKey)
      if (plansJson) {
        const plansArray = JSON.parse(plansJson) as OrchestrationPlan[]
        for (const plan of plansArray) {
          this.plans.set(plan.id, plan)
        }
      }

      const historyJson = localStorage.getItem(this.historyKey)
      if (historyJson) {
        this.executionHistory = JSON.parse(historyJson)
        // Rebuild learning insights from history
        for (const entry of this.executionHistory) {
          this.updateLearningInsights(entry)
        }
      }
    } catch (error) {
      console.error('[OpenCog] Failed to load from storage:', error)
    }
  }

  private saveToStorage(): void {
    try {
      const plansArray = Array.from(this.plans.values())
      localStorage.setItem(this.storageKey, JSON.stringify(plansArray))
    } catch (error) {
      console.error('[OpenCog] Failed to save plans to storage:', error)
    }
  }

  private saveHistoryToStorage(): void {
    try {
      localStorage.setItem(this.historyKey, JSON.stringify(this.executionHistory))
    } catch (error) {
      console.error('[OpenCog] Failed to save history to storage:', error)
    }
  }
}
