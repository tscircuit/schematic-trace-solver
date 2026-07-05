import { expect, test } from "bun:test"
import { SameNetTraceAlignmentSolver } from "lib/solvers/SameNetTraceAlignmentSolver/SameNetTraceAlignmentSolver"

test("SameNetTraceAlignmentSolver aligns close same-net segments", () => {
  const inputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  } as any

  const traces = [
    {
      mspPairId: "N1-1",
      dcConnNetId: "N1",
      globalConnNetId: "N1",
      pins: [],
      pinIds: [],
      mspConnectionPairIds: ["N1-1"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ],
    },
    {
      mspPairId: "N1-2",
      dcConnNetId: "N1",
      globalConnNetId: "N1",
      pins: [],
      pinIds: [],
      mspConnectionPairIds: ["N1-2"],
      tracePath: [
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 2.05 },
      ],
    },
    {
      mspPairId: "N2-1",
      dcConnNetId: "N2",
      globalConnNetId: "N2",
      pins: [],
      pinIds: [],
      mspConnectionPairIds: ["N2-1"],
      tracePath: [
        { x: 0, y: 5 },
        { x: 1, y: 5 },
        { x: 1, y: 6 },
        { x: 3, y: 6 },
        { x: 3, y: 7 },
      ],
    },
  ] as any

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem,
    traces,
  })

  solver.solve()

  const output = solver.getOutput().traces

  expect(output[0]!.tracePath[2]!.y).toBeCloseTo(output[1]!.tracePath[2]!.y, 10)
  expect(output[0]!.tracePath[3]!.y).toBeCloseTo(output[1]!.tracePath[3]!.y, 10)
  expect(output[0]!.tracePath[2]!.y).toBeCloseTo(1.025, 3)

  expect(output[2]!.tracePath[2]!.y).toBe(6)
  expect(output[2]!.tracePath[3]!.y).toBe(6)
})
