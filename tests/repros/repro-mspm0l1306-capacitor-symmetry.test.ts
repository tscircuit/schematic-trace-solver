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

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
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

  // C3 and C4 share the electrical GND net with the decoupling rail, but
  // should each terminate locally instead of being wired to other capacitors.
  for (const pinId of ["C3.2", "C4.2"]) {
    expect(
      traces.some(
        (trace) => trace.pinIds.includes(pinId) && trace.pinIds.length > 1,
      ),
    ).toBe(false)
    expect(
      netLabelPlacements.some(
        (label) =>
          label.netId === "GND" &&
          label.pinIds.includes(pinId) &&
          label.orientation === "y-",
      ),
    ).toBe(true)
  }
  const railGround = netLabelPlacements.find(
    (label) =>
      label.netId === "GND" &&
      label.mspConnectionPairIds.some((pairId) =>
        traces.some(
          (trace) =>
            trace.mspPairId === pairId && trace.pinIds.includes("C1.2"),
        ),
      ),
  )
  expect(railGround).toBeDefined()
  expect(railGround!.orientation).toBe("y-")
  expect(railGround!.anchorPoint.x).toBeCloseTo(-4.5, 6)
  expect(railGround!.anchorPoint.y).toBeCloseTo(0.65, 6)
  const groundNetId =
    solver.mspConnectionPairSolver!.globalConnMap.getNetConnectedToId("GND")
  expect(
    netLabelPlacements
      .filter((label) => label.netId === "GND")
      .every((label) => label.globalConnNetId === groundNetId),
  ).toBe(true)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
