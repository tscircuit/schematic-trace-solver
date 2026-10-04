import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { createTrace } from "./alignSameNetRails"

export const problem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 8,
      pins: [3, 1, -1, -3].map((y, i) => ({
        pinId: `U1.${i + 1}`,
        x: -1,
        y,
        _facingDirection: "x-" as const,
      })),
    },
  ],
  directConnections: [],
  netConnections: [],
  textBoxes: [],
  availableNetLabelOrientations: {},
}

export const getTraces = () =>
  [-2, -2.1, -2.2].map((x, i) => {
    const pins = problem.chips[0]!.pins.slice(i, i + 2).map((pin) => ({
      ...pin,
      chipId: "U1",
    }))
    return createTrace(
      `rail-${i}`,
      [
        { x: -1, y: pins[0]!.y },
        { x, y: pins[0]!.y },
        { x, y: pins[1]!.y },
        { x: -1, y: pins[1]!.y },
      ],
      pins as SolvedTracePath["pins"],
    )
  })

export const labels: NetLabelPlacement[] = [
  {
    globalConnNetId: "power-net",
    netId: "POWER",
    mspConnectionPairIds: ["rail-0"],
    pinIds: ["U1.1", "U1.2"],
    orientation: "x+",
    anchorPoint: { x: -2, y: 2 },
    center: { x: -1.8, y: 2 },
    width: 0.4,
    height: 0.2,
  },
  {
    globalConnNetId: "power-net",
    netId: "POWER",
    mspConnectionPairIds: ["rail-2"],
    pinIds: ["U1.3", "U1.4"],
    orientation: "x+",
    anchorPoint: { x: -2.2, y: -2 },
    center: { x: -2, y: -2 },
    width: 0.4,
    height: 0.2,
  },
]
