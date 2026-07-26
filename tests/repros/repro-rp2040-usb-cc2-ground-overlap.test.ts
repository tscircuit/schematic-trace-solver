import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import inputProblem from "./assets/repro-rp2040-usb-cc2-ground-overlap.input.json"

const EPS = 1e-6

const pathsHavePositiveLengthCollinearOverlap = (
  first: SolvedTracePath,
  second: SolvedTracePath,
) => {
  for (
    let firstIndex = 0;
    firstIndex < first.tracePath.length - 1;
    firstIndex++
  ) {
    const firstStart = first.tracePath[firstIndex]!
    const firstEnd = first.tracePath[firstIndex + 1]!
    const firstIsVertical = Math.abs(firstStart.x - firstEnd.x) < EPS
    const firstIsHorizontal = Math.abs(firstStart.y - firstEnd.y) < EPS

    for (
      let secondIndex = 0;
      secondIndex < second.tracePath.length - 1;
      secondIndex++
    ) {
      const secondStart = second.tracePath[secondIndex]!
      const secondEnd = second.tracePath[secondIndex + 1]!
      const secondIsVertical = Math.abs(secondStart.x - secondEnd.x) < EPS
      const secondIsHorizontal = Math.abs(secondStart.y - secondEnd.y) < EPS

      if (
        firstIsVertical &&
        secondIsVertical &&
        Math.abs(firstStart.x - secondStart.x) < EPS
      ) {
        const overlapLength =
          Math.min(
            Math.max(firstStart.y, firstEnd.y),
            Math.max(secondStart.y, secondEnd.y),
          ) -
          Math.max(
            Math.min(firstStart.y, firstEnd.y),
            Math.min(secondStart.y, secondEnd.y),
          )
        if (overlapLength > EPS) return true
      }

      if (
        firstIsHorizontal &&
        secondIsHorizontal &&
        Math.abs(firstStart.y - secondStart.y) < EPS
      ) {
        const overlapLength =
          Math.min(
            Math.max(firstStart.x, firstEnd.x),
            Math.max(secondStart.x, secondEnd.x),
          ) -
          Math.max(
            Math.min(firstStart.x, firstEnd.x),
            Math.min(secondStart.x, secondEnd.x),
          )
        if (overlapLength > EPS) return true
      }
    }
  }

  return false
}

test("avoids RP2040 USB-C CC2 label connector overlapping GND", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const cc2LabelConnector = traces.find(
    (trace) =>
      trace.userNetId === "CC2" &&
      trace.mspPairId.startsWith("available-net-orientation-"),
  )

  expect(cc2LabelConnector).toBeDefined()

  const overlappingDifferentNetTraceIds = traces
    .filter(
      (trace) =>
        trace.globalConnNetId !== cc2LabelConnector!.globalConnNetId &&
        pathsHavePositiveLengthCollinearOverlap(trace, cc2LabelConnector!),
    )
    .map((trace) => trace.mspPairId)

  expect(overlappingDifferentNetTraceIds).toEqual([])
})
