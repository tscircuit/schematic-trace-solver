import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"

const FACING_DIRECTIONS: readonly FacingDirection[] = ["x+", "x-", "y+", "y-"]

for (const facing of FACING_DIRECTIONS) {
  test.each([false, true])(
    `recovers pin enclosed near outward edge of overlapping neighbor chip facing ${facing} (reversed=%s)`,
    (reversed) => {
      const outward = dir(facing)
      const enclosedPin = {
        pinId: "enclosedPin",
        x: 0.3 * outward.x,
        y: 0.3 * outward.y,
        _facingDirection: facing,
      }
      const targetPin = {
        pinId: "targetPin",
        x: 0.3 * outward.x + 0.8 * outward.y,
        y: 0.3 * outward.y - 0.8 * outward.x,
        _facingDirection: facing,
      }
      const problem: InputProblem = {
        chips: [
          {
            chipId: "enclosedChip",
            center: { x: 0, y: 0 },
            width: 0.6,
            height: 0.6,
            pins: [enclosedPin],
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
            pins: [targetPin],
          },
        ],
        directConnections: [{ pinIds: ["enclosedPin", "targetPin"] }],
        netConnections: [],
        availableNetLabelOrientations: {},
        maxMspPairDistance: 3,
      }

      const pins: MspConnectionPair["pins"] = reversed
        ? [
            { ...targetPin, chipId: "targetChip" },
            { ...enclosedPin, chipId: "enclosedChip" },
          ]
        : [
            { ...enclosedPin, chipId: "enclosedChip" },
            { ...targetPin, chipId: "targetChip" },
          ]

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
      expect(solver.solvedUnroutedTraces[0]?.pinIds).toEqual(
        pins.map((pin) => pin.pinId),
      )
    },
  )
}

test("rejects terminal exit when enclosed pin sits on inward half of foreign chip", () => {
  const sourcePin = {
    pinId: "sourcePin",
    x: 0,
    y: 0.2,
    _facingDirection: "y-" as const,
  }
  const targetPin = {
    pinId: "targetPin",
    x: 1.2,
    y: 0.2,
    _facingDirection: "y-" as const,
  }
  const problem: InputProblem = {
    chips: [
      {
        chipId: "sourceChip",
        center: { x: 0, y: 0.4 },
        width: 0.4,
        height: 0.4,
        pins: [sourcePin],
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
        pins: [targetPin],
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
          { ...sourcePin, chipId: "sourceChip" },
          { ...targetPin, chipId: "targetChip" },
        ],
      },
    ],
    alreadySolvedTraces: [],
  })
  solver.solve()

  expect(solver.solvedUnroutedTraces).toHaveLength(0)
})
