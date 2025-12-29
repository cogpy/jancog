# OpenCog Orchestration Extension (v3.0)

Autonomous orchestration engine for Jan, inspired by the OpenCog cognitive AI framework.

## Overview

This extension brings autonomous task orchestration and cognitive reasoning capabilities to Jan. It enables the AI to:

- **Decompose complex goals** into executable tasks
- **Plan and orchestrate** multi-step workflows autonomously
- **Reason cognitively** about tasks, dependencies, and execution strategies
- **Execute plans** with adaptive behavior based on intermediate results
- **Store and query knowledge** using a graph-based representation (v3.0)
- **Perform probabilistic inference** using PLN (v3.0)
- **Integrate with Jan's tools** for RAG, file ops, web search (v3.0)

## Features

### v2.0 Core Features

#### 🎯 Goal Decomposition
Break down high-level goals into structured, executable task plans using cognitive reasoning.

#### 🤖 Autonomous Orchestration
Self-directed execution of complex workflows with minimal human intervention.

#### 🧠 Cognitive Reasoning
Analyze goals and tasks to determine optimal execution strategies, dependencies, and resource requirements.

#### 📊 Plan Management
Create, execute, monitor, and cancel orchestration plans with full visibility into execution status.

#### 🔄 Dynamic Replanning
Automatically adjust plans based on execution results and intermediate feedback.

#### 👥 Multi-Agent Coordination
Parallel task execution using specialized agents (coordinator, researcher, analyst, creator, validator).

#### 💾 Persistence & Learning
Store execution history and learn from past plans to improve future orchestration.

### v3.0 New Features

#### 🕸️ Atomspace Knowledge Graph
Store and query knowledge using OpenCog's graph-based representation:
- **Nodes**: ConceptNode, GoalNode, TaskNode, PlanNode, ToolNode
- **Links**: InheritanceLink, SimilarityLink, DependsOnLink, ContextLink
- **Truth Values**: Strength and confidence for uncertain knowledge
- **Attention Values**: Importance and relevance scores

#### 🧮 PLN (Probabilistic Logic Networks)
Perform probabilistic inference:
- **Forward chaining**: Derive new facts from existing knowledge
- **Backward chaining**: Prove goals by finding supporting evidence
- **Task success prediction**: Infer likelihood of task success
- **Inference rules**: Deduction, Modus Ponens, Similarity, Analogy

#### 🔧 Tool Integration
Connect orchestration to Jan's ecosystem of tools:
- `rag_retrieve`: Document retrieval using RAG
- `file_read` / `file_write`: File operations
- `web_search`: Search the web
- `llm_inference`: Query LLMs for reasoning
- `code_analysis`: Analyze code patterns
- `data_transform`: Convert between formats
- `summarize`: Generate summaries

## Tools

### v2.0 Orchestration Tools

#### `create_orchestration_plan`
Create a plan to achieve a high-level goal.

```json
{
  "goal": "Research and write a comprehensive report on renewable energy trends",
  "context": {
    "threadId": "thread_123",
    "availableTools": ["search", "write", "analyze"]
  }
}
```

#### `execute_orchestration_plan`
Execute a previously created plan.

#### `get_orchestration_plan`
Get the current status and details of a plan.

#### `list_orchestration_plans`
List all orchestration plans, optionally filtered by status.

#### `cancel_orchestration_plan`
Cancel a running orchestration plan.

#### `analyze_goal`
Analyze a goal to understand its complexity, feasibility, and resource requirements.

#### `reason_about_task`
Apply cognitive reasoning to understand task requirements and optimal execution strategies.

### v3.0 Knowledge Tools

#### `query_knowledge`
Query the Atomspace knowledge graph.

```json
{
  "type": "GoalNode",
  "min_confidence": 0.5,
  "limit": 10,
  "find_similar": true,
  "goal": "learn machine learning"
}
```

#### `infer_knowledge`
Use PLN for probabilistic inference.

```json
{
  "mode": "forward",
  "max_iterations": 10,
  "min_confidence": 0.3
}
```

```json
{
  "mode": "task_success",
  "task_description": "research artificial intelligence"
}
```

#### `execute_tool`
Execute an integrated tool.

```json
{
  "tool_name": "web_search",
  "args": {
    "query": "latest AI developments",
    "maxResults": 5
  }
}
```

#### `get_knowledge_stats`
Get statistics about Atomspace, PLN, and tool usage.

## Configuration

### v2.0 Settings

- **Enable OpenCog Orchestration**: Toggle autonomous orchestration
- **Maximum Tasks Per Plan**: Limit tasks per plan (1-50)
- **Reasoning Model**: Model for cognitive reasoning
- **Auto-Execute Plans**: Automatically execute plans after creation
- **Enable Persistence**: Persist plans and execution history
- **Enable Multi-Agent**: Use multiple specialized agents
- **Enable Dynamic Replanning**: Adjust plans based on results
- **Maximum Parallel Tasks**: Tasks to execute in parallel (1-10)

### v3.0 Settings

- **Enable Atomspace**: Use graph-based knowledge representation
- **Enable PLN**: Use Probabilistic Logic Networks for inference
- **Enable Tool Integration**: Connect to Jan's tools
- **PLN Max Iterations**: Maximum inference iterations (1-50)
- **PLN Min Confidence**: Minimum confidence threshold (0.1-1.0)

## Architecture

This extension implements OpenCog's cognitive AI framework:

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCog Extension v3.0                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Atomspace  │  │     PLN     │  │   Tool Integration      │ │
│  │  Knowledge  │◄─│  Inference  │◄─│   (RAG, Files, Web)     │ │
│  │    Graph    │  │   Engine    │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         ▲               ▲                     ▲                 │
│         └───────────────┴─────────────────────┘                 │
│                         │                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Cognitive Reasoning Engine                      ││
│  │  (Goal Analysis, Task Decomposition, Strategy Selection)     ││
│  └─────────────────────────────────────────────────────────────┘│
│                         │                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Task Executor                               ││
│  │  (Multi-Agent Coordination, Dynamic Replanning)              ││
│  └─────────────────────────────────────────────────────────────┘│
│                         │                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Persistence Layer                           ││
│  │  (Plans, Execution History, Learning)                        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Usage Example

```typescript
// Create a plan with knowledge-driven recommendations
const plan = await openCogExtension.createPlan(
  "Research machine learning and write a summary report",
  { threadId: "current_thread" }
)

// Query the knowledge graph for similar past goals
const similar = await openCogExtension.callTool('query_knowledge', {
  find_similar: true,
  goal: "research machine learning"
})

// Use PLN to predict task success
const prediction = await openCogExtension.callTool('infer_knowledge', {
  mode: 'task_success',
  task_description: 'research machine learning'
})

// Execute the plan with tool integration
const result = await openCogExtension.executePlan(plan.id)

// Get knowledge system statistics
const stats = await openCogExtension.callTool('get_knowledge_stats', {})
```

## Code Statistics

- **Total Lines of Code**: ~4,500+
- **Test Coverage**: 129 test files, 1404 tests
- **Modules**: 8 (index, tools, atomspace, pln, tool-integration, task-executor, multi-agent, persistence, cognitive-reasoning)
- **MCP Tools**: 11 tools exposed

## Version History

### v3.0 (Current)
- Full Atomspace knowledge graph implementation
- PLN inference engine with multiple rules
- Tool integration (RAG, file ops, web search, LLM, code analysis)
- Knowledge-driven planning recommendations
- Task success prediction

### v2.0
- Real task execution with strategy-based processing
- Persistence layer for plans and execution history
- Dynamic replanning based on results
- Multi-agent coordination
- Learning from execution history

### v1.0
- Initial implementation with goal decomposition
- Basic plan creation and execution
- Cognitive reasoning tools

## License

AGPL-3.0
