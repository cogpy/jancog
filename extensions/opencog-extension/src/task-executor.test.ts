import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TaskExecutor, type TaskExecutorConfig } from './task-executor'
import type { OrchestrationTask, OrchestrationPlan, OrchestrationContext } from '@janhq/core'

describe('TaskExecutor', () => {
  let executor: TaskExecutor
  let mockTask: OrchestrationTask
  let mockPlan: OrchestrationPlan
  let mockContext: OrchestrationContext

  beforeEach(() => {
    executor = new TaskExecutor({
      maxRetries: 2,
      retryDelayMs: 10,
      timeoutMs: 5000,
      enableParallel: true,
      maxParallelTasks: 3,
    })

    mockTask = {
      id: 'task_1',
      name: 'Analyze Requirements',
      description: 'Analyze the requirements for the goal',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    mockPlan = {
      id: 'plan_1',
      goal: 'Test goal',
      tasks: [mockTask],
      status: 'executing',
      createdAt: Date.now(),
    }

    mockContext = {
      availableTools: ['read', 'write'],
    }
  })

  describe('executeTask', () => {
    it('should execute a task successfully', async () => {
      const result = await executor.executeTask(mockTask, mockPlan, mockContext)

      expect(result.success).toBe(true)
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.metrics.retryCount).toBe(0)
      expect(result.metrics.confidence).toBeGreaterThan(0)
    })

    it('should execute analysis tasks', async () => {
      mockTask.name = 'Analyze data patterns'
      mockTask.description = 'Analyze the data to understand patterns'

      const result = await executor.executeTask(mockTask, mockPlan, mockContext)

      expect(result.success).toBe(true)
      expect(result.output).toHaveProperty('type', 'analysis')
    })

    it('should execute creation tasks', async () => {
      mockTask.name = 'Create documentation'
      mockTask.description = 'Write the documentation'

      const result = await executor.executeTask(mockTask, mockPlan, mockContext)

      expect(result.success).toBe(true)
      expect(result.output).toHaveProperty('type', 'generation')
    })

    it('should execute validation tasks', async () => {
      mockTask.name = 'Validate output'
      mockTask.description = 'Test and verify the output'

      const result = await executor.executeTask(mockTask, mockPlan, mockContext)

      expect(result.success).toBe(true)
      expect(result.output).toHaveProperty('type', 'validation')
    })

    it('should call progress callback', async () => {
      const progressCallback = vi.fn()

      await executor.executeTask(mockTask, mockPlan, mockContext, progressCallback)

      expect(progressCallback).toHaveBeenCalled()
    })
  })

  describe('executeTasksParallel', () => {
    it('should execute multiple tasks in parallel', async () => {
      const tasks: OrchestrationTask[] = [
        { ...mockTask, id: 'task_1', name: 'Research topic' },
        { ...mockTask, id: 'task_2', name: 'Create outline' },
        { ...mockTask, id: 'task_3', name: 'Validate results' },
      ]
      mockPlan.tasks = tasks

      const results = await executor.executeTasksParallel(tasks, mockPlan, mockContext)

      expect(results.size).toBe(3)
      for (const result of results.values()) {
        expect(result.success).toBe(true)
      }
    })

    it('should call onTaskComplete for each task', async () => {
      const tasks: OrchestrationTask[] = [
        { ...mockTask, id: 'task_1' },
        { ...mockTask, id: 'task_2' },
      ]
      mockPlan.tasks = tasks
      const onComplete = vi.fn()

      await executor.executeTasksParallel(tasks, mockPlan, mockContext, onComplete)

      expect(onComplete).toHaveBeenCalledTimes(2)
    })
  })

  describe('cancelTask', () => {
    it('should return false for non-running task', () => {
      const result = executor.cancelTask('non-existent-task')
      expect(result).toBe(false)
    })
  })

  describe('cancelAllTasks', () => {
    it('should cancel all running tasks without error', () => {
      expect(() => executor.cancelAllTasks()).not.toThrow()
    })
  })
})
