import { expect, test } from "bun:test"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

class SlowChildSolver extends BaseSolver {
  override _step() {
    if (this.iterations === 4) this.solved = true
  }
}

class ParentSolver extends BaseSolver {
  override MAX_ITERATIONS = 2
  override activeSubSolver: BaseSolver | null = null

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.activeSubSolver = null
      this.solved = true
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    this.activeSubSolver = new SlowChildSolver()
  }
}

class StuckSolver extends BaseSolver {
  override MAX_ITERATIONS = 2
}

test("parent iteration budget does not interrupt an active child solver", () => {
  const solver = new ParentSolver()

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.iterations).toBeGreaterThan(solver.MAX_ITERATIONS)
  expect(solver.iterationsWithoutActiveSubSolver).toBeLessThanOrEqual(
    solver.MAX_ITERATIONS,
  )
})

test("iteration budget still limits work outside child solvers", () => {
  const solver = new StuckSolver()

  solver.solve()

  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.iterationsWithoutActiveSubSolver).toBe(3)
})
