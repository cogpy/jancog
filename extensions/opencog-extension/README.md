# OpenCog Orchestration Extension

Autonomous orchestration engine for Jan, inspired by the OpenCog cognitive AI framework.

## Overview

This extension brings autonomous task orchestration and cognitive reasoning capabilities to Jan. It enables the AI to:

- **Decompose complex goals** into executable tasks
- **Plan and orchestrate** multi-step workflows autonomously
- **Reason cognitively** about tasks, dependencies, and execution strategies
- **Execute plans** with adaptive behavior based on intermediate results

## Features

### 🎯 Goal Decomposition
Break down high-level goals into structured, executable task plans using cognitive reasoning.

### 🤖 Autonomous Orchestration
Self-directed execution of complex workflows with minimal human intervention.

### 🧠 Cognitive Reasoning
Analyze goals and tasks to determine optimal execution strategies, dependencies, and resource requirements.

### 📊 Plan Management
Create, execute, monitor, and cancel orchestration plans with full visibility into execution status.

## Tools

The extension provides the following tools for autonomous orchestration:

### `create_orchestration_plan`
Create a plan to achieve a high-level goal. The system analyzes the goal and generates executable tasks.

**Example:**
```json
{
  "goal": "Research and write a comprehensive report on renewable energy trends",
  "context": {
    "threadId": "thread_123",
    "availableTools": ["search", "write", "analyze"]
  }
}
```

### `execute_orchestration_plan`
Execute a previously created plan. Tasks are executed sequentially with adaptive planning.

**Example:**
```json
{
  "plan_id": "plan_1234567890_abc123"
}
```

### `get_orchestration_plan`
Get the current status and details of a plan.

### `list_orchestration_plans`
List all orchestration plans, optionally filtered by status.

### `cancel_orchestration_plan`
Cancel a running orchestration plan.

### `analyze_goal`
Analyze a goal to understand its complexity, feasibility, and resource requirements.

### `reason_about_task`
Apply cognitive reasoning to understand task requirements and optimal execution strategies.

## Configuration

### Settings

- **Enable OpenCog Orchestration**: Toggle autonomous orchestration capabilities
- **Maximum Tasks Per Plan**: Limit the number of tasks in a single plan (1-50)
- **Reasoning Model**: Specify which model to use for cognitive reasoning
- **Auto-Execute Plans**: Automatically execute plans after creation

## Architecture

This extension is inspired by the OpenCog cognitive AI framework, which uses:

- **Atomspace**: Graph-based knowledge representation
- **PLN (Probabilistic Logic Networks)**: Reasoning under uncertainty
- **Goal-oriented planning**: Hierarchical task decomposition

While this implementation provides a simplified version suitable for Jan's architecture, it maintains the core principles of autonomous orchestration and cognitive reasoning.

## Usage Example

```typescript
// Create a plan
const plan = await openCogExtension.createPlan(
  "Organize my project files and create a summary document",
  { threadId: "current_thread" }
)

// Execute the plan
const result = await openCogExtension.executePlan(plan.id)

// Check status
const status = await openCogExtension.getPlan(plan.id)
console.log(status.status) // 'completed', 'executing', 'failed'
```

## Future Enhancements

- Full Atomspace integration for knowledge representation
- Advanced PLN-based reasoning
- Learning from execution history
- Integration with external tools and APIs
- Multi-agent coordination
- Dynamic replanning based on execution results

## License

AGPL-3.0
