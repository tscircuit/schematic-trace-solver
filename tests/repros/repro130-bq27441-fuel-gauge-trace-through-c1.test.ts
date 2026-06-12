import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro130-bq27441-fuel-gauge.input.json"
import "tests/fixtures/matcher"

const getChipRect = (chip: any) => ({
  minX: chip.center.x - chip.width / 2,
  maxX: chip.center.x + chip.width / 2,
  minY: chip.center.y - chip.height / 2,
  maxY: chip.center.y + chip.height / 2,
})

const EPS = 1e-9

const segmentIntersectsRect = (a: any, b: any, rect: any) => {
  if (a.x === b.x) {
    const overlap =
      Math.min(Math.max(a.y, b.y), rect.maxY) -
      Math.max(Math.min(a.y, b.y), rect.minY)
    return a.x >= rect.minX - EPS && a.x <= rect.maxX + EPS && overlap > EPS
  }

  if (a.y === b.y) {
    const overlap =
      Math.min(Math.max(a.x, b.x), rect.maxX) -
      Math.max(Math.min(a.x, b.x), rect.minX)
    return a.y >= rect.minY - EPS && a.y <= rect.maxY + EPS && overlap > EPS
  }

  return false
}

const pathIntersectsRect = (path: Array<{ x: number; y: number }>, rect: any) =>
  path.some((point, index) => {
    if (index === 0) return false
    return segmentIntersectsRect(path[index - 1], point, rect)
  })

test("repro130 bq27441 fuel gauge trace does not cross C1 obstacle", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const c1 = (inputProblem as any).chips.find((chip: any) =>
    chip.pins.some((pin: any) => pin.pinId === "C1.1"),
  )
  const traces =
    solver.netLabelTraceCollisionSolver?.getOutput().traces ??
    solver.traceCleanupSolver?.getOutput().traces ??
    []
  const traceThroughC1 = traces.find(
    (trace: any) => trace.mspPairId === "U1.3-C1.2",
  )

  expect(c1).toBeDefined()
  expect(traceThroughC1).toBeDefined()
  expect(pathIntersectsRect(traceThroughC1!.tracePath, getChipRect(c1))).toBe(
    false,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
