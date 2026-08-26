import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-mspm0l1306-capacitor-symmetry.input.json"

// Captured from tscircuit/ti#119, Microcontroller_MSPM0L1306 at b5ee159.
// Only opaque component/port IDs and display metadata were normalized.
// C1/C2 are already level; their VDD/VSS rail junctions should be level too.
test("repro: MSPM0L1306 aligned decoupling capacitor rails", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const getTrace = (...pinIds: string[]) => {
    const trace = traces.find((trace) =>
      pinIds.every((pinId) => trace.pinIds.includes(pinId)),
    )
    expect(trace).toBeDefined()
    return trace!
  }
  for (const [pin, railY] of [
    [1, 2.05],
    [2, 0.65],
  ] as const) {
    const path = getTrace(`C1.${pin}`, `C2.${pin}`).tracePath
    const horizontalSegments = path.slice(1).flatMap((end, index) => {
      const start = path[index]!
      return Math.abs(start.y - end.y) < 1e-6 ? [[start, end]] : []
    })
    expect(horizontalSegments).toHaveLength(1)
    const [start, end] = horizontalSegments[0]!
    expect(start!.y).toBeCloseTo(railY, 6)
    expect(end!.y).toBeCloseTo(railY, 6)
    expect([start!.x, end!.x].sort()).toEqual([-3.5, -4.5].sort())
  }

  // The lower return should continue the C1 column, not introduce a third
  // column between C1/C2 or an extra horizontal step near VSS.
  const returnPath = getTrace("C3.2", "C2.2").tracePath
  expect(returnPath.some((point) => Math.abs(point.x + 4.5) < 1e-6)).toBe(true)
  expect(returnPath.every((point) => [-4.5, -3.5].includes(point.x))).toBe(true)
  expect(returnPath.some((point) => Math.abs(point.y - 0.65) < 1e-6)).toBe(true)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
