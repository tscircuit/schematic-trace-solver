import { expect, test } from "bun:test"
import { SingleNetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
import { SinglePortLabelTraceCollisionSolver } from "lib/solvers/SinglePortLabelTraceCollisionSolver/SinglePortLabelTraceCollisionSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createInputProblem = (params: {
  pinId: string
  pin: { x: number; y: number; facingDirection: "x+" | "x-" | "y+" | "y-" }
  netId: string
  availableOrientations: Array<"x+" | "x-" | "y+" | "y-">
}): InputProblem => ({
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 0.6,
      height: 0.4,
      pins: [
        {
          pinId: params.pinId,
          x: params.pin.x,
          y: params.pin.y,
          _facingDirection: params.pin.facingDirection,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: params.netId,
      pinIds: [params.pinId],
    },
  ],
  availableNetLabelOrientations: {
    [params.netId]: params.availableOrientations,
  },
})

test("single-port labels keep the original placement when there is no trace collision", () => {
  const inputProblem = createInputProblem({
    pinId: "OUT",
    pin: { x: 0.3, y: 0, facingDirection: "x+" },
    netId: "VCC",
    availableOrientations: ["x+"],
  })

  const solver = new SingleNetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
    overlappingSameNetTraceGroup: {
      globalConnNetId: "connectivity_net_vcc",
      netId: "VCC",
      portOnlyPinId: "OUT",
    },
    availableOrientations: ["x+"],
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.netLabelPlacement?.orientation).toBe("x+")
  const originalPlacement = solver.netLabelPlacement!

  const fallbackSolver = new SinglePortLabelTraceCollisionSolver({
    inputProblem,
    inputTraceMap: {},
    netLabelPlacements: [originalPlacement],
  })

  fallbackSolver.solve()

  expect(fallbackSolver.getOutput().netLabelPlacements[0]).toBe(
    originalPlacement,
  )
  expect(fallbackSolver.getOutput().connectorTracePaths).toHaveLength(0)
})

test("single-port label trace collision step upgrades colliding labels to the detached placement", () => {
  const inputProblem = createInputProblem({
    pinId: "GND",
    pin: { x: -0.3, y: 0, facingDirection: "x-" },
    netId: "GND",
    availableOrientations: ["y-"],
  })

  const initialSolver = new SingleNetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
    overlappingSameNetTraceGroup: {
      globalConnNetId: "connectivity_net_gnd",
      netId: "GND",
      portOnlyPinId: "GND",
    },
    availableOrientations: ["y-"],
  })

  initialSolver.solve()

  expect(initialSolver.solved).toBe(true)
  expect(initialSolver.netLabelPlacement?.orientation).toBe("y-")

  const originalPlacement = initialSolver.netLabelPlacement!
  const collidingTraceY = originalPlacement.center.y

  const fallbackSolver = new SinglePortLabelTraceCollisionSolver({
    inputProblem,
    inputTraceMap: {
      colliding_trace: {
        mspPairId: "colliding_trace",
        dcConnNetId: "dc_colliding_trace",
        globalConnNetId: "connectivity_net_other",
        pins: [] as any,
        tracePath: [
          {
            x: originalPlacement.center.x - originalPlacement.width,
            y: collidingTraceY,
          },
          {
            x: originalPlacement.center.x + originalPlacement.width,
            y: collidingTraceY,
          },
        ],
        mspConnectionPairIds: [],
        pinIds: [],
      },
    },
    netLabelPlacements: [originalPlacement],
  })

  fallbackSolver.solve()

  const upgradedPlacement = fallbackSolver.getOutput().netLabelPlacements[0]

  expect(fallbackSolver.solved).toBe(true)
  expect(upgradedPlacement?.orientation).toBe("y-")
  expect(upgradedPlacement?.center.x).toBeLessThan(-0.3)
  expect(fallbackSolver.getOutput().connectorTracePaths).toHaveLength(1)
  expect(
    fallbackSolver.getOutput().connectorTracePaths[0]?.tracePath.length,
  ).toBeGreaterThan(1)
})

test("single-port label trace collision step exposes intermediate progress before solving", () => {
  const inputProblem = createInputProblem({
    pinId: "GND",
    pin: { x: -0.3, y: 0, facingDirection: "x-" },
    netId: "GND",
    availableOrientations: ["y-"],
  })

  const initialSolver = new SingleNetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
    overlappingSameNetTraceGroup: {
      globalConnNetId: "connectivity_net_gnd",
      netId: "GND",
      portOnlyPinId: "GND",
    },
    availableOrientations: ["y-"],
  })

  initialSolver.solve()

  const originalPlacement = initialSolver.netLabelPlacement!
  const collidingTraceY = originalPlacement.center.y

  const fallbackSolver = new SinglePortLabelTraceCollisionSolver({
    inputProblem,
    inputTraceMap: {
      colliding_trace: {
        mspPairId: "colliding_trace",
        dcConnNetId: "dc_colliding_trace",
        globalConnNetId: "connectivity_net_other",
        pins: [] as any,
        tracePath: [
          {
            x: originalPlacement.center.x - originalPlacement.width,
            y: collidingTraceY,
          },
          {
            x: originalPlacement.center.x + originalPlacement.width,
            y: collidingTraceY,
          },
        ],
        mspConnectionPairIds: [],
        pinIds: [],
      },
    },
    netLabelPlacements: [originalPlacement],
  })

  fallbackSolver.step()

  expect(fallbackSolver.solved).toBe(false)
  expect(fallbackSolver.currentPlacement?.pinIds).toEqual(["GND"])

  let sawCandidates = fallbackSolver.testedCandidates.length > 0
  while (!fallbackSolver.solved && !fallbackSolver.failed) {
    fallbackSolver.step()
    sawCandidates ||= fallbackSolver.testedCandidates.length > 0
  }

  expect(sawCandidates).toBe(true)
  expect(fallbackSolver.iterations).toBeGreaterThan(1)
  expect(fallbackSolver.getOutput().netLabelPlacements[0]?.orientation).toBe(
    "y-",
  )
})

test("single-port label placement respects constrained orientations for port-only pins", () => {
  const inputProblem = createInputProblem({
    pinId: "GND",
    pin: { x: -0.3, y: 0, facingDirection: "x-" },
    netId: "GND",
    availableOrientations: ["y-"],
  })

  const initialSolver = new SingleNetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: {},
    overlappingSameNetTraceGroup: {
      globalConnNetId: "connectivity_net_gnd",
      netId: "GND",
      portOnlyPinId: "GND",
    },
    availableOrientations: ["y-"],
  })

  initialSolver.solve()

  expect(initialSolver.solved).toBe(true)
  expect(initialSolver.netLabelPlacement?.orientation).toBe("y-")
})
