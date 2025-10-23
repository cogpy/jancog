import { MCPTool } from '@janhq/core'

// Tool names
export const CREATE_PLAN = 'create_orchestration_plan'
export const EXECUTE_PLAN = 'execute_orchestration_plan'
export const GET_PLAN = 'get_orchestration_plan'
export const LIST_PLANS = 'list_orchestration_plans'
export const CANCEL_PLAN = 'cancel_orchestration_plan'
export const ANALYZE_GOAL = 'analyze_goal'
export const REASON_ABOUT_TASK = 'reason_about_task'

export const OPENCOG_INTERNAL_SERVER = 'opencog-internal'

export function getOpenCogTools(): MCPTool[] {
  return [
    {
      name: CREATE_PLAN,
      description: 
        'Create an autonomous orchestration plan to achieve a high-level goal. The system will analyze the goal, break it down into tasks, and create an execution plan using cognitive reasoning.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { 
            type: 'string', 
            description: 'The high-level goal to achieve (e.g., "Research and write a report on renewable energy")' 
          },
          context: {
            type: 'object',
            description: 'Optional context information',
            properties: {
              threadId: { type: 'string', description: 'Thread ID for context' },
              availableTools: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'List of available tools that can be used'
              },
              modelId: { type: 'string', description: 'Model to use for reasoning' }
            }
          }
        },
        required: ['goal'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: EXECUTE_PLAN,
      description:
        'Execute a previously created orchestration plan. The system will autonomously execute each task in the plan, adapting as needed based on intermediate results.',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'The ID of the plan to execute' },
        },
        required: ['plan_id'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: GET_PLAN,
      description:
        'Get the current status and details of an orchestration plan.',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'The ID of the plan to retrieve' },
        },
        required: ['plan_id'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: LIST_PLANS,
      description:
        'List all orchestration plans (active and completed).',
      inputSchema: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['all', 'planning', 'executing', 'completed', 'failed'],
            description: 'Filter plans by status',
            default: 'all'
          },
        },
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: CANCEL_PLAN,
      description:
        'Cancel a running orchestration plan.',
      inputSchema: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', description: 'The ID of the plan to cancel' },
        },
        required: ['plan_id'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: ANALYZE_GOAL,
      description:
        'Use cognitive reasoning to analyze a goal and provide insights about complexity, feasibility, and required resources.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The goal to analyze' },
        },
        required: ['goal'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: REASON_ABOUT_TASK,
      description:
        'Apply cognitive reasoning to understand task requirements, dependencies, and optimal execution strategies.',
      inputSchema: {
        type: 'object',
        properties: {
          task_description: { type: 'string', description: 'The task to reason about' },
          context: {
            type: 'object',
            description: 'Optional context for reasoning',
          }
        },
        required: ['task_description'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
  ]
}
