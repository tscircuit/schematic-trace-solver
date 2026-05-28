import { expect, test } from "bun:test"
import { SameNetTraceAlignmentSolver } from "lib/solvers/SameNetTraceAlignmentSolver/SameNetTraceAlignmentSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}.1`, chipId: "U1", x: 0, y: 0 },
      { pinId: `${mspPairId}.2`, chipId: "U2", x: 0, y: 0 },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  }) as SolvedTracePath

test("aligns close same-net horizontal interior segments", () => {
  const solver = new SameNetTraceAlignmentSolver({
    alignmentTolerance: 0.2,
    traces: [
      makeTrace("a", "GND", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "GND", [
        { x: 1, y: 0 },
        { x: 1, y: 1.12 },
        { x: 3, y: 1.12 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const [, alignedTrace] = solver.getOutput().traces
  expect(alignedTrace!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0 },
  ])
})

test("does not align close segments from different nets", () => {
  const solver = new SameNetTraceAlignmentSolver({
    alignmentTolerance: 0.2,
    traces: [
      makeTrace("a", "GND", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "VCC", [
        { x: 1, y: 0 },
        { x: 1, y: 1.12 },
        { x: 3, y: 1.12 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const [, untouchedTrace] = solver.getOutput().traces
  expect(untouchedTrace!.tracePath[1]!.y).toBe(1.12)
  expect(untouchedTrace!.tracePath[2]!.y).toBe(1.12)
})

test("aligns close same-net vertical interior segments", () => {
  const solver = new SameNetTraceAlignmentSolver({
    alignmentTolerance: 0.2,
    traces: [
      makeTrace("a", "SDA", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ]),
      makeTrace("b", "SDA", [
        { x: 0, y: 1 },
        { x: 1.12, y: 1 },
        { x: 1.12, y: 3 },
        { x: 0, y: 3 },
      ]),
    ],
  })

  solver.solve()

  const [, alignedTrace] = solver.getOutput().traces
  expect(alignedTrace!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 0, y: 3 },
  ])
})

test("does not align when the moved tail would overlap a different net", () => {
  const solver = new SameNetTraceAlignmentSolver({
    alignmentTolerance: 0.2,
    traces: [
      makeTrace("gnd-a", "GND", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      makeTrace("gnd-b", "GND", [
        { x: 2, y: 0 },
        { x: 2, y: 1.1 },
        { x: 4, y: 1.1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("vcc", "VCC", [
        { x: 3.2, y: 0 },
        { x: 3.2, y: 1 },
        { x: 3.8, y: 1 },
        { x: 3.8, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const [, gndTrace] = solver.getOutput().traces
  expect(gndTrace!.tracePath[1]!.y).toBe(1.1)
  expect(gndTrace!.tracePath[2]!.y).toBe(1.1)
})
