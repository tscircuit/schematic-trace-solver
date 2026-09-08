import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-net-label-recovery-diagonal-trace.input.json"
import "tests/fixtures/matcher"

// NetLabelToTraceSolver recovers a trace between two net-label pins that are
// only approximately aligned (within MAX_NAMED_NET_RECOVERY_PERPENDICULAR_OFFSET).
// Before the fix it emitted the raw two-point path, producing a 4.71-long wire
// with 0.01 of vertical drift: a visibly slanted schematic trace.
test("recovered net-label traces stay orthogonal", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.failed).toBe(false)

  const { traces } = solver.netLabelToTraceSolver!.getOutput()

  const diagonalSegments: string[] = []
  for (const trace of traces) {
    const path = trace.tracePath ?? []
    for (let index = 0; index + 1 < path.length; index++) {
      const start = path[index]!
      const end = path[index + 1]!
      const xDrift = Math.abs(start.x - end.x)
      const yDrift = Math.abs(start.y - end.y)
      if (xDrift > 1e-4 && yDrift > 1e-4) {
        diagonalSegments.push(
          `${trace.mspPairId} segment ${index}: (${start.x}, ${start.y}) -> (${end.x}, ${end.y})`,
        )
      }
    }
  }

  expect(diagonalSegments).toEqual([])

  // The recovery itself must still happen - straightening must not drop the trace.
  expect(
    traces.some((trace) =>
      ["schematic_port_112", "schematic_port_73"].every((pinId) =>
        trace.pinIds.includes(pinId),
      ),
    ),
  ).toBe(true)
})
