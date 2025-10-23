import { describe, it, expect, beforeEach } from 'vitest'
import { ExtensionTypeEnum } from '../extension'
import { OpenCogExtension } from './opencog'
import type { OrchestrationPlan, OrchestrationContext } from './opencog'

// Create a mock implementation of OpenCogExtension
class MockOpenCogExtension extends OpenCogExtension {
  private mockPlans: Map<string, OrchestrationPlan> = new Map()

  async onLoad(): Promise<void> {}
  onUnload(): void {}

  async getTools() {
    return []
  }

  async callTool(toolName: string, args: Record<string, unknown>) {
    return {
      error: '',
      content: [{ type: 'text' as const, text: 'Mock result' }],
    }
  }

  async createPlan(goal: string, context: OrchestrationContext): Promise<OrchestrationPlan> {
    const planId = `test-plan-${this.mockPlans.size + 1}`
    const plan: OrchestrationPlan = {
      id: planId,
      goal,
      tasks: [
        {
          id: 'task-1',
          name: 'Test Task',
          description: 'A test task',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      status: 'planning',
      createdAt: Date.now(),
    }
    this.mockPlans.set(plan.id, plan)
    return plan
  }

  async executePlan(planId: string): Promise<OrchestrationPlan> {
    const plan = this.mockPlans.get(planId)
    if (!plan) {
      throw new Error('Plan not found')
    }
    plan.status = 'completed'
    plan.tasks.forEach((task) => {
      task.status = 'completed'
    })
    return plan
  }

  async getPlan(planId: string): Promise<OrchestrationPlan | null> {
    return this.mockPlans.get(planId) || null
  }

  async listPlans(): Promise<OrchestrationPlan[]> {
    return Array.from(this.mockPlans.values())
  }

  async cancelPlan(planId: string): Promise<boolean> {
    const plan = this.mockPlans.get(planId)
    if (plan) {
      plan.status = 'failed'
      return true
    }
    return false
  }
}

describe('OpenCogExtension', () => {
  let openCogExtension: OpenCogExtension

  beforeEach(() => {
    openCogExtension = new MockOpenCogExtension(
      'test-url',
      'test-opencog-extension',
      'Test OpenCog Extension'
    )
  })

  it('should have the correct type', () => {
    expect(openCogExtension.type()).toBe(ExtensionTypeEnum.OpenCog)
  })

  it('should create an orchestration plan', async () => {
    const goal = 'Test goal'
    const context: OrchestrationContext = {
      threadId: 'test-thread',
    }
    const plan = await openCogExtension.createPlan(goal, context)

    expect(plan).toBeDefined()
    expect(plan.goal).toBe(goal)
    expect(plan.status).toBe('planning')
    expect(plan.tasks).toHaveLength(1)
  })

  it('should execute an orchestration plan', async () => {
    const goal = 'Test goal'
    const plan = await openCogExtension.createPlan(goal, {})
    const executedPlan = await openCogExtension.executePlan(plan.id)

    expect(executedPlan.status).toBe('completed')
    expect(executedPlan.tasks[0].status).toBe('completed')
  })

  it('should get a plan by id', async () => {
    const goal = 'Test goal'
    const createdPlan = await openCogExtension.createPlan(goal, {})
    const retrievedPlan = await openCogExtension.getPlan(createdPlan.id)

    expect(retrievedPlan).toBeDefined()
    expect(retrievedPlan?.id).toBe(createdPlan.id)
    expect(retrievedPlan?.goal).toBe(goal)
  })

  it('should list all plans', async () => {
    await openCogExtension.createPlan('Goal 1', {})
    await openCogExtension.createPlan('Goal 2', {})

    const plans = await openCogExtension.listPlans()
    expect(plans).toHaveLength(2)
  })

  it('should cancel a plan', async () => {
    const plan = await openCogExtension.createPlan('Test goal', {})
    const cancelled = await openCogExtension.cancelPlan(plan.id)

    expect(cancelled).toBe(true)
    const retrievedPlan = await openCogExtension.getPlan(plan.id)
    expect(retrievedPlan?.status).toBe('failed')
  })

  it('should return false when cancelling non-existent plan', async () => {
    const cancelled = await openCogExtension.cancelPlan('non-existent-id')
    expect(cancelled).toBe(false)
  })

  it('should get tools', async () => {
    const tools = await openCogExtension.getTools()
    expect(Array.isArray(tools)).toBe(true)
  })

  it('should call tools', async () => {
    const result = await openCogExtension.callTool('test-tool', {})
    expect(result).toBeDefined()
    expect(result.error).toBe('')
    expect(result.content).toHaveLength(1)
  })
})
