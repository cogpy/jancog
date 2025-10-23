# OpenCog Orchestration Examples

This document provides practical examples of using the OpenCog orchestration extension in Jan.

## Basic Usage

### Example 1: Simple Research Task

```typescript
import { ExtensionTypeEnum } from '@janhq/core'

// Get the OpenCog extension
const openCog = window.core.extensionManager.get(ExtensionTypeEnum.OpenCog)

// Create a plan for a research task
const researchPlan = await openCog.createPlan(
  "Research the latest developments in quantum computing",
  {
    threadId: "current_thread_id",
    availableTools: ["search", "summarize"],
    modelId: "llama-3-70b"
  }
)

console.log('Plan created:', researchPlan.id)
console.log('Tasks to complete:', researchPlan.tasks.length)

// Execute the plan
const result = await openCog.executePlan(researchPlan.id)

console.log('Execution complete. Status:', result.status)
result.tasks.forEach(task => {
  console.log(`- ${task.name}: ${task.status}`)
})
```

### Example 2: Content Creation Workflow

```typescript
// Create a plan for content creation
const contentPlan = await openCog.createPlan(
  "Write a blog post about sustainable technology and include relevant examples",
  {
    threadId: "blog_thread",
    availableTools: ["research", "write", "edit"],
  }
)

// The plan will automatically decompose into tasks:
// 1. Analyze Requirements
// 2. Research and Gather Information
// 3. Draft Content
// 4. Review and Refine
// 5. Validate and Complete

// Execute and monitor
await openCog.executePlan(contentPlan.id)

// Get final result
const finalPlan = await openCog.getPlan(contentPlan.id)
if (finalPlan.status === 'completed') {
  console.log('Blog post workflow completed successfully!')
}
```

### Example 3: Goal Analysis

```typescript
// Analyze a goal before creating a plan
const analysis = await openCog.callTool('analyze_goal', {
  goal: "Build a complete e-commerce website with payment integration"
})

console.log('Goal Analysis:')
console.log('- Complexity:', analysis.complexity)
console.log('- Estimated tasks:', analysis.estimated_tasks)
console.log('- Feasibility:', analysis.feasibility)
console.log('- Required resources:', analysis.required_resources)

// Proceed based on analysis
if (analysis.complexity === 'high') {
  console.log('This is a complex goal. Consider breaking it into smaller sub-goals.')
} else {
  // Create and execute plan
  const plan = await openCog.createPlan(goal, context)
  await openCog.executePlan(plan.id)
}
```

### Example 4: Monitoring Long-Running Plans

```typescript
// Create a plan that might take time
const complexPlan = await openCog.createPlan(
  "Analyze 100 research papers and create a comprehensive summary",
  { threadId: "research_project" }
)

// Execute asynchronously
openCog.executePlan(complexPlan.id)

// Monitor progress
const monitorInterval = setInterval(async () => {
  const status = await openCog.getPlan(complexPlan.id)
  
  console.log(`\nPlan Status: ${status.status}`)
  console.log('Task Progress:')
  
  status.tasks.forEach((task, index) => {
    const statusIcon = 
      task.status === 'completed' ? '✓' :
      task.status === 'running' ? '⟳' :
      task.status === 'failed' ? '✗' : '○'
    
    console.log(`  ${statusIcon} ${index + 1}. ${task.name}`)
  })
  
  // Stop monitoring when done
  if (status.status === 'completed' || status.status === 'failed') {
    clearInterval(monitorInterval)
    console.log('\nExecution finished!')
    
    if (status.status === 'completed') {
      console.log('All tasks completed successfully')
    } else {
      console.log('Some tasks failed. Check task details for errors.')
    }
  }
}, 2000) // Check every 2 seconds
```

### Example 5: Plan Cancellation

```typescript
// Create and start a plan
const plan = await openCog.createPlan(
  "Download and process a large dataset",
  {}
)

// Start execution
openCog.executePlan(plan.id)

// Simulate user cancellation after 5 seconds
setTimeout(async () => {
  console.log('User requested cancellation...')
  const cancelled = await openCog.cancelPlan(plan.id)
  
  if (cancelled) {
    console.log('Plan cancelled successfully')
    
    // Check final state
    const finalState = await openCog.getPlan(plan.id)
    console.log('Final status:', finalState.status)
    console.log('Completed tasks:', 
      finalState.tasks.filter(t => t.status === 'completed').length
    )
  } else {
    console.log('Plan could not be cancelled (may not be running)')
  }
}, 5000)
```

### Example 6: List and Filter Plans

```typescript
// List all plans
const allPlans = await openCog.listPlans()
console.log(`Total plans: ${allPlans.length}`)

// Filter by status using the tool
const activePlans = await openCog.callTool('list_orchestration_plans', {
  status: 'executing'
})

const completedPlans = await openCog.callTool('list_orchestration_plans', {
  status: 'completed'
})

console.log('Active plans:', activePlans.content[0].text)
console.log('Completed plans:', completedPlans.content[0].text)

// Find plans by goal keyword
const searchKeyword = 'research'
const matchingPlans = allPlans.filter(plan => 
  plan.goal.toLowerCase().includes(searchKeyword)
)

console.log(`Plans containing "${searchKeyword}":`)
matchingPlans.forEach(plan => {
  console.log(`- ${plan.goal} (${plan.status})`)
})
```

### Example 7: Task-Level Reasoning

```typescript
// Reason about a specific task before execution
const taskReasoning = await openCog.callTool('reason_about_task', {
  task_description: "Implement user authentication with OAuth2",
  context: {
    available_libraries: ["passport", "oauth"],
    experience_level: "intermediate"
  }
})

console.log('Task Reasoning:')
console.log(taskReasoning.content[0].text)

// Use reasoning to inform plan creation
if (taskReasoning.confidence > 0.7) {
  // Proceed with confidence
  const plan = await openCog.createPlan(
    "Add OAuth2 authentication to the application",
    {}
  )
  await openCog.executePlan(plan.id)
} else {
  console.log('Task requires more information or expertise')
}
```

### Example 8: Batch Plan Creation

```typescript
// Create multiple plans for different goals
const goals = [
  "Summarize this week's team meeting notes",
  "Review and categorize support tickets",
  "Generate monthly performance report"
]

const plans = await Promise.all(
  goals.map(goal => 
    openCog.createPlan(goal, { threadId: "automation_thread" })
  )
)

console.log(`Created ${plans.length} plans`)

// Execute all plans
plans.forEach(plan => {
  openCog.executePlan(plan.id)
  console.log(`Started execution of: ${plan.goal}`)
})

// Wait for all to complete
const checkAllComplete = setInterval(async () => {
  const statuses = await Promise.all(
    plans.map(p => openCog.getPlan(p.id))
  )
  
  const allDone = statuses.every(
    s => s.status === 'completed' || s.status === 'failed'
  )
  
  if (allDone) {
    clearInterval(checkAllComplete)
    console.log('All batch plans completed!')
    
    statuses.forEach((status, i) => {
      console.log(`${i + 1}. ${status.goal}: ${status.status}`)
    })
  }
}, 3000)
```

### Example 9: Error Handling

```typescript
try {
  // Create plan
  const plan = await openCog.createPlan(
    "Process data and generate insights",
    { threadId: "analysis_thread" }
  )
  
  // Execute plan
  const result = await openCog.executePlan(plan.id)
  
  // Check for task failures
  const failedTasks = result.tasks.filter(t => t.status === 'failed')
  
  if (failedTasks.length > 0) {
    console.log('Some tasks failed:')
    failedTasks.forEach(task => {
      console.log(`- ${task.name}: ${task.error}`)
    })
    
    // Optionally retry failed tasks or create a new plan
    console.log('Creating recovery plan...')
    const recoveryPlan = await openCog.createPlan(
      `Retry: ${plan.goal}`,
      { threadId: "recovery_thread" }
    )
    await openCog.executePlan(recoveryPlan.id)
  }
  
} catch (error) {
  console.error('Plan execution failed:', error.message)
  
  // Handle specific errors
  if (error.message.includes('not found')) {
    console.log('Plan does not exist')
  } else if (error.message.includes('already executing')) {
    console.log('Plan is already running')
  } else {
    console.log('Unexpected error:', error)
  }
}
```

### Example 10: Integration with Jan Assistant

```typescript
// In a Jan assistant's message handler
async function handleUserMessage(message: string) {
  // Detect orchestration intent
  const orchestrationKeywords = [
    'create plan', 'orchestrate', 'break down', 'help me with'
  ]
  
  const needsOrchestration = orchestrationKeywords.some(
    keyword => message.toLowerCase().includes(keyword)
  )
  
  if (needsOrchestration) {
    // Extract goal from message
    const goal = message
      .replace(/create plan (for|to)?/i, '')
      .replace(/orchestrate/i, '')
      .trim()
    
    console.log(`Creating orchestration plan for: ${goal}`)
    
    const openCog = window.core.extensionManager.get(
      ExtensionTypeEnum.OpenCog
    )
    
    // Create and execute plan
    const plan = await openCog.createPlan(goal, {
      threadId: currentThreadId,
      modelId: currentModelId
    })
    
    // Send status update to user
    sendMessage({
      text: `I've created a plan with ${plan.tasks.length} tasks. Starting execution...`,
      role: 'assistant'
    })
    
    // Execute and report results
    const result = await openCog.executePlan(plan.id)
    
    const summary = result.tasks.map((task, i) => 
      `${i + 1}. ${task.name}: ${task.status === 'completed' ? '✓' : '✗'}`
    ).join('\n')
    
    sendMessage({
      text: `Plan completed!\n\nTasks:\n${summary}`,
      role: 'assistant'
    })
  } else {
    // Handle regular message
    handleRegularMessage(message)
  }
}
```

## Configuration Examples

### Adjust Settings Programmatically

```typescript
const openCog = window.core.extensionManager.get(ExtensionTypeEnum.OpenCog)

// Increase max tasks for complex goals
await openCog.updateSettings([
  {
    key: 'max_tasks_per_plan',
    controllerProps: { value: 30 }
  }
])

// Enable auto-execution
await openCog.updateSettings([
  {
    key: 'auto_execute',
    controllerProps: { value: true }
  }
])

// Now plans will execute automatically after creation
const autoPlan = await openCog.createPlan(
  "Generate weekly report",
  {}
)
// No need to call executePlan - it runs automatically!
```

## Best Practices

1. **Clear Goals**: Provide specific, clear goals for better task decomposition
   - Good: "Research renewable energy trends and create a 500-word summary"
   - Avoid: "Do something with energy"

2. **Reasonable Scope**: Keep goals focused and achievable
   - Break very large goals into smaller sub-goals
   - Use the analyze_goal tool to assess complexity

3. **Error Handling**: Always check plan and task status
   - Handle failed tasks gracefully
   - Implement retry logic for transient failures

4. **Resource Management**: Monitor long-running plans
   - Cancel plans that are no longer needed
   - Clean up completed plans periodically

5. **Testing**: Test orchestration logic with simple goals first
   - Verify task decomposition is sensible
   - Ensure execution completes as expected

## Troubleshooting

### Plan Not Starting
```typescript
// Check if orchestration is enabled
const enabled = await openCog.getSetting('enabled', true)
if (!enabled) {
  console.log('OpenCog orchestration is disabled')
  await openCog.updateSettings([
    { key: 'enabled', controllerProps: { value: true } }
  ])
}
```

### Tasks Failing Silently
```typescript
// Get detailed task information
const plan = await openCog.getPlan(planId)
plan.tasks.forEach(task => {
  if (task.status === 'failed') {
    console.log(`Task "${task.name}" failed:`)
    console.log('Error:', task.error)
    console.log('Description:', task.description)
  }
})
```

### Too Many Tasks Generated
```typescript
// Reduce max tasks
await openCog.updateSettings([
  {
    key: 'max_tasks_per_plan',
    controllerProps: { value: 10 }
  }
])

// Or make goal more specific
const specificGoal = "Write a 3-paragraph introduction about AI ethics"
// Instead of: "Write about AI"
```

## Next Steps

- Explore the [OpenCog Integration Documentation](../docs/opencog-integration.md)
- Review the [Extension API Reference](../extensions/opencog-extension/README.md)
- Contribute improvements via [GitHub Issues](https://github.com/cogpy/jancog/issues)
