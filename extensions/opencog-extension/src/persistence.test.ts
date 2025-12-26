import { describe, it, expect, beforeEach } from 'vitest'
import { PlanPersistence, type TaskHistoryEntry } from './persistence'
import type { OrchestrationPlan, OrchestrationTask } from '@janhq/core'

describe('PlanPersistence', () => {
  let persistence: PlanPersistence
  let mockPlan: OrchestrationPlan

  beforeEach(() => {
    persistence = new PlanPersistence(false) // Disable localStorage for tests

    mockPlan = {
      id: 'plan_1',
      goal: 'Write a comprehensive report',
      tasks: [
        {
          id: 'task_1',
          name: 'Research topic',
          description: 'Gather information',
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'task_2',
          name: 'Write draft',
          description: 'Create initial draft',
          status: 'completed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      status: 'completed',
      createdAt: Date.now(),
      completedAt: Date.now(),
    }
  })

  describe('save and load', () => {
    it('should save and load a plan', async () => {
      await persistence.save(mockPlan)
      const loaded = await persistence.load(mockPlan.id)

      expect(loaded).not.toBeNull()
      expect(loaded?.id).toBe(mockPlan.id)
      expect(loaded?.goal).toBe(mockPlan.goal)
    })

    it('should return null for non-existent plan', async () => {
      const loaded = await persistence.load('non-existent')
      expect(loaded).toBeNull()
    })
  })

  describe('loadAll', () => {
    it('should load all saved plans', async () => {
      await persistence.save(mockPlan)
      await persistence.save({ ...mockPlan, id: 'plan_2', goal: 'Another goal' })

      const plans = await persistence.loadAll()
      expect(plans).toHaveLength(2)
    })
  })

  describe('delete', () => {
    it('should delete a plan', async () => {
      await persistence.save(mockPlan)
      const deleted = await persistence.delete(mockPlan.id)

      expect(deleted).toBe(true)
      const loaded = await persistence.load(mockPlan.id)
      expect(loaded).toBeNull()
    })

    it('should return false for non-existent plan', async () => {
      const deleted = await persistence.delete('non-existent')
      expect(deleted).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all plans', async () => {
      await persistence.save(mockPlan)
      await persistence.save({ ...mockPlan, id: 'plan_2' })
      await persistence.clear()

      const plans = await persistence.loadAll()
      expect(plans).toHaveLength(0)
    })
  })

  describe('recordExecution and learning', () => {
    it('should record execution history', () => {
      const taskMetrics = new Map<string, TaskHistoryEntry>([
        ['task_1', {
          taskId: 'task_1',
          name: 'Research topic',
          description: 'Gather information',
          status: 'completed',
          executionTime: 200,
          retryCount: 0,
          confidence: 0.9,
        }],
        ['task_2', {
          taskId: 'task_2',
          name: 'Write draft',
          description: 'Create initial draft',
          status: 'completed',
          executionTime: 300,
          retryCount: 0,
          confidence: 0.85,
        }],
      ])

      persistence.recordExecution(mockPlan, taskMetrics)
      const history = persistence.getExecutionHistory()

      expect(history).toHaveLength(1)
      expect(history[0].planId).toBe(mockPlan.id)
      expect(history[0].successRate).toBe(1)
    })

    it('should calculate success rate correctly', () => {
      const failedPlan: OrchestrationPlan = {
        ...mockPlan,
        tasks: [
          { ...mockPlan.tasks[0], status: 'completed' },
          { ...mockPlan.tasks[1], status: 'failed' },
        ],
        status: 'failed',
      }

      const taskMetrics = new Map<string, TaskHistoryEntry>([
        ['task_1', {
          taskId: 'task_1',
          name: 'Research topic',
          description: 'Gather information',
          status: 'completed',
          executionTime: 200,
          retryCount: 0,
          confidence: 0.9,
        }],
        ['task_2', {
          taskId: 'task_2',
          name: 'Write draft',
          description: 'Create initial draft',
          status: 'failed',
          executionTime: 100,
          retryCount: 2,
          confidence: 0.3,
          error: 'Task failed',
        }],
      ])

      persistence.recordExecution(failedPlan, taskMetrics)
      const history = persistence.getExecutionHistory()

      expect(history[0].successRate).toBe(0.5)
    })
  })

  describe('getInsightsForGoal', () => {
    it('should return null for goals with no history', () => {
      const insights = persistence.getInsightsForGoal('Unknown goal')
      expect(insights).toBeNull()
    })

    it('should return insights after execution', () => {
      const taskMetrics = new Map<string, TaskHistoryEntry>([
        ['task_1', {
          taskId: 'task_1',
          name: 'Research topic',
          description: 'Gather information',
          status: 'completed',
          executionTime: 200,
          retryCount: 0,
          confidence: 0.9,
        }],
      ])

      persistence.recordExecution(mockPlan, taskMetrics)
      const insights = persistence.getInsightsForGoal(mockPlan.goal)

      expect(insights).not.toBeNull()
      expect(insights?.occurrences).toBe(1)
    })
  })

  describe('getTaskSuccessRate', () => {
    it('should return default rate for unknown tasks', () => {
      const rate = persistence.getTaskSuccessRate('Unknown task')
      expect(rate).toBe(0.8)
    })
  })

  describe('getAverageExecutionTime', () => {
    it('should return default time for unknown tasks', () => {
      const time = persistence.getAverageExecutionTime('Unknown task')
      expect(time).toBe(200)
    })
  })

  describe('getRecommendations', () => {
    it('should return empty array for goals with no history', () => {
      const recommendations = persistence.getRecommendations('New goal')
      expect(recommendations).toEqual([])
    })
  })

  describe('getFailurePatterns', () => {
    it('should return empty array initially', () => {
      const patterns = persistence.getFailurePatterns()
      expect(patterns).toEqual([])
    })
  })
})
