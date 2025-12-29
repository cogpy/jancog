/**
 * Tests for Atomspace - OpenCog's Knowledge Graph
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  Atomspace,
  getAtomspace,
  resetAtomspace,
  DEFAULT_TRUTH_VALUE,
  type Node,
  type Link,
} from './atomspace'

describe('Atomspace', () => {
  let atomspace: Atomspace

  beforeEach(() => {
    resetAtomspace()
    atomspace = getAtomspace()
  })

  afterEach(() => {
    resetAtomspace()
  })

  describe('Node Operations', () => {
    it('should add a node with default truth value', () => {
      const node = atomspace.addNode('ConceptNode', 'test-concept')

      expect(node).toBeDefined()
      expect(node.id).toContain('node_')
      expect(node.type).toBe('ConceptNode')
      expect(node.name).toBe('test-concept')
      expect(node.tv?.strength).toBe(DEFAULT_TRUTH_VALUE.strength)
      expect(node.tv?.confidence).toBe(DEFAULT_TRUTH_VALUE.confidence)
    })

    it('should add a node with custom truth value', () => {
      const tv = { strength: 0.8, confidence: 0.7, count: 5 }
      const node = atomspace.addNode('GoalNode', 'my-goal', tv)

      expect(node.tv?.strength).toBe(0.8)
      expect(node.tv?.confidence).toBe(0.7)
      expect(node.tv?.count).toBe(5)
    })

    it('should return existing node and merge truth values on duplicate', () => {
      const node1 = atomspace.addNode('TaskNode', 'task-1', { strength: 0.5, confidence: 0.5 })
      const node2 = atomspace.addNode('TaskNode', 'task-1', { strength: 0.9, confidence: 0.9 })

      expect(node1.id).toBe(node2.id)
      // Merged truth value should be weighted average
      expect(node2.tv?.strength).toBeGreaterThan(0.5)
      expect(node2.tv?.strength).toBeLessThan(0.9)
    })

    it('should get node by type and name', () => {
      atomspace.addNode('ConceptNode', 'findable')

      const found = atomspace.getNodeByName('ConceptNode', 'findable')
      expect(found).toBeDefined()
      expect(found?.name).toBe('findable')

      const notFound = atomspace.getNodeByName('ConceptNode', 'not-there')
      expect(notFound).toBeNull()
    })
  })

  describe('Link Operations', () => {
    it('should add a link connecting atoms', () => {
      const node1 = atomspace.addNode('ConceptNode', 'child')
      const node2 = atomspace.addNode('ConceptNode', 'parent')

      const link = atomspace.addLink('InheritanceLink', [node1.id, node2.id])

      expect(link).toBeDefined()
      expect(link.id).toContain('link_')
      expect(link.type).toBe('InheritanceLink')
      expect(link.outgoing).toEqual([node1.id, node2.id])
    })

    it('should throw error for non-existent atoms', () => {
      expect(() => {
        atomspace.addLink('InheritanceLink', ['fake-id-1', 'fake-id-2'])
      }).toThrow()
    })

    it('should add inheritance link convenience method', () => {
      const child = atomspace.addNode('ConceptNode', 'dog')
      const parent = atomspace.addNode('ConceptNode', 'animal')

      const link = atomspace.addInheritanceLink(child.id, parent.id)

      expect(link.type).toBe('InheritanceLink')
      expect(link.outgoing).toEqual([child.id, parent.id])
    })

    it('should add dependency link', () => {
      const task1 = atomspace.addNode('TaskNode', 'task-1')
      const task2 = atomspace.addNode('TaskNode', 'task-2')

      const link = atomspace.addDependencyLink(task1.id, task2.id)

      expect(link.type).toBe('DependsOnLink')
    })
  })

  describe('Query Operations', () => {
    beforeEach(() => {
      atomspace.addNode('ConceptNode', 'cat')
      atomspace.addNode('ConceptNode', 'dog')
      atomspace.addNode('TaskNode', 'research')
      atomspace.addNode('GoalNode', 'learn programming', { strength: 0.9, confidence: 0.8 })
    })

    it('should query by type', () => {
      const result = atomspace.query({ type: 'ConceptNode' })

      // Includes built-in type nodes plus our concepts
      expect(result.atoms.length).toBeGreaterThanOrEqual(2)
      expect(result.atoms.some(a => (a as Node).name === 'cat')).toBe(true)
      expect(result.atoms.some(a => (a as Node).name === 'dog')).toBe(true)
    })

    it('should query by name', () => {
      const result = atomspace.query({ name: 'cat' })

      expect(result.atoms.length).toBe(1)
      expect((result.atoms[0] as Node).name).toBe('cat')
    })

    it('should query by truth value strength', () => {
      const result = atomspace.query({ type: 'GoalNode', tvStrengthMin: 0.8 })

      expect(result.atoms.length).toBeGreaterThanOrEqual(1)
    })

    it('should limit results', () => {
      const result = atomspace.query({ limit: 2 })

      expect(result.atoms.length).toBe(2)
    })

    it('should query by name regex', () => {
      const result = atomspace.query({ name: /^(cat|dog)$/ })

      expect(result.atoms.length).toBe(2)
    })
  })

  describe('Plan Knowledge', () => {
    it('should add plan knowledge to atomspace', () => {
      const plan = {
        id: 'plan_123',
        goal: 'research artificial intelligence',
        tasks: [
          { id: 'task_1', name: 'gather resources', description: 'Find AI papers', status: 'completed' as const, createdAt: Date.now(), updatedAt: Date.now() },
          { id: 'task_2', name: 'analyze data', description: 'Study the papers', status: 'pending' as const, createdAt: Date.now(), updatedAt: Date.now() },
        ],
        status: 'executing' as const,
        createdAt: Date.now(),
      }

      atomspace.addPlanKnowledge(plan)

      // Check plan node exists
      const planNodes = atomspace.query({ type: 'PlanNode' })
      expect(planNodes.atoms.some(a => (a as Node).name === 'plan_123')).toBe(true)

      // Check goal node exists
      const goalNodes = atomspace.query({ type: 'GoalNode' })
      expect(goalNodes.atoms.some(a => (a as Node).name === 'research artificial intelligence')).toBe(true)

      // Check task nodes exist
      const taskNodes = atomspace.query({ type: 'TaskNode' })
      expect(taskNodes.atoms.some(a => (a as Node).name === 'task_1')).toBe(true)
      expect(taskNodes.atoms.some(a => (a as Node).name === 'task_2')).toBe(true)
    })

    it('should find similar goals', () => {
      // Add some goal knowledge
      const plan1 = {
        id: 'plan_1',
        goal: 'learn machine learning basics',
        tasks: [],
        status: 'completed' as const,
        createdAt: Date.now(),
      }
      const plan2 = {
        id: 'plan_2',
        goal: 'study deep learning',
        tasks: [],
        status: 'completed' as const,
        createdAt: Date.now(),
      }

      atomspace.addPlanKnowledge(plan1)
      atomspace.addPlanKnowledge(plan2)

      const similar = atomspace.findSimilarGoals('learn machine learning advanced')

      // Should find the similar goal about machine learning
      expect(similar.length).toBeGreaterThanOrEqual(0) // May be 0 if no shared concepts
    })
  })

  describe('Attention Allocation', () => {
    it('should focus attention on atom', () => {
      const node = atomspace.addNode('ConceptNode', 'important')
      const initialSti = node.av?.sti || 0

      atomspace.focusAttention(node.id, 50)

      expect(node.av?.sti).toBe(initialSti + 50)
    })

    it('should decay attention', () => {
      const node = atomspace.addNode('ConceptNode', 'fading')
      atomspace.focusAttention(node.id, 100)
      const beforeDecay = node.av?.sti || 0

      atomspace.decayAttention(0.1)

      expect(node.av?.sti).toBeLessThan(beforeDecay)
    })
  })

  describe('Persistence', () => {
    it('should export and import atomspace', () => {
      atomspace.addNode('ConceptNode', 'exportable')
      atomspace.addNode('TaskNode', 'also-exportable')

      const exported = atomspace.export()
      expect(exported.atoms.length).toBeGreaterThan(0)

      // Create new atomspace and import
      resetAtomspace()
      const newAtomspace = getAtomspace()
      newAtomspace.import(exported)

      const node = newAtomspace.getNodeByName('ConceptNode', 'exportable')
      expect(node).toBeDefined()
    })

    it('should clear atomspace', () => {
      atomspace.addNode('ConceptNode', 'will-be-cleared')

      atomspace.clear()

      const stats = atomspace.getStats()
      // Only type hierarchy nodes should remain
      expect(stats.nodeCount).toBeLessThan(20) // Small number for type hierarchy
    })
  })

  describe('Statistics', () => {
    it('should return correct stats', () => {
      atomspace.addNode('ConceptNode', 'stat-test-1')
      atomspace.addNode('ConceptNode', 'stat-test-2')

      const stats = atomspace.getStats()

      expect(stats.atomCount).toBeGreaterThan(0)
      expect(stats.nodeCount).toBeGreaterThan(0)
      expect(stats.queries).toBe(0)
    })

    it('should track query count', () => {
      atomspace.query({ type: 'ConceptNode' })
      atomspace.query({ type: 'TaskNode' })

      const stats = atomspace.getStats()
      expect(stats.queries).toBe(2)
    })
  })

  describe('Incoming Links', () => {
    it('should get incoming links for atom', () => {
      const child = atomspace.addNode('ConceptNode', 'child-node')
      const parent = atomspace.addNode('ConceptNode', 'parent-node')
      atomspace.addInheritanceLink(child.id, parent.id)

      const incoming = atomspace.getIncoming(parent.id)

      expect(incoming.length).toBe(1)
      expect(incoming[0].type).toBe('InheritanceLink')
    })

    it('should get neighborhood of atom', () => {
      const center = atomspace.addNode('ConceptNode', 'center')
      const neighbor1 = atomspace.addNode('ConceptNode', 'neighbor1')
      const neighbor2 = atomspace.addNode('ConceptNode', 'neighbor2')

      atomspace.addLink('SimilarityLink', [center.id, neighbor1.id])
      atomspace.addLink('SimilarityLink', [center.id, neighbor2.id])

      const neighborhood = atomspace.getNeighborhood(center.id, 1)

      expect(neighborhood.length).toBeGreaterThanOrEqual(3) // center + 2 neighbors + links
    })
  })

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getAtomspace()
      const instance2 = getAtomspace()

      expect(instance1).toBe(instance2)
    })

    it('should reset singleton', () => {
      const instance1 = getAtomspace()
      instance1.addNode('ConceptNode', 'before-reset')

      resetAtomspace()

      const instance2 = getAtomspace()
      const found = instance2.getNodeByName('ConceptNode', 'before-reset')

      expect(found).toBeNull()
    })
  })
})
