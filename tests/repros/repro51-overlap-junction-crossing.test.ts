import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import inputProblem from "./assets/repro51-overlap-junction-crossing.input.json"
import "tests/fixtures/matcher"

const EPS = 1e-6

function tracesHavePositiveLengthOverlap(
  a: SolvedTracePath,
  b: SolvedTracePath,
) {
  for (let ai = 0; ai < a.tracePath.length - 1; ai++) {
    const a1 = a.tracePath[ai]!
    const a2 = a.tracePath[ai + 1]!
    const aVertical = Math.abs(a1.x - a2.x) < EPS
    const aHorizontal = Math.abs(a1.y - a2.y) < EPS
    if (!aVertical && !aHorizontal) continue

    for (let bi = 0; bi < b.tracePath.length - 1; bi++) {
      const b1 = b.tracePath[bi]!
      const b2 = b.tracePath[bi + 1]!
      const bVertical = Math.abs(b1.x - b2.x) < EPS
      const bHorizontal = Math.abs(b1.y - b2.y) < EPS

      if (aVertical && bVertical && Math.abs(a1.x - b1.x) < EPS) {
        const overlap =
          Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
          Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
        if (overlap > EPS) return true
      }

      if (aHorizontal && bHorizontal && Math.abs(a1.y - b1.y) < EPS) {
        const overlap =
          Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
          Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
        if (overlap > EPS) return true
      }
    }
  }

  return false
}

function traceIntersectsDifferentNetLabel(
  trace: SolvedTracePath,
  label: NetLabelPlacement,
) {
  if (trace.globalConnNetId === label.globalConnNetId) return false

  const bounds = getRectBounds(label.center, label.width, label.height)
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    if (
      segmentIntersectsRect(
        trace.tracePath[i]!,
        trace.tracePath[i + 1]!,
        bounds,
      )
    ) {
      return true
    }
  }

  return false
}

test("repro51 overlap junction crossing keeps VCC and GND separated", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const output = solver.netLabelTraceCollisionSolver!.getOutput()
  const gndNetIds = new Set(
    output.netLabelPlacements
      .filter((label) => label.netId === "GND")
      .map((label) => label.globalConnNetId),
  )
  const vccNetIds = new Set(
    output.netLabelPlacements
      .filter((label) => label.netId === "VCC")
      .map((label) => label.globalConnNetId),
  )
  const gndTraces = output.traces.filter((trace) =>
    gndNetIds.has(trace.globalConnNetId),
  )
  const vccTraces = output.traces.filter((trace) =>
    vccNetIds.has(trace.globalConnNetId),
  )

  for (const gndTrace of gndTraces) {
    for (const vccTrace of vccTraces) {
      expect(tracesHavePositiveLengthOverlap(gndTrace, vccTrace)).toBe(false)
    }
  }

  for (const trace of output.traces) {
    for (const label of output.netLabelPlacements) {
      expect(traceIntersectsDifferentNetLabel(trace, label)).toBe(false)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
