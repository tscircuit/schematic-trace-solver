import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-acoustic-tuner-parallel-vref-traces.input.json"

// Captured from the merged Core repro188 acoustic tuner schematic. The VREF
// route contains two long vertical segments separated by only a small gap.
test("repro acoustic tuner near-parallel VREF traces", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  const vrefPins = new Set(
    inputProblem.netConnections.find(({ netId }) => netId === "VREF")!.pinIds,
  )
  const verticalEdges = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.filter(({ pinIds }) =>
      pinIds?.every((pinId) => vrefPins.has(pinId)),
    )
    .flatMap(({ tracePath }) =>
      tracePath.slice(0, -1).flatMap((from, index) => {
        const to = tracePath[index + 1]!
        return from.x === to.x ? [{ from, to }] : []
      }),
    )

  const hasNearParallelOverlap = verticalEdges.some((edge, edgeIndex) =>
    verticalEdges.slice(edgeIndex + 1).some((otherEdge) => {
      const separation = Math.abs(edge.from.x - otherEdge.from.x)
      const overlap =
        Math.min(
          Math.max(edge.from.y, edge.to.y),
          Math.max(otherEdge.from.y, otherEdge.to.y),
        ) -
        Math.max(
          Math.min(edge.from.y, edge.to.y),
          Math.min(otherEdge.from.y, otherEdge.to.y),
        )

      return separation > 0 && separation <= 0.05 && overlap > 1
    }),
  )

  expect(hasNearParallelOverlap).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
