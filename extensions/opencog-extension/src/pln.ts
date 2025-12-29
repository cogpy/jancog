/**
 * PLN - Probabilistic Logic Networks
 *
 * PLN is OpenCog's reasoning framework that combines probabilistic inference
 * with logical reasoning. This implementation provides:
 *
 * - Inference Rules: Deduction, induction, abduction, modus ponens, etc.
 * - Truth Value Formulas: Precise calculations for combining uncertainties
 * - Forward Chaining: Derive new knowledge from existing atoms
 * - Backward Chaining: Prove goals by finding supporting evidence
 * - Inference Control: Prioritize which inferences to make
 */

import {
  Atomspace,
  getAtomspace,
  type Atom,
  type Node,
  type Link,
  type TruthValue,
  type AtomType,
} from './atomspace'

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Inference result with provenance
 */
export interface InferenceResult {
  /** The newly derived or verified atom */
  atom: Atom
  /** Rule used to derive this */
  rule: InferenceRuleName
  /** Premises used in derivation */
  premises: Atom[]
  /** Resulting truth value */
  truthValue: TruthValue
  /** Confidence in the inference */
  confidence: number
  /** Chain of reasoning */
  trace: string[]
}

/**
 * Names of available inference rules
 */
export type InferenceRuleName =
  | 'Deduction'
  | 'Induction'
  | 'Abduction'
  | 'ModusPonens'
  | 'ModusTollens'
  | 'Similarity'
  | 'Inheritance'
  | 'Conjunction'
  | 'Disjunction'
  | 'Negation'
  | 'ContextualReasoning'
  | 'AnalogyReasoning'

/**
 * Inference rule interface
 */
export interface InferenceRule {
  name: InferenceRuleName
  description: string
  /** Check if rule can be applied to given atoms */
  canApply: (atomspace: Atomspace, premises: Atom[]) => boolean
  /** Apply the rule and return inferred atom(s) */
  apply: (atomspace: Atomspace, premises: Atom[]) => InferenceResult[]
  /** Priority for inference control */
  priority: number
}

/**
 * Forward chaining configuration
 */
export interface ForwardChainingConfig {
  maxIterations: number
  minConfidence: number
  maxNewAtoms: number
  focusAtomIds?: string[]
  rules?: InferenceRuleName[]
}

/**
 * Backward chaining configuration
 */
export interface BackwardChainingConfig {
  maxDepth: number
  minConfidence: number
  maxPaths: number
  targetAtomId?: string
}

// =============================================================================
// Truth Value Formulas
// =============================================================================

/**
 * PLN Truth Value formulas based on OpenCog's PLN theory
 */
export class TruthValueFormulas {
  /**
   * Deduction formula: If A→B and B→C, then A→C
   * sAC = sAB * sBC * sC + (1-sAB) * sC * (1-sBC)
   */
  static deduction(tvAB: TruthValue, tvBC: TruthValue, tvC: TruthValue): TruthValue {
    const sAB = tvAB.strength
    const sBC = tvBC.strength
    const sC = tvC.strength

    const strength = sAB * sBC * sC + (1 - sAB) * sC * (1 - sBC)

    // Confidence based on minimum of premises
    const confidence = Math.min(tvAB.confidence, tvBC.confidence, tvC.confidence) * 0.9

    return { strength, confidence, count: 1 }
  }

  /**
   * Induction formula: If A→B and A→C, infer relationship between B and C
   */
  static induction(tvAB: TruthValue, tvAC: TruthValue, tvA: TruthValue): TruthValue {
    const sAB = tvAB.strength
    const sAC = tvAC.strength
    const sA = tvA.strength

    // Simplified induction formula
    const strength = sAB * sAC / Math.max(sA, 0.01)
    const clampedStrength = Math.min(1, Math.max(0, strength))

    const confidence = Math.min(tvAB.confidence, tvAC.confidence, tvA.confidence) * 0.7

    return { strength: clampedStrength, confidence, count: 1 }
  }

  /**
   * Abduction formula: If A→B and C→B, infer relationship between A and C
   */
  static abduction(tvAB: TruthValue, tvCB: TruthValue, tvB: TruthValue): TruthValue {
    const sAB = tvAB.strength
    const sCB = tvCB.strength
    const sB = tvB.strength

    // Simplified abduction formula
    const strength = sAB * sCB / Math.max(sB, 0.01)
    const clampedStrength = Math.min(1, Math.max(0, strength))

    const confidence = Math.min(tvAB.confidence, tvCB.confidence, tvB.confidence) * 0.6

    return { strength: clampedStrength, confidence, count: 1 }
  }

  /**
   * Modus Ponens: If A and A→B, then B
   */
  static modusPonens(tvA: TruthValue, tvAB: TruthValue): TruthValue {
    const strength = tvA.strength * tvAB.strength
    const confidence = Math.min(tvA.confidence, tvAB.confidence) * 0.95

    return { strength, confidence, count: 1 }
  }

  /**
   * Modus Tollens: If ¬B and A→B, then ¬A
   */
  static modusTollens(tvNotB: TruthValue, tvAB: TruthValue): TruthValue {
    // P(¬A|¬B,A→B) = P(¬B|A→B) * P(A→B) / P(¬B)
    const strength = (1 - tvAB.strength * (1 - tvNotB.strength))
    const confidence = Math.min(tvNotB.confidence, tvAB.confidence) * 0.85

    return { strength, confidence, count: 1 }
  }

  /**
   * Similarity from inheritance: If A→B with high strength, B→A relationship
   */
  static similarityFromInheritance(tvAB: TruthValue, tvBA: TruthValue): TruthValue {
    const strength = (tvAB.strength + tvBA.strength) / 2
    const confidence = Math.min(tvAB.confidence, tvBA.confidence)

    return { strength, confidence, count: 1 }
  }

  /**
   * Conjunction: A AND B
   */
  static conjunction(tvA: TruthValue, tvB: TruthValue): TruthValue {
    const strength = tvA.strength * tvB.strength
    const confidence = Math.min(tvA.confidence, tvB.confidence)

    return { strength, confidence, count: 1 }
  }

  /**
   * Disjunction: A OR B
   */
  static disjunction(tvA: TruthValue, tvB: TruthValue): TruthValue {
    const strength = tvA.strength + tvB.strength - tvA.strength * tvB.strength
    const confidence = Math.min(tvA.confidence, tvB.confidence)

    return { strength, confidence, count: 1 }
  }

  /**
   * Negation: NOT A
   */
  static negation(tvA: TruthValue): TruthValue {
    return {
      strength: 1 - tvA.strength,
      confidence: tvA.confidence,
      count: tvA.count,
    }
  }

  /**
   * Revision: Combine two truth values for the same statement
   */
  static revision(tv1: TruthValue, tv2: TruthValue): TruthValue {
    const c1 = tv1.confidence
    const c2 = tv2.confidence

    // Weight by confidence
    const weight1 = c1 / (c1 + c2 - c1 * c2 + 0.001)
    const weight2 = 1 - weight1

    const strength = tv1.strength * weight1 + tv2.strength * weight2
    const confidence = 1 - (1 - c1) * (1 - c2)

    return {
      strength,
      confidence,
      count: (tv1.count || 1) + (tv2.count || 1),
    }
  }
}

// =============================================================================
// Inference Rules Implementation
// =============================================================================

/**
 * Deduction Rule: A→B, B→C ⊢ A→C
 */
const deductionRule: InferenceRule = {
  name: 'Deduction',
  description: 'If A inherits from B and B inherits from C, then A inherits from C',
  priority: 10,

  canApply(atomspace: Atomspace, premises: Atom[]): boolean {
    if (premises.length < 2) return false
    const [link1, link2] = premises as [Link, Link]
    if (!link1.outgoing || !link2.outgoing) return false
    // Check if link1's target matches link2's source
    return link1.outgoing[1] === link2.outgoing[0]
  },

  apply(atomspace: Atomspace, premises: Atom[]): InferenceResult[] {
    const [link1, link2] = premises as [Link, Link]
    const A = link1.outgoing[0]
    const B = link1.outgoing[1]
    const C = link2.outgoing[1]

    // Get truth values
    const tvAB = link1.tv || { strength: 1, confidence: 0.5 }
    const tvBC = link2.tv || { strength: 1, confidence: 0.5 }

    // Get B's truth value
    const atomB = atomspace.query({ type: ['ConceptNode', 'TaskNode', 'GoalNode'], limit: 1 }).atoms
      .find(a => a.id === B)
    const tvB = atomB?.tv || { strength: 0.5, confidence: 0.5 }

    // Calculate deduced truth value
    const tvAC = TruthValueFormulas.deduction(tvAB, tvBC, tvB)

    // Create the new link
    const newLink = atomspace.addLink('InheritanceLink', [A, C], tvAC)

    return [{
      atom: newLink,
      rule: 'Deduction',
      premises,
      truthValue: tvAC,
      confidence: tvAC.confidence,
      trace: [`Deduction: ${A} → ${B} → ${C}`],
    }]
  },
}

/**
 * Modus Ponens Rule: A, A→B ⊢ B
 */
const modusPonensRule: InferenceRule = {
  name: 'ModusPonens',
  description: 'If A is true and A implies B, then B is true',
  priority: 9,

  canApply(atomspace: Atomspace, premises: Atom[]): boolean {
    if (premises.length < 2) return false
    const [nodeA, implication] = premises
    if (!('outgoing' in implication)) return false
    const link = implication as Link
    if (link.type !== 'ImplicationLink') return false
    return link.outgoing[0] === nodeA.id
  },

  apply(atomspace: Atomspace, premises: Atom[]): InferenceResult[] {
    const [nodeA, implication] = premises
    const link = implication as Link
    const B = link.outgoing[1]

    const tvA = nodeA.tv || { strength: 1, confidence: 0.5 }
    const tvAB = link.tv || { strength: 1, confidence: 0.5 }

    const tvB = TruthValueFormulas.modusPonens(tvA, tvAB)

    // Update B's truth value
    const atomB = atomspace.query({ type: ['ConceptNode', 'TaskNode', 'GoalNode'] }).atoms
      .find(a => a.id === B)

    if (atomB) {
      atomB.tv = TruthValueFormulas.revision(atomB.tv || { strength: 0.5, confidence: 0.1 }, tvB)
    }

    return [{
      atom: atomB || { id: B, type: 'ConceptNode' as AtomType, createdAt: Date.now(), updatedAt: Date.now() },
      rule: 'ModusPonens',
      premises,
      truthValue: tvB,
      confidence: tvB.confidence,
      trace: [`ModusPonens: ${nodeA.id} ∧ (${nodeA.id}→${B}) ⊢ ${B}`],
    }]
  },
}

/**
 * Similarity Rule: A→B, B→A ⊢ A~B
 */
const similarityRule: InferenceRule = {
  name: 'Similarity',
  description: 'If A inherits from B and B inherits from A, they are similar',
  priority: 7,

  canApply(atomspace: Atomspace, premises: Atom[]): boolean {
    if (premises.length < 2) return false
    const [link1, link2] = premises as [Link, Link]
    if (!link1.outgoing || !link2.outgoing) return false
    // Check bidirectional inheritance
    return link1.outgoing[0] === link2.outgoing[1] &&
           link1.outgoing[1] === link2.outgoing[0]
  },

  apply(atomspace: Atomspace, premises: Atom[]): InferenceResult[] {
    const [link1, link2] = premises as [Link, Link]
    const A = link1.outgoing[0]
    const B = link1.outgoing[1]

    const tvAB = link1.tv || { strength: 1, confidence: 0.5 }
    const tvBA = link2.tv || { strength: 1, confidence: 0.5 }

    const tvSim = TruthValueFormulas.similarityFromInheritance(tvAB, tvBA)

    const newLink = atomspace.addLink('SimilarityLink', [A, B], tvSim)

    return [{
      atom: newLink,
      rule: 'Similarity',
      premises,
      truthValue: tvSim,
      confidence: tvSim.confidence,
      trace: [`Similarity: (${A}→${B}) ∧ (${B}→${A}) ⊢ (${A}~${B})`],
    }]
  },
}

/**
 * Context Reasoning: Infer properties based on shared context
 */
const contextualReasoningRule: InferenceRule = {
  name: 'ContextualReasoning',
  description: 'If entities share context, infer shared properties',
  priority: 6,

  canApply(atomspace: Atomspace, premises: Atom[]): boolean {
    if (premises.length < 2) return false
    // Check if both are context links pointing to same context
    const [link1, link2] = premises as [Link, Link]
    if (link1.type !== 'ContextLink' || link2.type !== 'ContextLink') return false
    return link1.outgoing[1] === link2.outgoing[1]
  },

  apply(atomspace: Atomspace, premises: Atom[]): InferenceResult[] {
    const [link1, link2] = premises as [Link, Link]
    const A = link1.outgoing[0]
    const B = link2.outgoing[0]

    if (A === B) return []

    // Entities sharing context are likely related
    const tvA = link1.tv || { strength: 0.5, confidence: 0.5 }
    const tvB = link2.tv || { strength: 0.5, confidence: 0.5 }

    const similarity = Math.sqrt(tvA.strength * tvB.strength)
    const confidence = Math.min(tvA.confidence, tvB.confidence) * 0.6

    const tvSim: TruthValue = { strength: similarity, confidence, count: 1 }
    const newLink = atomspace.addLink('SimilarityLink', [A, B], tvSim)

    return [{
      atom: newLink,
      rule: 'ContextualReasoning',
      premises,
      truthValue: tvSim,
      confidence,
      trace: [`ContextualReasoning: shared context implies similarity between ${A} and ${B}`],
    }]
  },
}

/**
 * Analogy Reasoning: If A~B and A has property P, B likely has P
 */
const analogyReasoningRule: InferenceRule = {
  name: 'AnalogyReasoning',
  description: 'Similar entities likely have similar properties',
  priority: 5,

  canApply(atomspace: Atomspace, premises: Atom[]): boolean {
    if (premises.length < 2) return false
    const [simLink, propLink] = premises as [Link, Link]
    if (simLink.type !== 'SimilarityLink') return false
    if (!propLink.outgoing) return false
    // Property link should involve one of the similar entities
    return simLink.outgoing.includes(propLink.outgoing[0])
  },

  apply(atomspace: Atomspace, premises: Atom[]): InferenceResult[] {
    const [simLink, propLink] = premises as [Link, Link]
    const A = simLink.outgoing[0]
    const B = simLink.outgoing[1]

    const sourceEntity = propLink.outgoing[0]
    const targetEntity = sourceEntity === A ? B : A
    const property = propLink.outgoing[1]

    const tvSim = simLink.tv || { strength: 0.5, confidence: 0.5 }
    const tvProp = propLink.tv || { strength: 0.5, confidence: 0.5 }

    // Analogical inference strength
    const strength = tvSim.strength * tvProp.strength
    const confidence = Math.min(tvSim.confidence, tvProp.confidence) * 0.5

    const tvInferred: TruthValue = { strength, confidence, count: 1 }
    const newLink = atomspace.addLink(propLink.type, [targetEntity, property], tvInferred)

    return [{
      atom: newLink,
      rule: 'AnalogyReasoning',
      premises,
      truthValue: tvInferred,
      confidence,
      trace: [`AnalogyReasoning: ${sourceEntity} similar to ${targetEntity}, property transferred`],
    }]
  },
}

// =============================================================================
// PLN Inference Engine
// =============================================================================

/**
 * PLN Inference Engine
 */
export class PLNEngine {
  private atomspace: Atomspace
  private rules: InferenceRule[]
  private inferenceHistory: InferenceResult[] = []

  constructor(atomspace?: Atomspace) {
    this.atomspace = atomspace || getAtomspace()
    this.rules = [
      deductionRule,
      modusPonensRule,
      similarityRule,
      contextualReasoningRule,
      analogyReasoningRule,
    ]
  }

  /**
   * Forward chaining - derive new knowledge from existing atoms
   */
  forwardChain(config: ForwardChainingConfig): InferenceResult[] {
    const results: InferenceResult[] = []
    const newAtomsCreated = new Set<string>()

    // Sort rules by priority
    const activeRules = this.rules
      .filter(r => !config.rules || config.rules.includes(r.name))
      .sort((a, b) => b.priority - a.priority)

    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
      let foundNew = false

      // Get candidate atoms
      let candidates = this.atomspace.query({ type: 'InheritanceLink' }).atoms
      candidates = candidates.concat(this.atomspace.query({ type: 'ImplicationLink' }).atoms)
      candidates = candidates.concat(this.atomspace.query({ type: 'SimilarityLink' }).atoms)
      candidates = candidates.concat(this.atomspace.query({ type: 'ContextLink' }).atoms)

      // Focus on specific atoms if specified
      if (config.focusAtomIds) {
        candidates = candidates.filter(a =>
          'outgoing' in a &&
          (a as Link).outgoing.some(id => config.focusAtomIds!.includes(id))
        )
      }

      // Try each rule
      for (const rule of activeRules) {
        // Find premise combinations
        for (let i = 0; i < candidates.length; i++) {
          for (let j = i + 1; j < candidates.length; j++) {
            const premises = [candidates[i], candidates[j]]

            if (rule.canApply(this.atomspace, premises)) {
              const inferred = rule.apply(this.atomspace, premises)

              for (const result of inferred) {
                if (result.confidence >= config.minConfidence &&
                    !newAtomsCreated.has(result.atom.id)) {
                  results.push(result)
                  newAtomsCreated.add(result.atom.id)
                  foundNew = true

                  if (newAtomsCreated.size >= config.maxNewAtoms) {
                    return results
                  }
                }
              }
            }
          }
        }
      }

      if (!foundNew) break
    }

    this.inferenceHistory.push(...results)
    return results
  }

  /**
   * Backward chaining - prove a goal by finding supporting evidence
   */
  backwardChain(goalAtomId: string, config: BackwardChainingConfig): {
    proven: boolean
    confidence: number
    proofPaths: InferenceResult[][]
  } {
    const proofPaths: InferenceResult[][] = []
    const visited = new Set<string>()

    const prove = (atomId: string, depth: number, currentPath: InferenceResult[]): boolean => {
      if (depth > config.maxDepth) return false
      if (visited.has(atomId)) return false
      if (proofPaths.length >= config.maxPaths) return false

      visited.add(atomId)

      // Check if atom exists with sufficient confidence
      const atom = this.atomspace.query({ limit: 1000 }).atoms.find(a => a.id === atomId)
      if (atom && atom.tv && atom.tv.confidence >= config.minConfidence) {
        if (atom.tv.strength >= 0.5) {
          proofPaths.push([...currentPath])
          return true
        }
      }

      // Look for supporting links
      const incomingLinks = this.atomspace.getIncoming(atomId)
      let foundProof = false

      for (const link of incomingLinks) {
        if (link.type === 'InheritanceLink' || link.type === 'ImplicationLink') {
          const sourceId = link.outgoing[0]

          if (link.tv && link.tv.confidence >= config.minConfidence) {
            const inferenceResult: InferenceResult = {
              atom: atom || link,
              rule: 'Deduction',
              premises: [link],
              truthValue: link.tv,
              confidence: link.tv.confidence,
              trace: [`${sourceId} supports ${atomId} via ${link.type}`],
            }

            if (prove(sourceId, depth + 1, [...currentPath, inferenceResult])) {
              foundProof = true
            }
          }
        }
      }

      visited.delete(atomId)
      return foundProof
    }

    prove(goalAtomId, 0, [])

    // Calculate overall confidence
    let maxConfidence = 0
    for (const path of proofPaths) {
      const pathConfidence = path.reduce((min, r) => Math.min(min, r.confidence), 1)
      maxConfidence = Math.max(maxConfidence, pathConfidence)
    }

    return {
      proven: proofPaths.length > 0,
      confidence: maxConfidence,
      proofPaths,
    }
  }

  /**
   * Infer task success likelihood based on knowledge graph
   */
  inferTaskSuccess(taskDescription: string, context: Record<string, unknown>): {
    likelihood: number
    confidence: number
    reasoning: string[]
  } {
    const reasoning: string[] = []
    let likelihood = 0.5
    let confidence = 0.3

    // Find similar tasks in knowledge base
    const taskNodes = this.atomspace.query({ type: 'TaskNode' }).atoms as Node[]

    for (const taskNode of taskNodes) {
      if (!taskNode.meta?.name) continue

      // Simple similarity based on shared words
      const taskWords = new Set(String(taskNode.meta.name).toLowerCase().split(/\s+/))
      const descWords = new Set(taskDescription.toLowerCase().split(/\s+/))

      let sharedWords = 0
      for (const word of descWords) {
        if (taskWords.has(word)) sharedWords++
      }

      const similarity = sharedWords / Math.max(taskWords.size, descWords.size)

      if (similarity > 0.3) {
        const taskTv = taskNode.tv || { strength: 0.5, confidence: 0.3 }

        // Weight by similarity and task's truth value
        const contribution = similarity * taskTv.strength
        likelihood = likelihood * (1 - similarity) + contribution
        confidence = Math.max(confidence, taskTv.confidence * similarity)

        reasoning.push(`Similar task "${taskNode.meta.name}" had ${Math.round(taskTv.strength * 100)}% success`)
      }
    }

    // Run forward chaining to find more connections
    const inferences = this.forwardChain({
      maxIterations: 3,
      minConfidence: 0.3,
      maxNewAtoms: 10,
    })

    if (inferences.length > 0) {
      reasoning.push(`Derived ${inferences.length} new inferences from knowledge graph`)
    }

    return {
      likelihood: Math.min(1, Math.max(0, likelihood)),
      confidence,
      reasoning,
    }
  }

  /**
   * Learn from execution results - update truth values
   */
  learnFromExecution(taskId: string, success: boolean, executionTime: number): void {
    const taskNode = this.atomspace.query({ type: 'TaskNode', name: taskId }).atoms[0] as Node

    if (taskNode) {
      const newTv: TruthValue = {
        strength: success ? 1.0 : 0.0,
        confidence: 0.9,
        count: (taskNode.tv?.count || 0) + 1,
      }

      taskNode.tv = TruthValueFormulas.revision(
        taskNode.tv || { strength: 0.5, confidence: 0.1 },
        newTv
      )

      taskNode.meta = {
        ...taskNode.meta,
        lastExecutionTime: executionTime,
        lastSuccess: success,
      }

      // Spread attention based on success
      if (success) {
        this.atomspace.focusAttention(taskNode.id, 20)
      }
    }
  }

  /**
   * Get recommended approach based on PLN reasoning
   */
  getRecommendedApproach(goal: string, availableTools: string[]): {
    approach: string
    confidence: number
    supporting_evidence: string[]
  } {
    const evidence: string[] = []
    let bestApproach = 'sequential'
    let bestConfidence = 0.3

    // Find goal patterns
    const goalNode = this.atomspace.getNodeByName('GoalNode', goal)
    if (goalNode) {
      const solvedByLinks = this.atomspace.getIncoming(goalNode.id)
        .filter(l => l.type === 'SolvedByLink')

      for (const link of solvedByLinks) {
        const planId = link.outgoing[1]
        const planNode = this.atomspace.query({ type: 'PlanNode', name: planId }).atoms[0]

        if (planNode && planNode.tv) {
          if (planNode.tv.strength > bestConfidence) {
            bestConfidence = planNode.tv.strength
            evidence.push(`Previous plan "${planId}" succeeded with ${Math.round(planNode.tv.strength * 100)}% rate`)
          }
        }
      }
    }

    // Infer from tool availability
    for (const tool of availableTools) {
      const toolNode = this.atomspace.getNodeByName('ToolNode', tool)
      if (toolNode && toolNode.tv && toolNode.tv.strength > 0.7) {
        evidence.push(`Tool "${tool}" has high reliability (${Math.round(toolNode.tv.strength * 100)}%)`)
      }
    }

    // Use forward chaining for more insights
    const inferences = this.forwardChain({
      maxIterations: 2,
      minConfidence: 0.4,
      maxNewAtoms: 5,
    })

    for (const inference of inferences) {
      if (inference.confidence > bestConfidence) {
        evidence.push(...inference.trace)
      }
    }

    return {
      approach: bestApproach,
      confidence: bestConfidence,
      supporting_evidence: evidence,
    }
  }

  /**
   * Get inference history
   */
  getInferenceHistory(): InferenceResult[] {
    return [...this.inferenceHistory]
  }

  /**
   * Clear inference history
   */
  clearHistory(): void {
    this.inferenceHistory = []
  }

  /**
   * Get available rules
   */
  getRules(): { name: string; description: string; priority: number }[] {
    return this.rules.map(r => ({
      name: r.name,
      description: r.description,
      priority: r.priority,
    }))
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let plnInstance: PLNEngine | null = null

export function getPLNEngine(): PLNEngine {
  if (!plnInstance) {
    plnInstance = new PLNEngine()
  }
  return plnInstance
}

export function resetPLNEngine(): void {
  if (plnInstance) {
    plnInstance.clearHistory()
  }
  plnInstance = null
}
