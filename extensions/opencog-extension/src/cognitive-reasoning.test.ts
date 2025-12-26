import { describe, it, expect, beforeEach } from 'vitest'
import { CognitiveReasoning, type GoalAnalysis, type TaskReasoning } from './cognitive-reasoning'
import { PlanPersistence } from './persistence'
import type { OrchestrationPlan, OrchestrationTask } from '@janhq/core'
import type { TaskExecutionResult } from './task-executor'

describe('CognitiveReasoning', () => {
  let reasoning: CognitiveReasoning
  let persistence: PlanPersistence

  beforeEach(() => {
    persistence = new PlanPersistence(false)
    reasoning = new CognitiveReasoning(persistence)
  })

  describe('analyzeGoal', () => {
    it('should analyze a simple goal', async () => {
      const analysis = await reasoning.analyzeGoal('Write a short note')

      expect(analysis.goal).toBe('Write a short note')
      expect(analysis.complexity).toBe('low')
      expect(analysis.feasibility).toBe('high')
      expect(analysis.estimatedTasks).toBeGreaterThan(0)
    })

    it('should analyze a complex goal', async () => {
      const analysis = await reasoning.analyzeGoal(
        'Research and write a comprehensive multi-chapter report on renewable energy trends including detailed analysis of solar, wind, and hydro power with statistical comparisons and future projections'
      )

      expect(analysis.complexity).toBe('very_high')
      expect(analysis.estimatedTasks).toBeGreaterThanOrEqual(6)
    })

    it('should identify required capabilities', async () => {
      const analysis = await reasoning.analyzeGoal('Research and create a presentation')

      expect(analysis.requiredCapabilities).toContain('information_retrieval')
      expect(analysis.requiredCapabilities).toContain('content_generation')
    })

    it('should provide recommendations', async () => {
      const analysis = await reasoning.analyzeGoal('Create a simple document')

      expect(analysis.recommendations).toBeDefined()
      expect(analysis.recommendations.length).toBeGreaterThan(0)
    })

    it('should provide task decomposition', async () => {
      const analysis = await reasoning.analyzeGoal('Write and review a report')

      expect(analysis.decomposition).toBeDefined()
      expect(analysis.decomposition.length).toBeGreaterThan(0)
      expect(analysis.decomposition[0]).toHaveProperty('name')
      expect(analysis.decomposition[0]).toHaveProperty('type')
    })
  })

  describe('reasonAboutTask', () => {
    it('should reason about a research task', async () => {
      const result = await reasoning.reasonAboutTask('Research market trends')

      expect(result.task).toBe('Research market trends')
      expect(result.reasoning).toContain('research')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should reason about a creation task', async () => {
      const result = await reasoning.reasonAboutTask('Create a presentation')

      expect(result.approach).toContain('creation')
      expect(result.optimalStrategy).toBeDefined()
    })

    it('should provide alternatives', async () => {
      const result = await reasoning.reasonAboutTask('Research the topic')

      expect(result.alternatives).toBeDefined()
      expect(Array.isArray(result.alternatives)).toBe(true)
    })

    it('should identify risks', async () => {
      const result = await reasoning.reasonAboutTask('Create complex document')

      expect(result.risks).toBeDefined()
      expect(Array.isArray(result.risks)).toBe(true)
    })
  })

  describe('evaluateReplan', () => {
    it('should not suggest replanning when all tasks succeed', () => {
      const plan: OrchestrationPlan = {
        id: 'plan_1',
        goal: 'Test goal',
        tasks: [
          { id: 'task_1', name: 'Task 1', description: '', status: 'completed', createdAt: 0, updatedAt: 0 },
          { id: 'task_2', name: 'Task 2', description: '', status: 'completed', createdAt: 0, updatedAt: 0 },
        ],
        status: 'executing',
        createdAt: Date.now(),
      }

      const results = new Map<string, TaskExecutionResult>([
        ['task_1', { success: true, output: {}, executionTime: 100, metrics: { toolsCalled: [], retryCount: 0, confidence: 0.9 } }],
        ['task_2', { success: true, output: {}, executionTime: 100, metrics: { toolsCalled: [], retryCount: 0, confidence: 0.9 } }],
      ])

      const decision = reasoning.evaluateReplan(plan, results)

      expect(decision.shouldReplan).toBe(false)
    })

    it('should suggest replanning when failure rate is high', () => {
      const plan: OrchestrationPlan = {
        id: 'plan_1',
        goal: 'Test goal',
        tasks: [
          { id: 'task_1', name: 'Task 1', description: '', status: 'failed', createdAt: 0, updatedAt: 0, error: 'Error 1' },
          { id: 'task_2', name: 'Task 2', description: '', status: 'failed', createdAt: 0, updatedAt: 0, error: 'Error 2' },
          { id: 'task_3', name: 'Task 3', description: '', status: 'completed', createdAt: 0, updatedAt: 0 },
          { id: 'task_4', name: 'Task 4', description: '', status: 'pending', createdAt: 0, updatedAt: 0 },
        ],
        status: 'executing',
        createdAt: Date.now(),
      }

      const results = new Map<string, TaskExecutionResult>([
        ['task_1', { success: false, output: null, error: 'Error 1', executionTime: 100, metrics: { toolsCalled: [], retryCount: 2, confidence: 0.2 } }],
        ['task_2', { success: false, output: null, error: 'Error 2', executionTime: 100, metrics: { toolsCalled: [], retryCount: 2, confidence: 0.2 } }],
        ['task_3', { success: true, output: {}, executionTime: 100, metrics: { toolsCalled: [], retryCount: 0, confidence: 0.9 } }],
      ])

      const decision = reasoning.evaluateReplan(plan, results)

      expect(decision.shouldReplan).toBe(true)
      expect(decision.reason).toContain('failure rate')
      expect(decision.suggestedChanges.length).toBeGreaterThan(0)
    })

    it('should suggest replanning when confidence is low', () => {
      const plan: OrchestrationPlan = {
        id: 'plan_1',
        goal: 'Test goal',
        tasks: [
          { id: 'task_1', name: 'Task 1', description: '', status: 'completed', createdAt: 0, updatedAt: 0 },
          { id: 'task_2', name: 'Task 2', description: '', status: 'pending', createdAt: 0, updatedAt: 0 },
        ],
        status: 'executing',
        createdAt: Date.now(),
      }

      const results = new Map<string, TaskExecutionResult>([
        ['task_1', { success: true, output: {}, executionTime: 100, metrics: { toolsCalled: [], retryCount: 0, confidence: 0.3 } }],
      ])

      const decision = reasoning.evaluateReplan(plan, results)

      expect(decision.shouldReplan).toBe(true)
      expect(decision.reason).toContain('confidence')
    })
  })

  describe('applyReplanChanges', () => {
    it('should add new tasks', () => {
      const plan: OrchestrationPlan = {
        id: 'plan_1',
        goal: 'Test goal',
        tasks: [
          { id: 'task_1', name: 'Task 1', description: '', status: 'completed', createdAt: 0, updatedAt: 0 },
          { id: 'task_2', name: 'Task 2', description: '', status: 'pending', createdAt: 0, updatedAt: 0 },
        ],
        status: 'executing',
        createdAt: Date.now(),
      }

      const changes = [
        {
          type: 'add_task' as const,
          newTask: { name: 'New Task', description: 'Added task' },
          priority: 10,
        },
      ]

      const updatedPlan = reasoning.applyReplanChanges(plan, changes)

      expect(updatedPlan.tasks.length).toBe(3)
      expect(updatedPlan.tasks.some(t => t.name === 'New Task')).toBe(true)
    })

    it('should remove tasks', () => {
      const plan: OrchestrationPlan = {
        id: 'plan_1',
        goal: 'Test goal',
        tasks: [
          { id: 'task_1', name: 'Task 1', description: '', status: 'completed', createdAt: 0, updatedAt: 0 },
          { id: 'task_2', name: 'Task 2', description: '', status: 'pending', createdAt: 0, updatedAt: 0 },
        ],
        status: 'executing',
        createdAt: Date.now(),
      }

      const changes = [
        {
          type: 'remove_task' as const,
          taskId: 'task_2',
          priority: 5,
        },
      ]

      const updatedPlan = reasoning.applyReplanChanges(plan, changes)

      expect(updatedPlan.tasks.length).toBe(1)
      expect(updatedPlan.tasks.some(t => t.id === 'task_2')).toBe(false)
    })

    it('should modify tasks', () => {
      const plan: OrchestrationPlan = {
        id: 'plan_1',
        goal: 'Test goal',
        tasks: [
          { id: 'task_1', name: 'Task 1', description: 'Original', status: 'pending', createdAt: 0, updatedAt: 0 },
        ],
        status: 'executing',
        createdAt: Date.now(),
      }

      const changes = [
        {
          type: 'modify_task' as const,
          taskId: 'task_1',
          modification: { description: 'Modified description' },
          priority: 5,
        },
      ]

      const updatedPlan = reasoning.applyReplanChanges(plan, changes)

      expect(updatedPlan.tasks[0].description).toBe('Modified description')
    })
  })

  describe('decomposeGoal', () => {
    it('should decompose a research goal', () => {
      const decomposition = reasoning.decomposeGoal('Research market trends', 4)

      expect(decomposition.length).toBeGreaterThan(0)
      expect(decomposition.some(d => d.type === 'research')).toBe(true)
    })

    it('should decompose a creation goal', () => {
      const decomposition = reasoning.decomposeGoal('Create a detailed report', 5)

      expect(decomposition.length).toBeGreaterThan(0)
      expect(decomposition.some(d => d.type === 'creation')).toBe(true)
    })

    it('should always include analysis and validation tasks', () => {
      const decomposition = reasoning.decomposeGoal('Do something', 4)

      expect(decomposition.some(d => d.type === 'analysis')).toBe(true)
      expect(decomposition.some(d => d.type === 'validation' || d.type === 'review')).toBe(true)
    })

    it('should respect target task count', () => {
      const decomposition = reasoning.decomposeGoal('Simple task', 3)

      expect(decomposition.length).toBeLessThanOrEqual(3)
    })
  })
})
