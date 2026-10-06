import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { mergeSameNetTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraces"

const problem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 6,
      pins: [
        { pinId: "U1.1", x: -1, y: 2, _facingDirection: "x-" },
        { pinId: "U1.2", x: -1, y: 0, _facingDirection: "x-" },
        { pinId: "U1.3", x: -1, y: -2, _facingDirection: "x-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [],
  textBoxes: [],
  availableNetLabelOrientations: {},
}

const pin = (pinId: string): InputPin & { chipId: string } => ({
  ...problem.chips[0]!.pins.find((p) => p.pinId === pinId)!,
  chipId: "U1",
})

const createTrace = (
  mspPairId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId,
  globalConnNetId: "power-net",
  dcConnNetId: mspPairId,
  userNetId: "POWER",
  pins: [pin("U1.1"), pin("U1.2")],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: ["U1.1", "U1.2"],
})

test("merge same-net parallel segments onto a shared line", () => {
  // Two same-net traces whose horizontal runs sit 0.001 apart on nearly the
  // same Y — they should snap together so they render as a single line.
  const traces: SolvedTracePath[] = [
    createTrace("upper", [
      { x: -1, y: 2 },
      { x: -2.5, y: 2 },
      { x: -2.5, y: 1 },
      { x: -1.5, y: 1 }, // long horizontal run at y=1 (outside chip)
      { x: -1, y: 1 },
    ]),
    createTrace("lower", [
      { x: -1, y: 0 },
      { x: -3.5, y: 0 },
      { x: -3.5, y: 1.001 }, // nearly the same Y as the upper run
      { x: -2, y: 1.001 }, // overlapping span x in [-2.5, -1.5]
      { x: -1, y: 1.001 },
    ]),
  ]

  const { traces: merged, mergedSegmentCount } = mergeSameNetTraces({
    inputProblem: problem,
    traces,
    netLabelPlacements: [],
  })

  // At least one segment should have been moved onto the shared coordinate
  expect(mergedSegmentCount).toBeGreaterThan(0)

  // The two traces should now share a Y coordinate on their long runs
  const upperYs = merged[0]!.tracePath.map((p) => p.y)
  const lowerYs = merged[1]!.tracePath.map((p) => p.y)
  const shared = lowerYs.some((ly) =>
    upperYs.some((uy) => Math.abs(ly - uy) < 1e-6),
  )
  expect(shared).toBe(true)
})

test("does not merge cross-net traces", () => {
  const traces: SolvedTracePath[] = [
    {
      ...createTrace("upper", [
        { x: -1, y: 2 },
        { x: -2, y: 2 },
        { x: -2, y: 1 },
        { x: 2, y: 1 },
      ]),
      globalConnNetId: "net-a",
    },
    {
      ...createTrace("lower", [
        { x: -1, y: 0 },
        { x: -0.5, y: 0 },
        { x: -0.5, y: 1.001 },
        { x: 2, y: 1.001 },
      ]),
      globalConnNetId: "net-b",
    },
  ]

  const { traces: merged, mergedSegmentCount } = mergeSameNetTraces({
    inputProblem: problem,
    traces,
    netLabelPlacements: [],
  })

  expect(mergedSegmentCount).toBe(0)
  // Traces unchanged
  expect(merged[1]!.tracePath[2]!.y).toBe(1.001)
})
