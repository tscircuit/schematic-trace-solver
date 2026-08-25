import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { align, createTrace } from "./fixtures/alignSameNetRails"

test("aligns a chain of rails between separate components", () => {
  const pinDefinitions = [
    { pinId: "A.1", chipId: "A", x: 0, y: 0 },
    { pinId: "B.1", chipId: "B", x: 1, y: 0 },
    { pinId: "C.1", chipId: "C", x: 2, y: 0 },
    { pinId: "D.1", chipId: "D", x: 3, y: -0.1 },
  ] as const
  type PinId = (typeof pinDefinitions)[number]["pinId"]
  const inputProblem: InputProblem = {
    chips: pinDefinitions.map((pin) => ({
      chipId: pin.chipId,
      center: { x: pin.x, y: 0.5 },
      width: 0.4,
      height: 1,
      pins: [
        {
          pinId: pin.pinId,
          x: pin.x,
          y: pin.y,
          _facingDirection: "y-" as const,
        },
      ],
    })),
    directConnections: [],
    netConnections: [],
    textBoxes: [],
    availableNetLabelOrientations: {},
  }
  const pinById = new Map(
    pinDefinitions.map((pin) => [
      pin.pinId,
      { ...pin, _facingDirection: "y-" as const },
    ]),
  )
  const getPin = (pinId: PinId) => pinById.get(pinId)!
  const createRail = (
    traceId: string,
    firstPinId: PinId,
    secondPinId: PinId,
    railY: number,
  ) => {
    const firstPin = getPin(firstPinId)
    const secondPin = getPin(secondPinId)
    return createTrace(
      traceId,
      [
        { x: firstPin.x, y: firstPin.y },
        { x: firstPin.x, y: railY },
        { x: secondPin.x, y: railY },
        { x: secondPin.x, y: secondPin.y },
      ],
      [firstPin, secondPin] as SolvedTracePath["pins"],
    )
  }
  const traces = [
    createRail("a-b", "B.1", "A.1", -0.2),
    createRail("b-c", "C.1", "B.1", -0.2),
    createRail("c-d", "D.1", "C.1", -0.3),
  ]
  const labels: NetLabelPlacement[] = [
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["c-d"],
      pinIds: ["D.1", "C.1"],
      orientation: "y-",
      anchorPoint: { x: 3, y: -0.3 },
      center: { x: 3, y: -0.5 },
      width: 0.4,
      height: 0.2,
    },
  ]

  const result = align(traces, {
    inputProblem,
    netLabelPlacements: labels,
  })

  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.traces[2]!.tracePath).toEqual([
    { x: 3, y: -0.1 },
    { x: 3, y: -0.2 },
    { x: 2, y: -0.2 },
    { x: 2, y: 0 },
  ])
  expect(result.netLabelPlacements[0]!.anchorPoint).toEqual({ x: 3, y: -0.2 })
  expect(result.netLabelPlacements[0]!.center).toEqual({ x: 3, y: -0.4 })
})
