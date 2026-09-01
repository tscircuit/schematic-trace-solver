import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (mirrorX: number, mirrorY: number, reverse: boolean) => {
  const point = (x: number, y: number) => ({ x: x * mirrorX, y: y * mirrorY })
  const sourceFacing = mirrorX > 0 ? "x+" : "x-"
  const targetFacing = mirrorY > 0 ? "y-" : "y+"
  const sharedPin = {
    pinId: "source.shared",
    chipId: "source",
    ...point(0, 1),
    _facingDirection: sourceFacing,
  } as const
  const adjacentPin = {
    pinId: "source.adjacent",
    chipId: "source",
    ...point(0, 0.8),
    _facingDirection: sourceFacing,
  } as const
  const targetPin = {
    pinId: "target.pin",
    chipId: "target",
    ...point(2, 0.9),
    _facingDirection: targetFacing,
  } as const
  const trace = (
    mspPairId: string,
    pins: SolvedTracePath["pins"],
    tracePath: Array<{ x: number; y: number }>,
  ): SolvedTracePath => ({
    mspPairId,
    dcConnNetId: "ground",
    globalConnNetId: "ground",
    userNetId: "GND",
    pins,
    pinIds: pins.map((pin) => pin.pinId),
    mspConnectionPairIds: [mspPairId],
    tracePath,
  })
  const donorTrace = trace(
    "adjacent-to-shared",
    [adjacentPin, sharedPin],
    [point(0, 0.8), point(0.2, 0.8), point(0.2, 1), point(0, 1)],
  )
  const branchTrace = trace(
    "shared-to-target",
    [sharedPin, targetPin],
    [point(0, 1), point(0.2, 1), point(0.2, 0.7), point(2, 0.7), point(2, 0.9)],
  )
  const traces = [donorTrace, branchTrace]
  if (reverse) {
    traces.reverse()
    for (const item of traces) {
      item.pins.reverse()
      item.pinIds.reverse()
      item.tracePath.reverse()
    }
  }
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "source",
        center: point(-0.2, 0.9),
        width: 0.4,
        height: 0.6,
        pins: [sharedPin, adjacentPin],
      },
      {
        chipId: "target",
        center: point(2, 1.1),
        width: 0.4,
        height: 0.4,
        pins: [targetPin],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  return {
    inputProblem,
    traces,
    point,
    netLabelPlacements: [] as NetLabelPlacement[],
  }
}

for (const mirrorX of [1, -1]) {
  for (const mirrorY of [1, -1]) {
    for (const reverse of [false, true]) {
      test(`aligns a parallel-pin exit (${mirrorX}, ${mirrorY}, reverse=${reverse})`, () => {
        const fixture = createFixture(mirrorX, mirrorY, reverse)
        const result = alignSameNetJunctions(fixture)
        const branch = result.traces.find(
          (trace) => trace.mspPairId === "shared-to-target",
        )!
        const sharedToTargetPath =
          branch.pins[0]!.pinId === "source.shared"
            ? branch.tracePath
            : [...branch.tracePath].reverse()

        expect(result.alignedJunctionCount).toBe(1)
        expect(sharedToTargetPath).toEqual([
          fixture.point(0, 1),
          fixture.point(0.2, 1),
          fixture.point(0.2, 0.8),
          fixture.point(2, 0.8),
          fixture.point(2, 0.9),
        ])
      })
    }
  }
}
