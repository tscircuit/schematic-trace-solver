import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"

for (const facing of ["x+", "x-", "y+", "y-"] as FacingDirection[]) {
  test.each([false, true])(
    `recovers pin enclosed near outward edge of overlapping neighbor chip facing ${facing} (reversed=%s)`,
    (reversed) => {
      const outward = dir(facing)
      const problem: InputProblem = {
        chips: [
          {
            chipId: "enclosedChip",
            center: { x: 0, y: 0 },
            width: 0.6,
            height: 0.6,
            pins: [
              {
                pinId: "enclosedPin",
                x: 0.3 * outward.x,
                y: 0.3 * outward.y,
                _facingDirection: facing,
              },
            ],
          },
          {
            chipId: "overlappingNeighbor",
            center: {
              x: 0.02 * outward.x - 0.35 * outward.y,
              y: 0.02 * outward.y + 0.35 * outward.x,
            },
            width: Math.abs(outward.x) > 0 ? 0.64 : 0.8,
            height: Math.abs(outward.y) > 0 ? 0.64 : 0.8,
            pins: [],
          },
          {
            chipId: "targetChip",
            center: {
              x: 0.8 * outward.y,
              y: -0.8 * outward.x,
            },
            width: 0.6,
            height: 0.6,
            pins: [
              {
                pinId: "targetPin",
                x: 0.3 * outward.x + 0.8 * outward.y,
                y: 0.3 * outward.y - 0.8 * outward.x,
                _facingDirection: facing,
              },
            ],
          },
        ],
        directConnections: [{ pinIds: ["enclosedPin", "targetPin"] }],
        netConnections: [],
        availableNetLabelOrientations: {},
        maxMspPairDistance: 3,
      }

      const pins: MspConnectionPair["pins"] = [
        { ...problem.chips[0]!.pins[0]!, chipId: "enclosedChip" },
        { ...problem.chips[2]!.pins[0]!, chipId: "targetChip" },
      ]
      if (reversed) pins.reverse()

      const solver = new UnroutedTraceRecoverySolver({
        inputProblem: problem,
        failedConnectionPairs: [
          {
            mspPairId: "enclosedPin-targetPin",
            dcConnNetId: "rail",
            globalConnNetId: "rail",
            pins,
          },
        ],
        alreadySolvedTraces: [],
      })
      solver.solve()

      expect(solver.solvedUnroutedTraces).toHaveLength(1)
      expect(solver.solvedUnroutedTraces[0]!.pinIds).toEqual(
        pins.map((pin) => pin.pinId),
      )
    },
  )
}

test("rejects terminal exit when enclosed pin sits on inward half of foreign chip", () => {
  const problem: InputProblem = {
    chips: [
      {
        chipId: "sourceChip",
        center: { x: 0, y: 0.4 },
        width: 0.4,
        height: 0.4,
        pins: [
          {
            pinId: "sourcePin",
            x: 0,
            y: 0.2,
            _facingDirection: "y-",
          },
        ],
      },
      {
        chipId: "blockingNeighbor",
        center: { x: 0, y: -0.1 },
        width: 0.8,
        height: 0.8,
        pins: [],
      },
      {
        chipId: "targetChip",
        center: { x: 1.2, y: 0.4 },
        width: 0.4,
        height: 0.4,
        pins: [
          {
            pinId: "targetPin",
            x: 1.2,
            y: 0.2,
            _facingDirection: "y-",
          },
        ],
      },
    ],
    directConnections: [{ pinIds: ["sourcePin", "targetPin"] }],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 3,
  }

  const solver = new UnroutedTraceRecoverySolver({
    inputProblem: problem,
    failedConnectionPairs: [
      {
        mspPairId: "sourcePin-targetPin",
        dcConnNetId: "rail",
        globalConnNetId: "rail",
        pins: [
          { ...problem.chips[0]!.pins[0]!, chipId: "sourceChip" },
          { ...problem.chips[2]!.pins[0]!, chipId: "targetChip" },
        ],
      },
    ],
    alreadySolvedTraces: [],
  })
  solver.solve()

  expect(solver.solvedUnroutedTraces).toHaveLength(0)
})

test("records joined host component pins when junction recovery lands on a disconnected same-net island", () => {
  const problem: InputProblem = {
    chips: [
      {
        chipId: "leftA",
        center: { x: -2.5, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [{ pinId: "L1", x: -2.5, y: -0.2, _facingDirection: "y-" }],
      },
      {
        chipId: "leftB",
        center: { x: -1.5, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [{ pinId: "L2", x: -1.5, y: -0.2, _facingDirection: "y-" }],
      },
      {
        chipId: "blocker",
        center: { x: -0.4, y: -0.4 },
        width: 0.9,
        height: 1.6,
        pins: [],
      },
      {
        chipId: "rightUnconnected",
        center: { x: 0.6, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [{ pinId: "R1", x: 0.6, y: -0.2, _facingDirection: "y-" }],
      },
      {
        chipId: "rightA",
        center: { x: 1.4, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [{ pinId: "R2", x: 1.4, y: -0.2, _facingDirection: "y-" }],
      },
      {
        chipId: "rightB",
        center: { x: 2.2, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [{ pinId: "R3", x: 2.2, y: -0.2, _facingDirection: "y-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "PGND",
        pinIds: ["L1", "L2", "R1", "R2", "R3"],
      },
    ],
    availableNetLabelOrientations: {
      PGND: ["y-"],
    },
    maxMspPairDistance: 2.5,
  }

  const globalConnNetId =
    getConnectivityMapsFromInputProblem(problem).netConnMap.getNetConnectedToId(
      "PGND",
    )!

  const recoverySolver = new UnroutedTraceRecoverySolver({
    inputProblem: problem,
    failedConnectionPairs: [
      {
        mspPairId: "R1-L2",
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        pins: [
          { ...problem.chips[3]!.pins[0]!, chipId: "rightUnconnected" },
          { ...problem.chips[1]!.pins[0]!, chipId: "leftB" },
        ],
      },
    ],
    alreadySolvedTraces: [
      {
        mspPairId: "L1-L2",
        mspConnectionPairIds: ["L1-L2"],
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        pins: [
          { ...problem.chips[0]!.pins[0]!, chipId: "leftA" },
          { ...problem.chips[1]!.pins[0]!, chipId: "leftB" },
        ],
        pinIds: ["L1", "L2"],
        tracePath: [
          { x: -2.5, y: -0.2 },
          { x: -2.5, y: -0.4 },
          { x: -1.5, y: -0.4 },
          { x: -1.5, y: -0.2 },
        ],
      },
      {
        mspPairId: "R2-R3",
        mspConnectionPairIds: ["R2-R3"],
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        pins: [
          { ...problem.chips[4]!.pins[0]!, chipId: "rightA" },
          { ...problem.chips[5]!.pins[0]!, chipId: "rightB" },
        ],
        pinIds: ["R2", "R3"],
        tracePath: [
          { x: 1.4, y: -0.2 },
          { x: 1.4, y: -0.4 },
          { x: 2.2, y: -0.4 },
          { x: 2.2, y: -0.2 },
        ],
      },
    ],
  })
  recoverySolver.solve()

  expect(recoverySolver.solvedUnroutedTraces).toHaveLength(1)
  expect(recoverySolver.solvedUnroutedTraces[0]!.pinIds).toEqual(["R2", "R1"])
  expect(recoverySolver.solvedUnroutedTraces[0]!.pinIds).not.toContain("L2")

  const labelSolver = new NetLabelPlacementSolver({
    inputProblem: problem,
    inputTraceMap: Object.fromEntries(
      recoverySolver
        .getOutput()
        .allTracesMerged.map((trace) => [trace.mspPairId, trace]),
    ),
  })
  labelSolver.solve()
  expect(
    labelSolver.netLabelPlacements.filter((label) => label.netId === "PGND"),
  ).toHaveLength(2)
})
