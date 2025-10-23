# OpenCog Orchestration - Quick Start Guide

## What is OpenCog in Jan?

OpenCog is an autonomous orchestration engine that enables Jan to:
- 🎯 Break down complex goals into executable tasks
- 🤖 Execute multi-step workflows autonomously  
- 🧠 Reason about goals and task requirements
- 📊 Manage and monitor orchestration plans

## Installation

OpenCog orchestration is built into Jan. No additional installation needed!

## Quick Examples

### Example 1: Create and Execute a Plan

```typescript
// Get the OpenCog extension
const openCog = window.core.extensionManager.get(ExtensionTypeEnum.OpenCog)

// Create a plan
const plan = await openCog.createPlan(
  "Research quantum computing trends and write a summary",
  { threadId: "my-thread" }
)

console.log(`Created plan with ${plan.tasks.length} tasks`)

// Execute the plan
await openCog.executePlan(plan.id)

// Check results
const result = await openCog.getPlan(plan.id)
console.log(`Status: ${result.status}`)
```

### Example 2: Use MCP Tools in Conversations

When chatting with Jan, you can use orchestration tools directly:

**User:** "Create a plan to organize my project files and generate documentation"

**Jan:** *Uses `create_orchestration_plan` tool internally*
```
I've created a plan with 5 tasks:
1. Analyze Requirements ○
2. Research and Gather Information ○
3. Draft Content ○
4. Review and Refine ○
5. Validate and Complete ○

Starting execution...
```

### Example 3: Analyze Before Planning

```typescript
// Check if a goal is feasible
const analysis = await openCog.callTool('analyze_goal', {
  goal: "Build a machine learning model for image recognition"
})

console.log('Complexity:', analysis.complexity)
console.log('Feasibility:', analysis.feasibility)
console.log('Estimated tasks:', analysis.estimated_tasks)
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `create_orchestration_plan` | Create a plan from a goal |
| `execute_orchestration_plan` | Execute a plan autonomously |
| `get_orchestration_plan` | Check plan status |
| `list_orchestration_plans` | List all plans |
| `cancel_orchestration_plan` | Stop a running plan |
| `analyze_goal` | Analyze goal complexity |
| `reason_about_task` | Reason about task requirements |

## Configuration

Access settings in Jan's settings UI:

- ✅ **Enable OpenCog Orchestration** - Turn on/off
- 🔢 **Maximum Tasks Per Plan** - Limit task count (1-50)
- 🤖 **Reasoning Model** - Model for cognitive reasoning
- ⚡ **Auto-Execute Plans** - Execute immediately after creation

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Jan Application                │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │  Extension Manager  │
        └──────────┬──────────┘
                   │
        ┌──────────┴───────────┐
        │ OpenCog Extension    │
        │                      │
        │ • Goal Decomposition │
        │ • Task Execution     │
        │ • Plan Management    │
        │ • Cognitive Reasoning│
        └──────────┬───────────┘
                   │
        ┌──────────┴───────────┐
        │  Orchestration Plan  │
        │                      │
        │  ┌─────────────┐    │
        │  │   Task 1    │    │
        │  ├─────────────┤    │
        │  │   Task 2    │    │
        │  ├─────────────┤    │
        │  │   Task 3    │    │
        │  └─────────────┘    │
        └──────────────────────┘
```

## Key Concepts

### Orchestration Plan
A plan is a structured workflow with:
- Unique ID
- Goal description
- List of tasks
- Execution status
- Timestamps

### Orchestration Task
Each task has:
- Name and description
- Status (pending/running/completed/failed)
- Optional result data
- Error information if failed

### Goal Decomposition
Goals are automatically broken down based on keywords:
- "research" → Information gathering tasks
- "write/create" → Content creation tasks
- "review/edit" → Quality improvement tasks

## Best Practices

1. **Be Specific** - Clear goals get better task decomposition
   - ✅ "Research AI ethics and write a 500-word summary"
   - ❌ "Do something with AI"

2. **Manage Scope** - Break very large goals into smaller ones
   - ✅ Multiple focused plans
   - ❌ One huge plan with 50 tasks

3. **Monitor Progress** - Check status regularly for long-running plans
   ```typescript
   const status = await openCog.getPlan(planId)
   console.log(`Progress: ${status.tasks.filter(t => t.status === 'completed').length}/${status.tasks.length}`)
   ```

4. **Handle Errors** - Always check for failures
   ```typescript
   const plan = await openCog.executePlan(planId)
   const failed = plan.tasks.filter(t => t.status === 'failed')
   if (failed.length > 0) {
     console.log('Some tasks failed:', failed.map(t => t.name))
   }
   ```

## Common Patterns

### Sequential Workflow
```typescript
const plan = await openCog.createPlan("Research → Analyze → Report", {})
await openCog.executePlan(plan.id)
```

### Monitor and React
```typescript
const plan = await openCog.createPlan("Long task", {})
openCog.executePlan(plan.id) // Don't await

// Check periodically
setInterval(async () => {
  const status = await openCog.getPlan(plan.id)
  console.log(status.status)
}, 5000)
```

### Batch Processing
```typescript
const goals = ["Task A", "Task B", "Task C"]
const plans = await Promise.all(
  goals.map(g => openCog.createPlan(g, {}))
)
plans.forEach(p => openCog.executePlan(p.id))
```

## Troubleshooting

### "Plan not executing"
Check if orchestration is enabled:
```typescript
const enabled = await openCog.getSetting('enabled', true)
if (!enabled) {
  await openCog.updateSettings([
    { key: 'enabled', controllerProps: { value: true } }
  ])
}
```

### "Too many tasks generated"
Reduce max tasks or make goal more specific:
```typescript
await openCog.updateSettings([
  { key: 'max_tasks_per_plan', controllerProps: { value: 10 } }
])
```

### "Tasks failing"
Check error messages:
```typescript
const plan = await openCog.getPlan(planId)
plan.tasks.forEach(task => {
  if (task.status === 'failed') {
    console.log(`${task.name} failed: ${task.error}`)
  }
})
```

## Learn More

- 📖 [Full Documentation](docs/opencog-integration.md)
- 💡 [Detailed Examples](extensions/opencog-extension/EXAMPLES.md)
- 📚 [Extension README](extensions/opencog-extension/README.md)
- 🔧 [Implementation Summary](IMPLEMENTATION_SUMMARY.md)

## Support

- 💬 [Discord Community](https://discord.gg/FTk2MvZwJH)
- 🐛 [Report Issues](https://github.com/cogpy/jancog/issues)
- 📧 Contact: hello@jan.ai

---

**Start orchestrating with OpenCog today! 🚀**
