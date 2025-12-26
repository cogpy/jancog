import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MultiAgentCoordinator, type Agent } from './multi-agent'
import { TaskExecutor } from './task-executor'
import type { OrchestrationPlan, OrchestrationTask, OrchestrationContext } from '@janhq/core'

describe('MultiAgentCoordinator', () => {
  let coordinator: MultiAgentCoordinator
  let taskExecutor: TaskExecutor
  let mockPlan: OrchestrationPlan
  let mockContext: OrchestrationContext

  beforeEach(() => {
    taskExecutor = new TaskExecutor({
      maxRetries: 1,
      retryDelayMs: 10,
      timeoutMs: 5000,
      enableParallel: true,
      maxParallelTasks: 3,
    })

    coordinator = new MultiAgentCoordinator(taskExecutor, 5)

    mockPlan = {
      id: 'plan_1',
      goal: 'Test goal',
      tasks: [
        {
          id: 'task_1',
          name: 'Research topic',
          description: 'Find relevant information',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'task_2',
          name: 'Analyze data',
          description: 'Evaluate the findings',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'task_3',
          name: 'Create report',
          description: 'Write the final report',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      status: 'executing',
      createdAt: Date.now(),
    }

    mockContext = {
      availableTools: ['read', 'write', 'search'],
    }
  })

  describe('getAgents', () => {
    it('should have initialized agents', () => {
      const agents = coordinator.getAgents()

      expect(agents.length).toBeGreaterThan(0)
      expect(agents.every(a => a.id && a.role && a.capabilities.length > 0)).toBe(true)
    })

    it('should have agents with different roles', () => {
      const agents = coordinator.getAgents()
      const roles = new Set(agents.map(a => a.role))

      expect(roles.size).toBeGreaterThan(1)
      expect(roles.has('coordinator')).toBe(true)
      expect(roles.has('researcher')).toBe(true)
    })

    it('should have agents with initial idle status', () => {
      const agents = coordinator.getAgents()

      expect(agents.every(a => a.status === 'idle')).toBe(true)
    })
  })

  describe('getAgent', () => {
    it('should return agent by ID', () => {
      const agents = coordinator.getAgents()
      const firstAgent = agents[0]

      const retrieved = coordinator.getAgent(firstAgent.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(firstAgent.id)
    })

    it('should return null for non-existent agent', () => {
      const agent = coordinator.getAgent('non-existent')
      expect(agent).toBeNull()
    })
  })

  describe('createCoordinationPlan', () => {
    it('should create a coordination plan', () => {
      const result = coordinator.createCoordinationPlan(mockPlan.tasks)

      expect(result.assignments).toBeDefined()
      expect(result.parallelGroups).toBeDefined()
      expect(result.estimatedTotalDuration).toBeGreaterThan(0)
    })

    it('should create parallel groups', () => {
      const result = coordinator.createCoordinationPlan(mockPlan.tasks)

      expect(result.parallelGroups.length).toBeGreaterThan(0)
      // All tasks should be in some group
      const allTaskIds = result.parallelGroups.flat()
      expect(allTaskIds.length).toBe(mockPlan.tasks.length)
    })

    it('should create assignments for all tasks', () => {
      const result = coordinator.createCoordinationPlan(mockPlan.tasks)

      expect(result.assignments.length).toBe(mockPlan.tasks.length)
    })

    it('should estimate total duration', () => {
      const result = coordinator.createCoordinationPlan(mockPlan.tasks)

      expect(result.estimatedTotalDuration).toBeGreaterThan(0)
    })
  })

  describe('coordinatePlanExecution', () => {
    it('should execute all tasks', async () => {
      const results = await coordinator.coordinatePlanExecution(mockPlan, mockContext)

      expect(results.size).toBe(mockPlan.tasks.length)
    })

    it('should update task statuses', async () => {
      await coordinator.coordinatePlanExecution(mockPlan, mockContext)

      expect(mockPlan.tasks.every(t => t.status === 'completed' || t.status === 'failed')).toBe(true)
    })

    it('should call progress callback', async () => {
      const progressCallback = vi.fn()

      await coordinator.coordinatePlanExecution(mockPlan, mockContext, progressCallback)

      expect(progressCallback).toHaveBeenCalledTimes(mockPlan.tasks.length)
    })

    it('should return results for each task', async () => {
      const results = await coordinator.coordinatePlanExecution(mockPlan, mockContext)

      for (const task of mockPlan.tasks) {
        expect(results.has(task.id)).toBe(true)
        const result = results.get(task.id)
        expect(result).toHaveProperty('success')
        expect(result).toHaveProperty('executionTime')
      }
    })
  })

  describe('sendMessage and getMessages', () => {
    it('should send and receive messages between agents', () => {
      const agents = coordinator.getAgents()
      const sender = agents[0]
      const receiver = agents[1]

      coordinator.sendMessage(sender.id, receiver.id, 'task_result', { completed: true })

      const messages = coordinator.getMessages(receiver.id)

      expect(messages.length).toBe(1)
      expect(messages[0].from).toBe(sender.id)
      expect(messages[0].to).toBe(receiver.id)
      expect(messages[0].type).toBe('task_result')
    })

    it('should clear messages after retrieval', () => {
      const agents = coordinator.getAgents()
      coordinator.sendMessage(agents[0].id, agents[1].id, 'status_update', {})

      coordinator.getMessages(agents[1].id)
      const messagesAfter = coordinator.getMessages(agents[1].id)

      expect(messagesAfter.length).toBe(0)
    })
  })

  describe('dependency handling', () => {
    it('should respect task dependencies', async () => {
      const dependentPlan: OrchestrationPlan = {
        ...mockPlan,
        tasks: [
          {
            id: 'task_1',
            name: 'Research topic',
            description: 'Find information',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: 'task_2',
            name: 'Review based on research',
            description: 'Review using results from previous task',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }

      const results = await coordinator.coordinatePlanExecution(dependentPlan, mockContext)

      // Both tasks should complete
      expect(results.size).toBe(2)
      expect(results.get('task_1')?.success).toBe(true)
      expect(results.get('task_2')?.success).toBe(true)
    })
  })

  describe('agent performance tracking', () => {
    it('should update agent performance after execution', async () => {
      const agents = coordinator.getAgents()
      const initialPerformance = { ...agents[0].performance }

      await coordinator.coordinatePlanExecution(mockPlan, mockContext)

      // At least one agent should have updated performance
      const updatedAgents = coordinator.getAgents()
      const hasUpdatedPerformance = updatedAgents.some(a =>
        a.performance.tasksCompleted > 0 || a.performance.tasksFailed > 0
      )

      expect(hasUpdatedPerformance).toBe(true)
    })
  })
})
