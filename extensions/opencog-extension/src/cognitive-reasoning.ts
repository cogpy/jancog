import type { OrchestrationTask, OrchestrationPlan, OrchestrationContext } from '@janhq/core'
import type { PlanPersistence, GoalPatternInsight } from './persistence'
import type { TaskExecutionResult } from './task-executor'

/**
 * Goal complexity analysis result
 */
export interface GoalAnalysis {
  goal: string
  complexity: 'low' | 'medium' | 'high' | 'very_high'
  complexityScore: number
  estimatedTasks: number
  feasibility: 'high' | 'medium' | 'low'
  feasibilityScore: number
  requiredCapabilities: string[]
  potentialRisks: string[]
  recommendations: string[]
  decomposition: TaskDecomposition[]
}

/**
 * Task decomposition from goal analysis
 */
export interface TaskDecomposition {
  name: string
  description: string
  type: TaskType
  priority: number
  estimatedDuration: number
  dependencies: string[]
  parallelizable: boolean
}

/**
 * Task types for classification
 */
export type TaskType =
  | 'research'
  | 'analysis'
  | 'planning'
  | 'creation'
  | 'validation'
  | 'execution'
  | 'review'
  | 'integration'

/**
 * Reasoning result for a task
 */
export interface TaskReasoning {
  task: string
  reasoning: string
  approach: string
  dependencies: string[]
  optimalStrategy: string
  estimatedDuration: 'very_short' | 'short' | 'medium' | 'long'
  confidence: number
  alternatives: AlternativeApproach[]
  risks: TaskRisk[]
}

export interface AlternativeApproach {
  description: string
  pros: string[]
  cons: string[]
  confidence: number
}

export interface TaskRisk {
  description: string
  probability: number
  impact: 'low' | 'medium' | 'high'
  mitigation: string
}

/**
 * Replan decision result
 */
export interface ReplanDecision {
  shouldReplan: boolean
  reason: string
  suggestedChanges: PlanChange[]
  confidence: number
}

export interface PlanChange {
  type: 'add_task' | 'remove_task' | 'modify_task' | 'reorder_tasks'
  taskId?: string
  newTask?: Partial<OrchestrationTask>
  modification?: Partial<OrchestrationTask>
  priority: number
}

/**
 * Cognitive Reasoning Engine
 *
 * Provides enhanced reasoning capabilities for:
 * - Goal analysis and complexity assessment
 * - Intelligent task decomposition
 * - Dynamic replanning based on execution results
 * - Learning-enhanced decision making
 */
export class CognitiveReasoning {
  private persistence: PlanPersistence | null

  // Keyword patterns for task classification
  private readonly taskPatterns: Map<TaskType, string[]> = new Map([
    ['research', ['research', 'investigate', 'explore', 'study', 'learn', 'discover', 'find out']],
    ['analysis', ['analyze', 'understand', 'examine', 'assess', 'evaluate', 'review', 'inspect']],
    ['planning', ['plan', 'design', 'architect', 'strategize', 'outline', 'organize', 'structure']],
    ['creation', ['create', 'write', 'build', 'develop', 'implement', 'generate', 'compose', 'draft']],
    ['validation', ['validate', 'test', 'verify', 'check', 'confirm', 'ensure', 'quality']],
    ['execution', ['execute', 'run', 'perform', 'deploy', 'launch', 'start', 'apply']],
    ['review', ['review', 'refine', 'improve', 'optimize', 'edit', 'polish', 'finalize']],
    ['integration', ['integrate', 'combine', 'merge', 'connect', 'link', 'consolidate']],
  ])

  // Complexity indicators
  private readonly complexityIndicators = {
    high: ['complex', 'comprehensive', 'detailed', 'thorough', 'extensive', 'multi-step', 'advanced'],
    medium: ['moderate', 'standard', 'typical', 'regular', 'normal'],
    low: ['simple', 'basic', 'quick', 'easy', 'straightforward', 'brief'],
  }

  constructor(persistence?: PlanPersistence) {
    this.persistence = persistence || null
  }

  /**
   * Perform comprehensive goal analysis
   */
  async analyzeGoal(goal: string, context?: OrchestrationContext): Promise<GoalAnalysis> {
    const goalLower = goal.toLowerCase()
    const words = goal.split(/\s+/)

    // Calculate complexity
    const { complexity, score: complexityScore } = this.assessComplexity(goal)

    // Estimate task count
    const estimatedTasks = this.estimateTaskCount(goal, complexity)

    // Assess feasibility
    const { feasibility, score: feasibilityScore } = this.assessFeasibility(goal, context)

    // Identify required capabilities
    const requiredCapabilities = this.identifyCapabilities(goal)

    // Identify potential risks
    const potentialRisks = this.identifyRisks(goal, complexity)

    // Generate recommendations (including learning-based)
    const recommendations = await this.generateRecommendations(goal, complexity)

    // Create task decomposition
    const decomposition = this.decomposeGoal(goal, estimatedTasks)

    return {
      goal,
      complexity,
      complexityScore,
      estimatedTasks,
      feasibility,
      feasibilityScore,
      requiredCapabilities,
      potentialRisks,
      recommendations,
      decomposition,
    }
  }

  /**
   * Reason about a specific task
   */
  async reasonAboutTask(
    taskDescription: string,
    context?: Record<string, unknown>
  ): Promise<TaskReasoning> {
    const taskType = this.classifyTask(taskDescription)
    const complexity = this.assessTaskComplexity(taskDescription)

    // Get historical data if available
    let historicalConfidence = 0.8
    if (this.persistence) {
      historicalConfidence = this.persistence.getTaskSuccessRate(taskDescription)
    }

    const reasoning: TaskReasoning = {
      task: taskDescription,
      reasoning: this.generateTaskReasoning(taskDescription, taskType),
      approach: this.determineApproach(taskType, complexity),
      dependencies: this.inferDependencies(taskDescription, context),
      optimalStrategy: this.selectOptimalStrategy(taskType, complexity),
      estimatedDuration: this.estimateDuration(complexity),
      confidence: historicalConfidence,
      alternatives: this.generateAlternatives(taskDescription, taskType),
      risks: this.identifyTaskRisks(taskDescription, taskType),
    }

    return reasoning
  }

  /**
   * Decide whether to replan based on execution results
   */
  evaluateReplan(
    plan: OrchestrationPlan,
    taskResults: Map<string, TaskExecutionResult>
  ): ReplanDecision {
    const completedTasks = plan.tasks.filter(t => t.status === 'completed')
    const failedTasks = plan.tasks.filter(t => t.status === 'failed')
    const pendingTasks = plan.tasks.filter(t => t.status === 'pending')

    // Calculate failure rate
    const executedCount = completedTasks.length + failedTasks.length
    const failureRate = executedCount > 0 ? failedTasks.length / executedCount : 0

    // Check for replan triggers
    const suggestedChanges: PlanChange[] = []
    let shouldReplan = false
    let reason = ''

    // Trigger 1: High failure rate
    if (failureRate > 0.3 && failedTasks.length >= 2) {
      shouldReplan = true
      reason = `High failure rate (${(failureRate * 100).toFixed(0)}%) detected`

      // Suggest adding recovery tasks
      for (const failedTask of failedTasks) {
        suggestedChanges.push({
          type: 'add_task',
          newTask: {
            name: `Recover from ${failedTask.name}`,
            description: `Address failure in "${failedTask.name}": ${failedTask.error || 'Unknown error'}`,
            status: 'pending',
          },
          priority: 10,
        })
      }
    }

    // Trigger 2: Cascading failures (dependent tasks will fail)
    for (const pendingTask of pendingTasks) {
      const hasDependencyFailure = this.checkDependencyFailure(pendingTask, failedTasks, plan)
      if (hasDependencyFailure) {
        shouldReplan = true
        reason = reason || 'Dependency failures detected'

        suggestedChanges.push({
          type: 'modify_task',
          taskId: pendingTask.id,
          modification: {
            description: pendingTask.description + ' (adjusted for dependency failure)',
          },
          priority: 5,
        })
      }
    }

    // Trigger 3: Low confidence from execution results
    const avgConfidence = this.calculateAverageConfidence(taskResults)
    if (avgConfidence < 0.6 && pendingTasks.length > 0) {
      shouldReplan = true
      reason = reason || `Low execution confidence (${(avgConfidence * 100).toFixed(0)}%)`

      // Suggest adding validation tasks
      suggestedChanges.push({
        type: 'add_task',
        newTask: {
          name: 'Additional Validation',
          description: 'Validate previous task outputs before continuing',
          status: 'pending',
        },
        priority: 8,
      })
    }

    return {
      shouldReplan,
      reason,
      suggestedChanges: suggestedChanges.sort((a, b) => b.priority - a.priority),
      confidence: shouldReplan ? 0.75 : 0.9,
    }
  }

  /**
   * Apply replan changes to update the plan
   */
  applyReplanChanges(plan: OrchestrationPlan, changes: PlanChange[]): OrchestrationPlan {
    const updatedPlan = { ...plan, tasks: [...plan.tasks] }

    for (const change of changes) {
      switch (change.type) {
        case 'add_task':
          if (change.newTask) {
            const newTask: OrchestrationTask = {
              id: this.generateId('task'),
              name: change.newTask.name || 'New Task',
              description: change.newTask.description || '',
              status: 'pending',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }

            // Insert after failed tasks
            const insertIndex = updatedPlan.tasks.findIndex(t => t.status === 'pending')
            if (insertIndex >= 0) {
              updatedPlan.tasks.splice(insertIndex, 0, newTask)
            } else {
              updatedPlan.tasks.push(newTask)
            }
          }
          break

        case 'remove_task':
          if (change.taskId) {
            updatedPlan.tasks = updatedPlan.tasks.filter(t => t.id !== change.taskId)
          }
          break

        case 'modify_task':
          if (change.taskId && change.modification) {
            const taskIndex = updatedPlan.tasks.findIndex(t => t.id === change.taskId)
            if (taskIndex >= 0) {
              updatedPlan.tasks[taskIndex] = {
                ...updatedPlan.tasks[taskIndex],
                ...change.modification,
                updatedAt: Date.now(),
              }
            }
          }
          break

        case 'reorder_tasks':
          // Re-sort pending tasks by priority
          const completed = updatedPlan.tasks.filter(t => t.status !== 'pending')
          const pending = updatedPlan.tasks.filter(t => t.status === 'pending')
          updatedPlan.tasks = [...completed, ...pending]
          break
      }
    }

    return updatedPlan
  }

  /**
   * Generate intelligent task decomposition from goal
   */
  decomposeGoal(goal: string, targetTaskCount: number): TaskDecomposition[] {
    const goalLower = goal.toLowerCase()
    const decomposition: TaskDecomposition[] = []

    // Always start with analysis/planning
    decomposition.push({
      name: 'Analyze Requirements',
      description: `Analyze and understand the requirements for: ${goal}`,
      type: 'analysis',
      priority: 1,
      estimatedDuration: 200,
      dependencies: [],
      parallelizable: false,
    })

    // Add research if needed
    if (this.matchesPatterns(goalLower, this.taskPatterns.get('research')!)) {
      decomposition.push({
        name: 'Research and Gather Information',
        description: 'Collect relevant information, data, and context',
        type: 'research',
        priority: 2,
        estimatedDuration: 300,
        dependencies: ['Analyze Requirements'],
        parallelizable: false,
      })
    }

    // Add planning phase
    if (targetTaskCount > 3 || this.matchesPatterns(goalLower, this.taskPatterns.get('planning')!)) {
      decomposition.push({
        name: 'Create Implementation Plan',
        description: 'Design the approach and structure for achieving the goal',
        type: 'planning',
        priority: 3,
        estimatedDuration: 250,
        dependencies: ['Analyze Requirements'],
        parallelizable: true,
      })
    }

    // Add creation/implementation tasks
    if (this.matchesPatterns(goalLower, this.taskPatterns.get('creation')!)) {
      decomposition.push({
        name: 'Draft Initial Content',
        description: 'Create the initial draft or prototype',
        type: 'creation',
        priority: 4,
        estimatedDuration: 400,
        dependencies: decomposition.length > 1 ? [decomposition[decomposition.length - 1].name] : [],
        parallelizable: false,
      })

      decomposition.push({
        name: 'Refine and Enhance',
        description: 'Improve and enhance the created content',
        type: 'review',
        priority: 5,
        estimatedDuration: 300,
        dependencies: ['Draft Initial Content'],
        parallelizable: false,
      })
    }

    // Add validation
    decomposition.push({
      name: 'Validate and Verify',
      description: 'Validate that all requirements are met and quality standards achieved',
      type: 'validation',
      priority: 10,
      estimatedDuration: 200,
      dependencies: decomposition.length > 0 ? [decomposition[decomposition.length - 1].name] : [],
      parallelizable: false,
    })

    // Add finalization
    decomposition.push({
      name: 'Finalize and Complete',
      description: 'Final review and completion of the goal',
      type: 'review',
      priority: 11,
      estimatedDuration: 150,
      dependencies: ['Validate and Verify'],
      parallelizable: false,
    })

    // Trim or expand to match target count
    if (decomposition.length > targetTaskCount) {
      // Keep essential tasks: first, creation tasks, and last
      const essential = [decomposition[0], decomposition[decomposition.length - 2], decomposition[decomposition.length - 1]]
      const middle = decomposition.slice(1, -2)
      const remaining = targetTaskCount - essential.length

      return [essential[0], ...middle.slice(0, remaining), ...essential.slice(1)]
    }

    return decomposition
  }

  /**
   * Classify task type based on description
   */
  private classifyTask(taskDescription: string): TaskType {
    const descLower = taskDescription.toLowerCase()

    for (const [type, patterns] of this.taskPatterns) {
      if (this.matchesPatterns(descLower, patterns)) {
        return type
      }
    }

    return 'execution' // Default type
  }

  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern))
  }

  private assessComplexity(goal: string): { complexity: GoalAnalysis['complexity']; score: number } {
    const goalLower = goal.toLowerCase()
    const words = goal.split(/\s+/)
    let score = 0.5 // Base score

    // Word count factor
    if (words.length > 30) score += 0.2
    else if (words.length > 15) score += 0.1
    else if (words.length < 8) score -= 0.1

    // Complexity indicators
    if (this.matchesPatterns(goalLower, this.complexityIndicators.high)) score += 0.25
    if (this.matchesPatterns(goalLower, this.complexityIndicators.medium)) score += 0.1
    if (this.matchesPatterns(goalLower, this.complexityIndicators.low)) score -= 0.15

    // Multiple action words indicate higher complexity
    let actionCount = 0
    for (const patterns of this.taskPatterns.values()) {
      if (this.matchesPatterns(goalLower, patterns)) actionCount++
    }
    score += actionCount * 0.1

    // Normalize score
    score = Math.max(0, Math.min(1, score))

    // Map to complexity level
    let complexity: GoalAnalysis['complexity']
    if (score >= 0.8) complexity = 'very_high'
    else if (score >= 0.6) complexity = 'high'
    else if (score >= 0.4) complexity = 'medium'
    else complexity = 'low'

    return { complexity, score }
  }

  private assessTaskComplexity(task: string): 'low' | 'medium' | 'high' {
    const { complexity } = this.assessComplexity(task)
    if (complexity === 'very_high' || complexity === 'high') return 'high'
    if (complexity === 'medium') return 'medium'
    return 'low'
  }

  private estimateTaskCount(goal: string, complexity: GoalAnalysis['complexity']): number {
    const baseCount: Record<GoalAnalysis['complexity'], number> = {
      low: 2,
      medium: 4,
      high: 6,
      very_high: 8,
    }

    return baseCount[complexity]
  }

  private assessFeasibility(
    goal: string,
    context?: OrchestrationContext
  ): { feasibility: GoalAnalysis['feasibility']; score: number } {
    let score = 0.8 // Default high feasibility

    const goalLower = goal.toLowerCase()

    // Reduce for external dependencies
    if (goalLower.includes('external') || goalLower.includes('api') || goalLower.includes('third-party')) {
      score -= 0.1
    }

    // Reduce for time-sensitive goals
    if (goalLower.includes('urgent') || goalLower.includes('immediately') || goalLower.includes('asap')) {
      score -= 0.1
    }

    // Increase if tools are available
    if (context?.availableTools && context.availableTools.length > 0) {
      score += 0.1
    }

    // Normalize
    score = Math.max(0, Math.min(1, score))

    let feasibility: GoalAnalysis['feasibility']
    if (score >= 0.7) feasibility = 'high'
    else if (score >= 0.4) feasibility = 'medium'
    else feasibility = 'low'

    return { feasibility, score }
  }

  private identifyCapabilities(goal: string): string[] {
    const capabilities: string[] = []
    const goalLower = goal.toLowerCase()

    if (this.matchesPatterns(goalLower, this.taskPatterns.get('research')!)) {
      capabilities.push('information_retrieval', 'web_search')
    }
    if (this.matchesPatterns(goalLower, this.taskPatterns.get('creation')!)) {
      capabilities.push('content_generation', 'text_processing')
    }
    if (this.matchesPatterns(goalLower, this.taskPatterns.get('analysis')!)) {
      capabilities.push('data_analysis', 'pattern_recognition')
    }
    if (this.matchesPatterns(goalLower, this.taskPatterns.get('execution')!)) {
      capabilities.push('task_execution', 'automation')
    }
    if (goalLower.includes('code') || goalLower.includes('program') || goalLower.includes('develop')) {
      capabilities.push('code_generation', 'software_development')
    }

    // Always include base capabilities
    capabilities.push('reasoning', 'planning')

    return [...new Set(capabilities)]
  }

  private identifyRisks(goal: string, complexity: GoalAnalysis['complexity']): string[] {
    const risks: string[] = []
    const goalLower = goal.toLowerCase()

    if (complexity === 'high' || complexity === 'very_high') {
      risks.push('Complex goal may require multiple iterations')
    }

    if (goalLower.includes('all') || goalLower.includes('every') || goalLower.includes('complete')) {
      risks.push('Comprehensive scope may be difficult to verify')
    }

    if (goalLower.includes('new') || goalLower.includes('novel') || goalLower.includes('innovative')) {
      risks.push('Novel approaches may have unexpected challenges')
    }

    if (this.matchesPatterns(goalLower, ['external', 'api', 'third-party', 'integration'])) {
      risks.push('External dependencies may cause delays')
    }

    return risks
  }

  private async generateRecommendations(
    goal: string,
    complexity: GoalAnalysis['complexity']
  ): Promise<string[]> {
    const recommendations: string[] = []

    // Add complexity-based recommendations
    if (complexity === 'very_high') {
      recommendations.push('Consider breaking this goal into smaller sub-goals')
      recommendations.push('Plan for iterative refinement and validation')
    } else if (complexity === 'high') {
      recommendations.push('Ensure clear milestones for progress tracking')
    }

    // Add learning-based recommendations if available
    if (this.persistence) {
      const learningRecs = this.persistence.getRecommendations(goal)
      recommendations.push(...learningRecs)
    }

    // General best practices
    recommendations.push('Review intermediate results before proceeding')

    return recommendations
  }

  private generateTaskReasoning(task: string, type: TaskType): string {
    const reasoningTemplates: Record<TaskType, string> = {
      research: 'This task requires gathering and synthesizing information from available sources.',
      analysis: 'This task involves examining and understanding the subject matter in detail.',
      planning: 'This task requires designing a structured approach to achieve the objective.',
      creation: 'This task involves generating new content or artifacts based on requirements.',
      validation: 'This task requires verifying outputs against defined criteria.',
      execution: 'This task involves performing specific actions to complete objectives.',
      review: 'This task requires evaluating and improving existing work.',
      integration: 'This task involves combining multiple components into a cohesive whole.',
    }

    return reasoningTemplates[type] + ` Specifically: ${task}`
  }

  private determineApproach(type: TaskType, complexity: 'low' | 'medium' | 'high'): string {
    if (complexity === 'high') {
      return `Iterative ${type} with checkpoints and validation`
    } else if (complexity === 'medium') {
      return `Structured ${type} with clear deliverables`
    }
    return `Direct ${type} with minimal overhead`
  }

  private inferDependencies(task: string, context?: Record<string, unknown>): string[] {
    const dependencies: string[] = []
    const taskLower = task.toLowerCase()

    if (taskLower.includes('based on') || taskLower.includes('using')) {
      dependencies.push('previous_task_output')
    }
    if (taskLower.includes('after') || taskLower.includes('following')) {
      dependencies.push('sequential_predecessor')
    }
    if (context?.previousTasks) {
      dependencies.push('context_tasks')
    }

    return dependencies
  }

  private selectOptimalStrategy(type: TaskType, complexity: 'low' | 'medium' | 'high'): string {
    if (type === 'research' || type === 'analysis') {
      return complexity === 'high' ? 'depth_first_exploration' : 'breadth_first_scan'
    }
    if (type === 'creation') {
      return complexity === 'high' ? 'iterative_refinement' : 'direct_generation'
    }
    if (type === 'validation') {
      return 'systematic_verification'
    }
    return 'sequential_execution'
  }

  private estimateDuration(complexity: 'low' | 'medium' | 'high'): TaskReasoning['estimatedDuration'] {
    const mapping: Record<string, TaskReasoning['estimatedDuration']> = {
      low: 'short',
      medium: 'medium',
      high: 'long',
    }
    return mapping[complexity]
  }

  private generateAlternatives(task: string, type: TaskType): AlternativeApproach[] {
    // Generate alternative approaches based on task type
    const alternatives: AlternativeApproach[] = []

    if (type === 'creation') {
      alternatives.push({
        description: 'Template-based generation',
        pros: ['Faster execution', 'Consistent format'],
        cons: ['Less flexibility', 'May miss nuances'],
        confidence: 0.7,
      })
    }

    if (type === 'research') {
      alternatives.push({
        description: 'Focused search on specific topics',
        pros: ['More relevant results', 'Faster completion'],
        cons: ['May miss broader context'],
        confidence: 0.75,
      })
    }

    return alternatives
  }

  private identifyTaskRisks(task: string, type: TaskType): TaskRisk[] {
    const risks: TaskRisk[] = []

    // Common risks by type
    if (type === 'creation') {
      risks.push({
        description: 'Output may not meet quality expectations',
        probability: 0.2,
        impact: 'medium',
        mitigation: 'Include review and refinement step',
      })
    }

    if (type === 'research') {
      risks.push({
        description: 'Incomplete information coverage',
        probability: 0.3,
        impact: 'low',
        mitigation: 'Use multiple information sources',
      })
    }

    return risks
  }

  private checkDependencyFailure(
    task: OrchestrationTask,
    failedTasks: OrchestrationTask[],
    plan: OrchestrationPlan
  ): boolean {
    const taskLower = (task.name + ' ' + task.description).toLowerCase()

    // Check for explicit dependencies
    if (taskLower.includes('after') || taskLower.includes('based on') || taskLower.includes('using results')) {
      // This task has dependencies - check if any failed
      const taskIndex = plan.tasks.indexOf(task)
      for (let i = 0; i < taskIndex; i++) {
        if (plan.tasks[i].status === 'failed') {
          return true
        }
      }
    }

    return false
  }

  private calculateAverageConfidence(results: Map<string, TaskExecutionResult>): number {
    if (results.size === 0) return 0.8

    let totalConfidence = 0
    for (const result of results.values()) {
      totalConfidence += result.metrics.confidence
    }
    return totalConfidence / results.size
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}
