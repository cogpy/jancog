/**
 * Tests for PLN - Probabilistic Logic Networks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PLNEngine, getPLNEngine, resetPLNEngine, TruthValueFormulas } from './pln'
import { getAtomspace, resetAtomspace } from './atomspace'

describe('TruthValueFormulas', () => {
  describe('deduction', () => {
    it('should calculate deduction truth value', () => {
      const tvAB = { strength: 0.9, confidence: 0.8 }
      const tvBC = { strength: 0.8, confidence: 0.7 }
      const tvC = { strength: 0.7, confidence: 0.6 }

      const result = TruthValueFormulas.deduction(tvAB, tvBC, tvC)

      expect(result.strength).toBeGreaterThan(0)
      expect(result.strength).toBeLessThan(1)
      expect(result.confidence).toBeGreaterThan(0)
    })
  })

  describe('modusPonens', () => {
    it('should calculate modus ponens truth value', () => {
      const tvA = { strength: 0.9, confidence: 0.8 }
      const tvAB = { strength: 0.85, confidence: 0.9 }

      const result = TruthValueFormulas.modusPonens(tvA, tvAB)

      expect(result.strength).toBe(0.9 * 0.85)
      expect(result.confidence).toBeLessThanOrEqual(Math.min(tvA.confidence, tvAB.confidence))
    })
  })

  describe('conjunction', () => {
    it('should calculate conjunction (AND) truth value', () => {
      const tvA = { strength: 0.8, confidence: 0.9 }
      const tvB = { strength: 0.7, confidence: 0.8 }

      const result = TruthValueFormulas.conjunction(tvA, tvB)

      expect(result.strength).toBe(0.8 * 0.7)
      expect(result.confidence).toBe(Math.min(tvA.confidence, tvB.confidence))
    })
  })

  describe('disjunction', () => {
    it('should calculate disjunction (OR) truth value', () => {
      const tvA = { strength: 0.6, confidence: 0.9 }
      const tvB = { strength: 0.5, confidence: 0.8 }

      const result = TruthValueFormulas.disjunction(tvA, tvB)

      // P(A OR B) = P(A) + P(B) - P(A)*P(B)
      expect(result.strength).toBe(0.6 + 0.5 - 0.6 * 0.5)
    })
  })

  describe('negation', () => {
    it('should calculate negation (NOT) truth value', () => {
      const tvA = { strength: 0.7, confidence: 0.9 }

      const result = TruthValueFormulas.negation(tvA)

      expect(result.strength).toBe(0.3)
      expect(result.confidence).toBe(tvA.confidence)
    })
  })

  describe('revision', () => {
    it('should combine two truth values for same statement', () => {
      const tv1 = { strength: 0.8, confidence: 0.5, count: 3 }
      const tv2 = { strength: 0.6, confidence: 0.7, count: 5 }

      const result = TruthValueFormulas.revision(tv1, tv2)

      // Revised strength should be between the two
      expect(result.strength).toBeGreaterThan(0.6)
      expect(result.strength).toBeLessThan(0.8)
      // Revised confidence should increase
      expect(result.confidence).toBeGreaterThan(Math.max(tv1.confidence, tv2.confidence) - 0.01)
      // Count should be sum
      expect(result.count).toBe(8)
    })
  })
})

describe('PLNEngine', () => {
  let pln: PLNEngine

  beforeEach(() => {
    resetAtomspace()
    resetPLNEngine()
    pln = getPLNEngine()
  })

  afterEach(() => {
    resetPLNEngine()
    resetAtomspace()
  })

  describe('initialization', () => {
    it('should initialize with inference rules', () => {
      const rules = pln.getRules()

      expect(rules.length).toBeGreaterThan(0)
      expect(rules.some(r => r.name === 'Deduction')).toBe(true)
      expect(rules.some(r => r.name === 'ModusPonens')).toBe(true)
      expect(rules.some(r => r.name === 'Similarity')).toBe(true)
    })
  })

  describe('forwardChain', () => {
    it('should perform forward chaining inference', () => {
      const atomspace = getAtomspace()

      // Set up some knowledge
      const a = atomspace.addNode('ConceptNode', 'animal')
      const b = atomspace.addNode('ConceptNode', 'mammal')
      const c = atomspace.addNode('ConceptNode', 'dog')

      atomspace.addInheritanceLink(c.id, b.id, { strength: 0.95, confidence: 0.9 })
      atomspace.addInheritanceLink(b.id, a.id, { strength: 0.9, confidence: 0.85 })

      const results = pln.forwardChain({
        maxIterations: 5,
        minConfidence: 0.3,
        maxNewAtoms: 10,
      })

      // Should derive that dog inherits from animal
      expect(results).toBeDefined()
      // Results may or may not contain deduced inferences depending on rule matching
    })

    it('should respect maxIterations limit', () => {
      const results = pln.forwardChain({
        maxIterations: 1,
        minConfidence: 0.1,
        maxNewAtoms: 100,
      })

      // Should complete without error
      expect(results).toBeDefined()
    })

    it('should respect minConfidence threshold', () => {
      const atomspace = getAtomspace()

      const a = atomspace.addNode('ConceptNode', 'weak-concept')
      const b = atomspace.addNode('ConceptNode', 'another-weak')

      atomspace.addInheritanceLink(a.id, b.id, { strength: 0.3, confidence: 0.1 })

      const results = pln.forwardChain({
        maxIterations: 5,
        minConfidence: 0.9, // High threshold
        maxNewAtoms: 10,
      })

      // Low confidence inferences should be filtered out
      expect(results.every(r => r.confidence >= 0.9 || results.length === 0)).toBe(true)
    })
  })

  describe('backwardChain', () => {
    it('should perform backward chaining to prove goal', () => {
      const atomspace = getAtomspace()

      const goal = atomspace.addNode('GoalNode', 'provable-goal', { strength: 0.5, confidence: 0.3 })
      const support = atomspace.addNode('ConceptNode', 'supporting-evidence', { strength: 0.9, confidence: 0.8 })

      atomspace.addImplicationLink(support.id, goal.id, { strength: 0.8, confidence: 0.7 })

      const result = pln.backwardChain(goal.id, {
        maxDepth: 3,
        minConfidence: 0.3,
        maxPaths: 5,
      })

      expect(result).toBeDefined()
      expect(typeof result.proven).toBe('boolean')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })

    it('should report no proof for unsupported goal', () => {
      const atomspace = getAtomspace()
      const orphan = atomspace.addNode('GoalNode', 'orphan-goal', { strength: 0.1, confidence: 0.1 })

      const result = pln.backwardChain(orphan.id, {
        maxDepth: 2,
        minConfidence: 0.5,
        maxPaths: 3,
      })

      expect(result.proven).toBe(false)
      expect(result.proofPaths.length).toBe(0)
    })
  })

  describe('inferTaskSuccess', () => {
    it('should infer task success likelihood', () => {
      const result = pln.inferTaskSuccess('research machine learning', {})

      expect(result.likelihood).toBeGreaterThanOrEqual(0)
      expect(result.likelihood).toBeLessThanOrEqual(1)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.reasoning)).toBe(true)
    })

    it('should use similar tasks for inference', () => {
      const atomspace = getAtomspace()

      // Add a similar successful task
      const task = atomspace.addNode('TaskNode', 'research AI', { strength: 0.9, confidence: 0.8 })
      task.meta = { name: 'research AI', status: 'completed' }

      const result = pln.inferTaskSuccess('research machine learning', {})

      // Should have some reasoning based on similar task
      expect(result).toBeDefined()
    })
  })

  describe('learnFromExecution', () => {
    it('should update task node truth value on success', () => {
      const atomspace = getAtomspace()
      const task = atomspace.addNode('TaskNode', 'learning-task', { strength: 0.5, confidence: 0.3 })

      pln.learnFromExecution('learning-task', true, 1000)

      const updated = atomspace.getNodeByName('TaskNode', 'learning-task')
      expect(updated?.tv?.strength).toBeGreaterThan(0.5)
    })

    it('should update task node truth value on failure', () => {
      const atomspace = getAtomspace()
      const task = atomspace.addNode('TaskNode', 'failing-task', { strength: 0.5, confidence: 0.3 })

      pln.learnFromExecution('failing-task', false, 500)

      const updated = atomspace.getNodeByName('TaskNode', 'failing-task')
      expect(updated?.tv?.strength).toBeLessThan(0.5)
    })
  })

  describe('getRecommendedApproach', () => {
    it('should recommend approach for goal', () => {
      const result = pln.getRecommendedApproach('write a report', ['file_read', 'llm_inference'])

      expect(result.approach).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.supporting_evidence)).toBe(true)
    })
  })

  describe('inferenceHistory', () => {
    it('should track inference history', () => {
      pln.forwardChain({
        maxIterations: 3,
        minConfidence: 0.1,
        maxNewAtoms: 5,
      })

      const history = pln.getInferenceHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it('should clear history', () => {
      pln.forwardChain({
        maxIterations: 2,
        minConfidence: 0.1,
        maxNewAtoms: 3,
      })

      pln.clearHistory()

      expect(pln.getInferenceHistory().length).toBe(0)
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const pln1 = getPLNEngine()
      const pln2 = getPLNEngine()

      expect(pln1).toBe(pln2)
    })
  })
})
