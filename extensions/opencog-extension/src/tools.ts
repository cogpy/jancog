import { MCPTool } from '@janhq/core'

// v2.0 Tool names
export const CREATE_PLAN = 'create_orchestration_plan'
export const EXECUTE_PLAN = 'execute_orchestration_plan'
export const GET_PLAN = 'get_orchestration_plan'
export const LIST_PLANS = 'list_orchestration_plans'
export const CANCEL_PLAN = 'cancel_orchestration_plan'
export const ANALYZE_GOAL = 'analyze_goal'
export const REASON_ABOUT_TASK = 'reason_about_task'

// v3.0 Tool names - Atomspace, PLN, and Tool Integration
export const QUERY_KNOWLEDGE = 'query_knowledge'
export const INFER_KNOWLEDGE = 'infer_knowledge'
export const EXECUTE_TOOL = 'execute_tool'
export const GET_KNOWLEDGE_STATS = 'get_knowledge_stats'

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
    // v3.0 Tools - Atomspace, PLN, and Tool Integration
    {
      name: QUERY_KNOWLEDGE,
      description:
        'Query the Atomspace knowledge graph for stored knowledge about goals, tasks, concepts, and relationships. Find similar goals, retrieve task patterns, and explore the knowledge graph.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['GoalNode', 'TaskNode', 'PlanNode', 'ConceptNode', 'ToolNode', 'InheritanceLink', 'SimilarityLink'],
            description: 'Type of atom to search for'
          },
          name: { type: 'string', description: 'Name pattern to match (supports regex)' },
          min_confidence: { type: 'number', description: 'Minimum confidence threshold (0.0 to 1.0)' },
          min_strength: { type: 'number', description: 'Minimum truth value strength (0.0 to 1.0)' },
          limit: { type: 'number', description: 'Maximum number of results to return' },
          find_similar: { type: 'boolean', description: 'Find similar goals based on shared concepts' },
          goal: { type: 'string', description: 'Goal text to find similar goals for (requires find_similar=true)' },
        },
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: INFER_KNOWLEDGE,
      description:
        'Use PLN (Probabilistic Logic Networks) to derive new knowledge through logical inference. Supports forward chaining (derive new facts), backward chaining (prove goals), and task success prediction.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['forward', 'backward', 'task_success'],
            description: 'Inference mode: forward=derive new knowledge, backward=prove goal, task_success=predict likelihood'
          },
          target_atom_id: { type: 'string', description: 'Target atom ID for backward chaining' },
          task_description: { type: 'string', description: 'Task description for task_success mode' },
          max_iterations: { type: 'number', description: 'Maximum inference iterations' },
          min_confidence: { type: 'number', description: 'Minimum confidence for inferences' },
          max_new_atoms: { type: 'number', description: 'Maximum new atoms to create' },
          max_depth: { type: 'number', description: 'Maximum depth for backward chaining' },
          max_paths: { type: 'number', description: 'Maximum proof paths to explore' },
          focus_atoms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Atom IDs to focus inference on'
          },
          context: { type: 'object', description: 'Additional context for inference' },
        },
        required: ['mode'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: EXECUTE_TOOL,
      description:
        'Execute an integrated tool (RAG retrieval, file operations, web search, LLM inference, code analysis). Use tool chains for complex multi-step operations.',
      inputSchema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'Tool to execute: rag_retrieve, file_read, file_write, web_search, llm_inference, code_analysis, data_transform, summarize'
          },
          args: {
            type: 'object',
            description: 'Arguments for the tool (varies by tool type)',
          },
          chain: { type: 'boolean', description: 'If true, treat tool_name as a chain name' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['tool_name'],
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
    {
      name: GET_KNOWLEDGE_STATS,
      description:
        'Get statistics about the OpenCog knowledge system including Atomspace size, PLN inference history, tool execution stats, and plan metrics.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      server: OPENCOG_INTERNAL_SERVER,
    },
  ]
}
