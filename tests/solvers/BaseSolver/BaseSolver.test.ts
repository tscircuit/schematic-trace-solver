import { expect, test } from "bun:test"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

// Test solver that simply marks solved after one step
class TestSolver extends BaseSolver {
  _step() {
    this.solved = true
  }

  getConstructorParams() {
    return {}
  }
}

test("BaseSolver initializes with default values", () => {
  const solver = new BaseSolver()

  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(false)
  expect(solver.iterations).toBe(0)
  expect(solver.progress).toBe(0)
  expect(solver.error).toBeNull()
})

test("BaseSolver solves and sets solved=true", () => {
  const solver = new TestSolver()
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.iterations).toBeGreaterThan(0)
})

test("BaseSolver tracks solve time", () => {
  const solver = new TestSolver()
  solver.solve()

  expect(solver.timeToSolve).toBeDefined()
  expect(typeof solver.timeToSolve).toBe("number")
})

test("BaseSolver visualize returns empty graphics object", () => {
  const solver = new BaseSolver()
  const viz = solver.visualize()

  expect(viz.lines).toBeDefined()
  expect(viz.points).toBeDefined()
  expect(viz.rects).toBeDefined()
  expect(viz.circles).toBeDefined()
  expect(Array.isArray(viz.lines)).toBe(true)
  expect(Array.isArray(viz.points)).toBe(true)
  expect(Array.isArray(viz.rects)).toBe(true)
  expect(Array.isArray(viz.circles)).toBe(true)
})

test("BaseSolver preview returns empty graphics object", () => {
  const solver = new BaseSolver()
  const preview = solver.preview()

  expect(preview.lines).toBeDefined()
  expect(preview.points).toBeDefined()
  expect(preview.rects).toBeDefined()
  expect(preview.circles).toBeDefined()
})
