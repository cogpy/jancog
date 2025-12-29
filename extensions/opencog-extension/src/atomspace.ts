/**
 * Atomspace - OpenCog's Knowledge Graph Implementation
 *
 * The Atomspace is a graph-based knowledge representation system that stores
 * knowledge as atoms (nodes and links). This implementation provides:
 *
 * - Atoms: Basic units of knowledge (ConceptNode, PredicateNode, etc.)
 * - Links: Relationships between atoms (InheritanceLink, EvaluationLink, etc.)
 * - Truth Values: Probabilistic confidence and strength for uncertain knowledge
 * - Attention Values: Importance and relevance scores for attention allocation
 * - Pattern Matching: Query the knowledge graph for patterns
 * - Persistence: Save/load the knowledge graph
 */

import type { OrchestrationPlan, OrchestrationTask } from '@janhq/core'

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Truth Value - Represents uncertainty in knowledge
 * Uses OpenCog's Simple Truth Value (STV) model
 */
export interface TruthValue {
  /** Strength: probability that the atom is true (0.0 to 1.0) */
  strength: number
  /** Confidence: how certain we are about the strength (0.0 to 1.0) */
  confidence: number
  /** Count: number of observations (for learning) */
  count?: number
}

/**
 * Attention Value - Represents importance for attention allocation
 */
export interface AttentionValue {
  /** Short-term importance (STI) */
  sti: number
  /** Long-term importance (LTI) */
  lti: number
  /** Very long-term importance (VLTI) - rarely changes */
  vlti?: number
}

/**
 * Atom Types - Hierarchical type system for atoms
 */
export type AtomType =
  // Node types
  | 'ConceptNode'
  | 'PredicateNode'
  | 'VariableNode'
  | 'NumberNode'
  | 'TypeNode'
  | 'SchemaNode'
  | 'GroundedSchemaNode'
  | 'ExecutionOutputNode'
  // Task-specific nodes
  | 'GoalNode'
  | 'TaskNode'
  | 'PlanNode'
  | 'ToolNode'
  | 'ResultNode'
  | 'ErrorNode'
  // Link types
  | 'InheritanceLink'
  | 'SimilarityLink'
  | 'EvaluationLink'
  | 'ListLink'
  | 'SetLink'
  | 'AndLink'
  | 'OrLink'
  | 'NotLink'
  | 'ImplicationLink'
  | 'EquivalenceLink'
  | 'MemberLink'
  | 'ContextLink'
  | 'DefineLink'
  | 'ExecutionLink'
  | 'StateLink'
  // Task-specific links
  | 'DependsOnLink'
  | 'RequiresToolLink'
  | 'ProducesLink'
  | 'SolvedByLink'

/**
 * Base Atom interface - Common properties for all atoms
 */
export interface Atom {
  /** Unique identifier */
  id: string
  /** Atom type */
  type: AtomType
  /** Truth value (optional) */
  tv?: TruthValue
  /** Attention value (optional) */
  av?: AttentionValue
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
  /** Metadata */
  meta?: Record<string, unknown>
}

/**
 * Node - Atomic unit representing a concept or entity
 */
export interface Node extends Atom {
  /** Name of the node */
  name: string
}

/**
 * Link - Connects multiple atoms (nodes or other links)
 */
export interface Link extends Atom {
  /** Outgoing set - atoms this link connects */
  outgoing: string[]
  /** Optional name for named links */
  name?: string
}

/**
 * Pattern for querying the Atomspace
 */
export interface AtomPattern {
  type?: AtomType | AtomType[]
  name?: string | RegExp
  tvStrengthMin?: number
  tvStrengthMax?: number
  tvConfidenceMin?: number
  stiMin?: number
  hasOutgoing?: string[]
  limit?: number
}

/**
 * Query result with optional bindings for variables
 */
export interface QueryResult {
  atoms: Atom[]
  bindings?: Map<string, Atom>[]
  executionTime: number
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_TRUTH_VALUE: TruthValue = {
  strength: 1.0,
  confidence: 0.9,
  count: 1,
}

export const DEFAULT_ATTENTION_VALUE: AttentionValue = {
  sti: 0,
  lti: 0,
  vlti: 0,
}

// =============================================================================
// Atomspace Class
// =============================================================================

/**
 * Atomspace - The knowledge graph container
 */
export class Atomspace {
  private atoms: Map<string, Atom> = new Map()
  private nameIndex: Map<string, Set<string>> = new Map()
  private typeIndex: Map<AtomType, Set<string>> = new Map()
  private incomingIndex: Map<string, Set<string>> = new Map()

  // Stats
  private stats = {
    nodesCreated: 0,
    linksCreated: 0,
    queries: 0,
    lastQueryTime: 0,
  }

  constructor() {
    // Initialize with basic type hierarchy
    this.initializeTypeHierarchy()
  }

  // ---------------------------------------------------------------------------
  // Node Operations
  // ---------------------------------------------------------------------------

  /**
   * Add or get a node in the Atomspace
   */
  addNode(type: AtomType, name: string, tv?: TruthValue, av?: AttentionValue): Node {
    // Check if node already exists
    const existing = this.getNodeByName(type, name)
    if (existing) {
      // Update truth value if provided
      if (tv) {
        existing.tv = this.mergeTruthValues(existing.tv, tv)
        existing.updatedAt = Date.now()
      }
      if (av) {
        existing.av = this.mergeAttentionValues(existing.av, av)
        existing.updatedAt = Date.now()
      }
      return existing
    }

    const id = this.generateId('node')
    const node: Node = {
      id,
      type,
      name,
      tv: tv || { ...DEFAULT_TRUTH_VALUE },
      av: av || { ...DEFAULT_ATTENTION_VALUE },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.atoms.set(id, node)
    this.indexNode(node)
    this.stats.nodesCreated++

    return node
  }

  /**
   * Get a node by type and name
   */
  getNodeByName(type: AtomType, name: string): Node | null {
    const nameSet = this.nameIndex.get(name)
    if (!nameSet) return null

    for (const id of nameSet) {
      const atom = this.atoms.get(id)
      if (atom && atom.type === type && 'name' in atom && (atom as Node).name === name) {
        return atom as Node
      }
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Link Operations
  // ---------------------------------------------------------------------------

  /**
   * Add a link connecting atoms
   */
  addLink(type: AtomType, outgoing: string[], tv?: TruthValue, av?: AttentionValue): Link {
    // Validate outgoing atoms exist
    for (const atomId of outgoing) {
      if (!this.atoms.has(atomId)) {
        throw new Error(`Atom ${atomId} not found in Atomspace`)
      }
    }

    // Check for duplicate link
    const existing = this.findLink(type, outgoing)
    if (existing) {
      if (tv) {
        existing.tv = this.mergeTruthValues(existing.tv, tv)
        existing.updatedAt = Date.now()
      }
      return existing
    }

    const id = this.generateId('link')
    const link: Link = {
      id,
      type,
      outgoing,
      tv: tv || { ...DEFAULT_TRUTH_VALUE },
      av: av || { ...DEFAULT_ATTENTION_VALUE },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.atoms.set(id, link)
    this.indexLink(link)
    this.stats.linksCreated++

    return link
  }

  /**
   * Create convenience methods for common link types
   */
  addInheritanceLink(child: string, parent: string, tv?: TruthValue): Link {
    return this.addLink('InheritanceLink', [child, parent], tv)
  }

  addSimilarityLink(atom1: string, atom2: string, tv?: TruthValue): Link {
    return this.addLink('SimilarityLink', [atom1, atom2], tv)
  }

  addEvaluationLink(predicate: string, ...args: string[]): Link {
    const listLink = this.addLink('ListLink', args)
    return this.addLink('EvaluationLink', [predicate, listLink.id])
  }

  addImplicationLink(antecedent: string, consequent: string, tv?: TruthValue): Link {
    return this.addLink('ImplicationLink', [antecedent, consequent], tv)
  }

  addDependencyLink(dependent: string, dependency: string, tv?: TruthValue): Link {
    return this.addLink('DependsOnLink', [dependent, dependency], tv)
  }

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  /**
   * Query atoms by pattern
   */
  query(pattern: AtomPattern): QueryResult {
    const startTime = Date.now()
    this.stats.queries++

    let candidates: Set<string>

    // Start with type index if specified
    if (pattern.type) {
      const types = Array.isArray(pattern.type) ? pattern.type : [pattern.type]
      candidates = new Set()
      for (const type of types) {
        const typeSet = this.typeIndex.get(type)
        if (typeSet) {
          for (const id of typeSet) candidates.add(id)
        }
      }
    } else {
      candidates = new Set(this.atoms.keys())
    }

    // Filter by name if specified
    if (pattern.name && typeof pattern.name === 'string') {
      const nameSet = this.nameIndex.get(pattern.name)
      if (nameSet) {
        candidates = this.intersect(candidates, nameSet)
      } else {
        candidates = new Set()
      }
    }

    // Apply remaining filters
    const results: Atom[] = []
    for (const id of candidates) {
      const atom = this.atoms.get(id)
      if (!atom) continue

      // Name regex filter
      if (pattern.name instanceof RegExp) {
        if (!('name' in atom) || !pattern.name.test((atom as Node).name)) {
          continue
        }
      }

      // Truth value filters
      if (pattern.tvStrengthMin !== undefined && (atom.tv?.strength ?? 0) < pattern.tvStrengthMin) {
        continue
      }
      if (pattern.tvStrengthMax !== undefined && (atom.tv?.strength ?? 1) > pattern.tvStrengthMax) {
        continue
      }
      if (pattern.tvConfidenceMin !== undefined && (atom.tv?.confidence ?? 0) < pattern.tvConfidenceMin) {
        continue
      }

      // Attention value filter
      if (pattern.stiMin !== undefined && (atom.av?.sti ?? 0) < pattern.stiMin) {
        continue
      }

      // Outgoing filter for links
      if (pattern.hasOutgoing) {
        if (!('outgoing' in atom)) continue
        const link = atom as Link
        const hasAll = pattern.hasOutgoing.every(id => link.outgoing.includes(id))
        if (!hasAll) continue
      }

      results.push(atom)

      // Apply limit
      if (pattern.limit && results.length >= pattern.limit) {
        break
      }
    }

    const executionTime = Date.now() - startTime
    this.stats.lastQueryTime = executionTime

    return { atoms: results, executionTime }
  }

  /**
   * Get atoms that link to a specific atom
   */
  getIncoming(atomId: string): Link[] {
    const incomingSet = this.incomingIndex.get(atomId)
    if (!incomingSet) return []

    return Array.from(incomingSet)
      .map(id => this.atoms.get(id))
      .filter((atom): atom is Link => atom !== undefined && 'outgoing' in atom)
  }

  /**
   * Get all atoms connected to a given atom within N hops
   */
  getNeighborhood(atomId: string, maxHops: number = 2): Atom[] {
    const visited = new Set<string>()
    const queue: Array<{ id: string; hops: number }> = [{ id: atomId, hops: 0 }]

    while (queue.length > 0) {
      const { id, hops } = queue.shift()!
      if (visited.has(id) || hops > maxHops) continue
      visited.add(id)

      // Add outgoing for links
      const atom = this.atoms.get(id)
      if (atom && 'outgoing' in atom) {
        for (const outId of (atom as Link).outgoing) {
          if (!visited.has(outId)) {
            queue.push({ id: outId, hops: hops + 1 })
          }
        }
      }

      // Add incoming links
      const incoming = this.incomingIndex.get(id)
      if (incoming) {
        for (const inId of incoming) {
          if (!visited.has(inId)) {
            queue.push({ id: inId, hops: hops + 1 })
          }
        }
      }
    }

    return Array.from(visited)
      .map(id => this.atoms.get(id))
      .filter((atom): atom is Atom => atom !== undefined)
  }

  // ---------------------------------------------------------------------------
  // Plan & Task Knowledge
  // ---------------------------------------------------------------------------

  /**
   * Add a plan to the knowledge graph
   */
  addPlanKnowledge(plan: OrchestrationPlan): void {
    // Create plan node
    const planNode = this.addNode('PlanNode', plan.id, {
      strength: 1.0,
      confidence: plan.status === 'completed' ? 0.95 : 0.5,
    })

    // Create goal node
    const goalNode = this.addNode('GoalNode', plan.goal, {
      strength: 1.0,
      confidence: 0.8,
    })

    // Link plan to goal
    this.addLink('SolvedByLink', [goalNode.id, planNode.id])

    // Add tasks
    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i]
      const taskNode = this.addNode('TaskNode', task.id, {
        strength: task.status === 'completed' ? 1.0 : task.status === 'failed' ? 0.0 : 0.5,
        confidence: task.status === 'completed' || task.status === 'failed' ? 0.9 : 0.3,
      })

      // Task metadata
      taskNode.meta = {
        name: task.name,
        description: task.description,
        status: task.status,
        result: task.result,
        error: task.error,
      }

      // Link task to plan
      this.addLink('MemberLink', [taskNode.id, planNode.id])

      // Add task dependencies (previous task)
      if (i > 0) {
        const prevTask = plan.tasks[i - 1]
        const prevTaskNode = this.getNodeByName('TaskNode', prevTask.id)
        if (prevTaskNode) {
          this.addDependencyLink(taskNode.id, prevTaskNode.id)
        }
      }
    }

    // Extract concepts from goal
    this.extractConcepts(plan.goal, goalNode.id)
  }

  /**
   * Extract concepts from text and link them
   */
  private extractConcepts(text: string, sourceId: string): void {
    // Simple keyword extraction
    const keywords = text.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'what', 'when', 'where', 'which'].includes(w))

    const uniqueKeywords = [...new Set(keywords)].slice(0, 10)

    for (const keyword of uniqueKeywords) {
      const conceptNode = this.addNode('ConceptNode', keyword, {
        strength: 0.7,
        confidence: 0.5,
      })
      this.addLink('ContextLink', [conceptNode.id, sourceId], {
        strength: 0.6,
        confidence: 0.4,
      })
    }
  }

  /**
   * Find similar goals based on shared concepts
   */
  findSimilarGoals(goal: string, limit: number = 5): Array<{ goal: Node; similarity: number }> {
    // Get concepts for this goal
    const goalConcepts = new Set<string>()
    const words = goal.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (word.length > 3) goalConcepts.add(word)
    }

    // Find all goal nodes
    const goalNodes = this.query({ type: 'GoalNode' }).atoms as Node[]

    // Calculate similarity
    const similarities: Array<{ goal: Node; similarity: number }> = []

    for (const goalNode of goalNodes) {
      if (goalNode.name === goal) continue

      // Get context links for this goal
      const contextLinks = this.getIncoming(goalNode.id)
        .filter(link => link.type === 'ContextLink')

      let sharedConcepts = 0
      for (const link of contextLinks) {
        const conceptId = link.outgoing[0]
        const concept = this.atoms.get(conceptId) as Node | undefined
        if (concept && goalConcepts.has(concept.name)) {
          sharedConcepts++
        }
      }

      if (sharedConcepts > 0) {
        const similarity = sharedConcepts / Math.max(goalConcepts.size, contextLinks.length)
        similarities.push({ goal: goalNode, similarity })
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  /**
   * Get successful task patterns for a goal type
   */
  getSuccessfulTaskPatterns(goalKeywords: string[]): Array<{ tasks: Node[]; successRate: number }> {
    const patterns: Array<{ planId: string; tasks: Node[]; successRate: number }> = []

    // Find goals that match keywords
    for (const keyword of goalKeywords) {
      const conceptNode = this.getNodeByName('ConceptNode', keyword.toLowerCase())
      if (!conceptNode) continue

      // Find goals linked to this concept
      const contextLinks = this.getIncoming(conceptNode.id)
        .filter(link => link.type === 'ContextLink')

      for (const link of contextLinks) {
        const goalId = link.outgoing[1]
        const goalNode = this.atoms.get(goalId)
        if (!goalNode || goalNode.type !== 'GoalNode') continue

        // Find plan that solved this goal
        const solvedByLinks = this.getIncoming(goalId)
          .filter(l => l.type === 'SolvedByLink')

        for (const solvedLink of solvedByLinks) {
          const planId = solvedLink.outgoing[1]
          const planNode = this.atoms.get(planId)
          if (!planNode) continue

          // Get tasks in this plan
          const memberLinks = this.getIncoming(planId)
            .filter(l => l.type === 'MemberLink')

          const tasks: Node[] = []
          let completed = 0
          let total = 0

          for (const memberLink of memberLinks) {
            const taskId = memberLink.outgoing[0]
            const taskNode = this.atoms.get(taskId) as Node | undefined
            if (taskNode && taskNode.type === 'TaskNode') {
              tasks.push(taskNode)
              total++
              if (taskNode.tv?.strength === 1.0) completed++
            }
          }

          if (total > 0) {
            patterns.push({
              planId,
              tasks,
              successRate: completed / total,
            })
          }
        }
      }
    }

    return patterns
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5)
  }

  // ---------------------------------------------------------------------------
  // Attention Allocation
  // ---------------------------------------------------------------------------

  /**
   * Spread activation from high-attention atoms
   */
  spreadActivation(iterations: number = 3, decayFactor: number = 0.7): void {
    for (let i = 0; i < iterations; i++) {
      const updates: Map<string, number> = new Map()

      for (const [id, atom] of this.atoms) {
        if (!atom.av || atom.av.sti <= 0) continue

        // Spread to connected atoms
        if ('outgoing' in atom) {
          const link = atom as Link
          const spreadAmount = atom.av.sti * decayFactor / link.outgoing.length
          for (const targetId of link.outgoing) {
            const current = updates.get(targetId) || 0
            updates.set(targetId, current + spreadAmount)
          }
        }

        // Spread through incoming links
        const incoming = this.incomingIndex.get(id)
        if (incoming && incoming.size > 0) {
          const spreadAmount = atom.av.sti * decayFactor / incoming.size
          for (const linkId of incoming) {
            const current = updates.get(linkId) || 0
            updates.set(linkId, current + spreadAmount)
          }
        }
      }

      // Apply updates
      for (const [id, delta] of updates) {
        const atom = this.atoms.get(id)
        if (atom) {
          if (!atom.av) atom.av = { ...DEFAULT_ATTENTION_VALUE }
          atom.av.sti = Math.min(100, atom.av.sti + delta)
        }
      }
    }
  }

  /**
   * Focus attention on a specific atom
   */
  focusAttention(atomId: string, amount: number = 50): void {
    const atom = this.atoms.get(atomId)
    if (atom) {
      if (!atom.av) atom.av = { ...DEFAULT_ATTENTION_VALUE }
      atom.av.sti += amount
      atom.av.lti = Math.min(100, atom.av.lti + amount * 0.1)
    }
  }

  /**
   * Decay attention over time
   */
  decayAttention(decayRate: number = 0.05): void {
    for (const atom of this.atoms.values()) {
      if (atom.av) {
        atom.av.sti = Math.max(0, atom.av.sti * (1 - decayRate))
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Export the Atomspace to a serializable format
   */
  export(): { atoms: Atom[]; stats: typeof this.stats } {
    return {
      atoms: Array.from(this.atoms.values()),
      stats: { ...this.stats },
    }
  }

  /**
   * Import atoms from a serialized format
   */
  import(data: { atoms: Atom[]; stats?: typeof this.stats }): void {
    for (const atom of data.atoms) {
      this.atoms.set(atom.id, atom)

      if ('name' in atom) {
        this.indexNode(atom as Node)
      } else if ('outgoing' in atom) {
        this.indexLink(atom as Link)
      }
    }

    if (data.stats) {
      this.stats = { ...data.stats }
    }
  }

  /**
   * Clear the Atomspace
   */
  clear(): void {
    this.atoms.clear()
    this.nameIndex.clear()
    this.typeIndex.clear()
    this.incomingIndex.clear()
    this.stats = {
      nodesCreated: 0,
      linksCreated: 0,
      queries: 0,
      lastQueryTime: 0,
    }
    this.initializeTypeHierarchy()
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats(): {
    atomCount: number
    nodeCount: number
    linkCount: number
    queries: number
    lastQueryTime: number
  } {
    let nodeCount = 0
    let linkCount = 0

    for (const atom of this.atoms.values()) {
      if ('name' in atom) nodeCount++
      else if ('outgoing' in atom) linkCount++
    }

    return {
      atomCount: this.atoms.size,
      nodeCount,
      linkCount,
      queries: this.stats.queries,
      lastQueryTime: this.stats.lastQueryTime,
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  private indexNode(node: Node): void {
    // Name index
    if (!this.nameIndex.has(node.name)) {
      this.nameIndex.set(node.name, new Set())
    }
    this.nameIndex.get(node.name)!.add(node.id)

    // Type index
    if (!this.typeIndex.has(node.type)) {
      this.typeIndex.set(node.type, new Set())
    }
    this.typeIndex.get(node.type)!.add(node.id)
  }

  private indexLink(link: Link): void {
    // Type index
    if (!this.typeIndex.has(link.type)) {
      this.typeIndex.set(link.type, new Set())
    }
    this.typeIndex.get(link.type)!.add(link.id)

    // Incoming index
    for (const targetId of link.outgoing) {
      if (!this.incomingIndex.has(targetId)) {
        this.incomingIndex.set(targetId, new Set())
      }
      this.incomingIndex.get(targetId)!.add(link.id)
    }
  }

  private findLink(type: AtomType, outgoing: string[]): Link | null {
    const typeSet = this.typeIndex.get(type)
    if (!typeSet) return null

    for (const id of typeSet) {
      const atom = this.atoms.get(id) as Link
      if (atom && 'outgoing' in atom) {
        if (atom.outgoing.length === outgoing.length &&
            atom.outgoing.every((id, i) => id === outgoing[i])) {
          return atom
        }
      }
    }
    return null
  }

  private intersect(set1: Set<string>, set2: Set<string>): Set<string> {
    const result = new Set<string>()
    for (const id of set1) {
      if (set2.has(id)) result.add(id)
    }
    return result
  }

  private mergeTruthValues(existing?: TruthValue, incoming?: TruthValue): TruthValue {
    if (!existing) return incoming || { ...DEFAULT_TRUTH_VALUE }
    if (!incoming) return existing

    // Weighted average based on counts
    const count1 = existing.count || 1
    const count2 = incoming.count || 1
    const totalCount = count1 + count2

    return {
      strength: (existing.strength * count1 + incoming.strength * count2) / totalCount,
      confidence: Math.max(existing.confidence, incoming.confidence),
      count: totalCount,
    }
  }

  private mergeAttentionValues(existing?: AttentionValue, incoming?: AttentionValue): AttentionValue {
    if (!existing) return incoming || { ...DEFAULT_ATTENTION_VALUE }
    if (!incoming) return existing

    return {
      sti: Math.max(existing.sti, incoming.sti),
      lti: Math.max(existing.lti, incoming.lti),
      vlti: Math.max(existing.vlti || 0, incoming.vlti || 0),
    }
  }

  private initializeTypeHierarchy(): void {
    // Add basic type hierarchy nodes
    const atomType = this.addNode('TypeNode', 'Atom')
    const nodeType = this.addNode('TypeNode', 'Node')
    const linkType = this.addNode('TypeNode', 'Link')

    this.addInheritanceLink(nodeType.id, atomType.id)
    this.addInheritanceLink(linkType.id, atomType.id)

    // Node types
    const conceptType = this.addNode('TypeNode', 'ConceptNode')
    const predicateType = this.addNode('TypeNode', 'PredicateNode')
    const goalType = this.addNode('TypeNode', 'GoalNode')
    const taskType = this.addNode('TypeNode', 'TaskNode')
    const planType = this.addNode('TypeNode', 'PlanNode')

    this.addInheritanceLink(conceptType.id, nodeType.id)
    this.addInheritanceLink(predicateType.id, nodeType.id)
    this.addInheritanceLink(goalType.id, nodeType.id)
    this.addInheritanceLink(taskType.id, nodeType.id)
    this.addInheritanceLink(planType.id, nodeType.id)
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let atomspaceInstance: Atomspace | null = null

export function getAtomspace(): Atomspace {
  if (!atomspaceInstance) {
    atomspaceInstance = new Atomspace()
  }
  return atomspaceInstance
}

export function resetAtomspace(): void {
  if (atomspaceInstance) {
    atomspaceInstance.clear()
  }
  atomspaceInstance = null
}
