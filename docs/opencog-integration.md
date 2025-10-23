# OpenCog Integration in Jan

## Overview

Jan now includes OpenCog-inspired autonomous orchestration capabilities through a dedicated extension. This integration brings cognitive AI and autonomous task planning to Jan, enabling it to break down complex goals into executable tasks and coordinate their completion.

## What is OpenCog?

OpenCog is a cognitive AI framework designed for Artificial General Intelligence (AGI) research. It uses:

- **Atomspace**: A graph-based knowledge representation system
- **PLN (Probabilistic Logic Networks)**: Reasoning under uncertainty
- **Goal-oriented planning**: Hierarchical task decomposition and execution

This extension implements the core principles of OpenCog's orchestration capabilities in a way that integrates seamlessly with Jan's architecture.

## Features

### 🎯 Autonomous Goal Decomposition
The orchestration engine can take a high-level goal and automatically break it down into concrete, executable tasks.

**Example:**
```
Goal: "Research renewable energy trends and create a summary report"

Decomposed Tasks:
1. Analyze Requirements
2. Research and Gather Information
3. Draft Content
4. Review and Refine
5. Validate and Complete
```

### 🤖 Self-Directed Execution
Once a plan is created, the system can execute tasks autonomously, adapting based on intermediate results.

### 🧠 Cognitive Reasoning
The extension provides reasoning capabilities to:
- Analyze goal complexity and feasibility
- Determine optimal task execution strategies
- Identify dependencies between tasks
- Estimate resource requirements

### 📊 Plan Management
Full lifecycle management of orchestration plans:
- Create plans from goals
- Execute plans
- Monitor execution status
- Cancel running plans
- List and filter plans by status

## Architecture

### Extension Components

```
jan/
├── core/
│   └── src/browser/extensions/
│       └── opencog.ts          # OpenCog extension interface
└── extensions/
    └── opencog-extension/
        ├── src/
        │   ├── index.ts        # Main extension implementation
        │   └── tools.ts        # Orchestration tools
        ├── package.json
        └── README.md
```

### Key Classes

- **OpenCogExtension**: Abstract base class defining the orchestration interface
- **JanOpenCogExtension**: Concrete implementation with goal decomposition and execution
- **OrchestrationPlan**: Represents a plan with tasks and execution status
- **OrchestrationTask**: Individual task within a plan

## Available Tools

The extension exposes the following tools that can be used via Jan's MCP integration:

### 1. `create_orchestration_plan`
Creates an autonomous plan from a high-level goal.

**Input:**
```json
{
  "goal": "Research and write a report on AI ethics",
  "context": {
    "threadId": "thread_abc123",
    "availableTools": ["search", "write"],
    "modelId": "llama-3"
  }
}
```

**Output:**
```json
{
  "plan_id": "plan_1234567890_abc",
  "goal": "Research and write a report on AI ethics",
  "tasks": [
    {
      "id": "task_1",
      "name": "Analyze Requirements",
      "description": "Analyze the goal to understand requirements",
      "status": "pending"
    },
    // ... more tasks
  ],
  "status": "planning"
}
```

### 2. `execute_orchestration_plan`
Executes a plan autonomously.

**Input:**
```json
{
  "plan_id": "plan_1234567890_abc"
}
```

**Output:**
```json
{
  "plan_id": "plan_1234567890_abc",
  "status": "completed",
  "tasks": [
    {
      "id": "task_1",
      "name": "Analyze Requirements",
      "status": "completed",
      "result": { "completed": true, "message": "..." }
    }
  ]
}
```

### 3. `get_orchestration_plan`
Retrieves the status of a specific plan.

### 4. `list_orchestration_plans`
Lists all orchestration plans, optionally filtered by status.

### 5. `cancel_orchestration_plan`
Cancels a running plan.

### 6. `analyze_goal`
Analyzes a goal to understand its complexity and requirements.

**Input:**
```json
{
  "goal": "Build a web application"
}
```

**Output:**
```json
{
  "goal": "Build a web application",
  "complexity": "medium",
  "estimated_tasks": 5,
  "feasibility": "high",
  "required_resources": ["reasoning_model", "task_executor"]
}
```

### 7. `reason_about_task`
Applies cognitive reasoning to understand task requirements.

## Usage Examples

### Basic Goal Orchestration

```typescript
// In a Jan extension or application
const openCog = extensionManager.get(ExtensionTypeEnum.OpenCog)

// Create a plan
const plan = await openCog.createPlan(
  "Organize my project files and create documentation",
  { threadId: "current_thread" }
)

console.log(`Created plan: ${plan.id}`)
console.log(`Tasks: ${plan.tasks.length}`)

// Execute the plan
const result = await openCog.executePlan(plan.id)

// Check the result
if (result.status === 'completed') {
  console.log('All tasks completed successfully!')
} else {
  console.log('Some tasks failed')
}
```

### Monitoring Plan Execution

```typescript
// Create and start a plan
const plan = await openCog.createPlan("Research topic X", {})

// Execute asynchronously
openCog.executePlan(plan.id)

// Poll for status
const checkInterval = setInterval(async () => {
  const status = await openCog.getPlan(plan.id)
  
  console.log(`Status: ${status.status}`)
  
  if (status.status === 'completed' || status.status === 'failed') {
    clearInterval(checkInterval)
    console.log('Execution finished')
  }
}, 1000)
```

### Goal Analysis Before Planning

```typescript
// Analyze a goal before creating a plan
const analysis = await openCog.callTool('analyze_goal', {
  goal: "Create a machine learning model"
})

console.log('Complexity:', analysis.complexity)
console.log('Estimated tasks:', analysis.estimated_tasks)

// Proceed with planning based on analysis
if (analysis.feasibility === 'high') {
  const plan = await openCog.createPlan(goal, context)
  await openCog.executePlan(plan.id)
}
```

## Configuration

The OpenCog extension can be configured through Jan's settings:

### Available Settings

1. **Enable OpenCog Orchestration** (boolean, default: true)
   - Toggle autonomous orchestration capabilities

2. **Maximum Tasks Per Plan** (number, default: 20, range: 1-50)
   - Limit the number of tasks generated in a single plan

3. **Reasoning Model** (string, default: "default")
   - Specify which model to use for cognitive reasoning

4. **Auto-Execute Plans** (boolean, default: false)
   - Automatically execute plans immediately after creation

### Accessing Settings

Settings are stored in localStorage under the extension name and can be accessed through Jan's settings UI or programmatically:

```typescript
const enabled = await openCog.getSetting('enabled', true)
await openCog.updateSettings([
  {
    key: 'max_tasks_per_plan',
    controllerProps: { value: 30 }
  }
])
```

## Implementation Details

### Goal Decomposition Algorithm

The extension uses heuristic analysis to decompose goals:

1. **Requirement Analysis**: Always starts with analyzing the goal
2. **Pattern Matching**: Identifies keywords to determine task types:
   - Research/Learn → Information gathering task
   - Write/Create/Generate → Content creation task
   - Review/Edit/Refine → Quality improvement task
3. **Validation**: Always ends with validation and completion task
4. **Constraint Application**: Respects the max_tasks_per_plan setting

### Task Execution

Tasks are executed sequentially with the following workflow:

1. Mark task as 'running'
2. Execute task logic (using available tools and models)
3. Capture results or errors
4. Update task status ('completed' or 'failed')
5. Proceed to next task or finish plan

### State Management

- Plans are stored in-memory in a Map structure
- Each plan has a unique ID generated with timestamp and random string
- Executing plans are tracked in a Set for cancellation support
- Task states follow the lifecycle: pending → running → completed/failed

## Testing

The extension includes comprehensive test coverage:

```bash
# Run OpenCog extension tests
cd core
yarn test opencog.test.ts
```

Tests cover:
- Extension type verification
- Plan creation
- Plan execution
- Plan retrieval
- Plan listing
- Plan cancellation
- Tool calls

## Future Enhancements

Planned improvements for the OpenCog integration:

1. **Full Atomspace Integration**: Implement proper graph-based knowledge representation
2. **Advanced PLN Reasoning**: Probabilistic logic for better decision-making
3. **Learning from History**: Improve planning based on past executions
4. **External Tool Integration**: Connect with more Jan tools and external APIs
5. **Multi-Agent Coordination**: Support for parallel task execution with multiple agents
6. **Dynamic Replanning**: Adapt plans based on execution results
7. **Persistent Storage**: Save plans to disk for long-running orchestrations
8. **Visualization**: UI components for plan visualization and monitoring

## Troubleshooting

### Plans Not Executing

If plans are created but don't execute:
1. Check that orchestration is enabled in settings
2. Verify the plan status with `get_orchestration_plan`
3. Look for error messages in the browser console

### Too Many Tasks Generated

If plans have too many tasks:
1. Adjust "Maximum Tasks Per Plan" in settings
2. Make goals more specific and focused
3. Break complex goals into smaller sub-goals

### Tasks Failing

If tasks are failing during execution:
1. Check task error messages for details
2. Ensure required models and tools are available
3. Review the goal clarity and specificity

## Contributing

Contributions to improve the OpenCog integration are welcome:

1. Enhanced goal decomposition algorithms
2. Better reasoning capabilities
3. Integration with external OpenCog libraries
4. Performance optimizations
5. Additional orchestration tools

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## References

- [OpenCog Project](https://opencog.org/)
- [OpenCog Atomspace](https://github.com/opencog/atomspace)
- [Probabilistic Logic Networks](https://wiki.opencog.org/w/PLN)
- [Jan Documentation](https://jan.ai/docs)

## License

The OpenCog extension follows Jan's AGPL-3.0 license. See [LICENSE](../LICENSE) for details.
