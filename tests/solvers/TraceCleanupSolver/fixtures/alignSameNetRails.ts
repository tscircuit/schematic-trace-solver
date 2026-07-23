import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignSameNetRails } from "lib/solvers/TraceCleanupSolver/alignSameNetRails"
import type { InputPin, InputProblem } from "lib/types/InputProblem"

export const verticalProblem: InputProblem = {
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

export const getVerticalPin = (
  pinId: string,
): InputPin & { chipId: string } => {
  const inputPin = verticalProblem.chips[0]!.pins.find(
    (candidate) => candidate.pinId === pinId,
  )!
  return { ...inputPin, chipId: "U1" }
}

export const createTrace = (
  mspPairId: string,
  tracePath: Array<{ x: number; y: number }>,
  pins: SolvedTracePath["pins"],
  globalConnNetId = "power-net",
): SolvedTracePath => ({
  mspPairId,
  globalConnNetId,
  dcConnNetId: mspPairId,
  userNetId: "POWER",
  pins,
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: pins.map((item) => item.pinId),
})

export const getVerticalRailTraces = () => [
  createTrace(
    "upper",
    [
      { x: -1, y: 2 },
      { x: -2, y: 2 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ],
    [getVerticalPin("U1.1"), getVerticalPin("U1.2")],
  ),
  createTrace(
    "lower",
    [
      { x: -1, y: 0 },
      { x: -3, y: 0 },
      { x: -3, y: -2 },
      { x: -1, y: -2 },
    ],
    [getVerticalPin("U1.2"), getVerticalPin("U1.3")],
  ),
]

export const align = (
  traces: SolvedTracePath[],
  options: {
    inputProblem?: InputProblem
    netLabelPlacements?: NetLabelPlacement[]
    eligibleTraceIds?: ReadonlySet<string>
  } = {},
) =>
  alignSameNetRails({
    inputProblem: options.inputProblem ?? verticalProblem,
    traces,
    netLabelPlacements: options.netLabelPlacements ?? [],
    eligibleTraceIds:
      options.eligibleTraceIds ??
      new Set(traces.map((trace) => trace.mspPairId)),
  })
