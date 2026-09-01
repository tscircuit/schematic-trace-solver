import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

type Direction = "x+" | "x-" | "y+" | "y-"

const createFixture = (quarterTurns: number, reverse: boolean) => {
  const point = (x: number, y: number) => {
    switch (quarterTurns % 4) {
      case 1:
        return { x: -y, y: x }
      case 2:
        return { x: -x, y: -y }
      case 3:
        return { x: y, y: -x }
      default:
        return { x, y }
    }
  }
  const direction = (value: Direction): Direction => {
    const vectors: Record<Direction, { x: number; y: number }> = {
      "x+": { x: 1, y: 0 },
      "x-": { x: -1, y: 0 },
      "y+": { x: 0, y: 1 },
      "y-": { x: 0, y: -1 },
    }
    const vector = point(vectors[value].x, vectors[value].y)
    return (
      Object.entries(vectors) as Array<[Direction, { x: number; y: number }]>
    ).find(
      ([, candidate]) => candidate.x === vector.x && candidate.y === vector.y,
    )![0]
  }
  const pin = (
    pinId: string,
    chipId: string,
    x: number,
    y: number,
    facing: Direction,
  ): SolvedTracePath["pins"][number] => ({
    pinId,
    chipId,
    ...point(x, y),
    _facingDirection: direction(facing),
  })
  const sharedPin = pin("upper.endpoint", "upper-endpoint", 0, 1, "y+")
  const upperLoadPin = pin("upper.load", "upper-load", 1, 1.3, "x-")
  const returnPin = pin("lower.endpoint", "lower-endpoint", 0, -1, "y+")
  const lowerLoadPin = pin("lower.load", "lower-load", 1, -0.7, "x-")
  const trace = (
    mspPairId: string,
    pins: SolvedTracePath["pins"],
    coordinates: Array<[number, number]>,
  ): SolvedTracePath => ({
    mspPairId,
    dcConnNetId: "supply",
    globalConnNetId: "supply",
    userNetId: "PWR",
    pins,
    pinIds: pins.map((pin) => pin.pinId),
    mspConnectionPairIds: [mspPairId],
    tracePath: coordinates.map(([x, y]) => point(x, y)),
  })
  const traces = [
    trace(
      "upper-load",
      [sharedPin, upperLoadPin],
      [
        [0, 1],
        [0, 1.3],
        [1, 1.3],
      ],
    ),
    trace(
      "endpoint-bus",
      [returnPin, sharedPin],
      [
        [0, -1],
        [0, -0.8],
        [-1, -0.8],
        [-1, 1.2],
        [0, 1.2],
        [0, 1],
      ],
    ),
    trace(
      "lower-load",
      [lowerLoadPin, returnPin],
      [
        [1, -0.7],
        [0, -0.7],
        [0, -1],
      ],
    ),
  ]
  if (reverse) {
    traces.reverse()
    for (const item of traces) {
      item.pins.reverse()
      item.pinIds.reverse()
      item.tracePath.reverse()
    }
  }

  const inputProblem: InputProblem = {
    chips: [sharedPin, upperLoadPin, returnPin, lowerLoadPin].map((item) => {
      const facingVector = {
        "x+": { x: 1, y: 0 },
        "x-": { x: -1, y: 0 },
        "y+": { x: 0, y: 1 },
        "y-": { x: 0, y: -1 },
      }[item._facingDirection!]
      return {
        chipId: item.chipId,
        center: {
          x: item.x - facingVector.x * 0.1,
          y: item.y - facingVector.y * 0.1,
        },
        width: 0.2,
        height: 0.2,
        pins: [item],
      }
    }),
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

for (const quarterTurns of [0, 1, 2, 3]) {
  for (const reverse of [false, true]) {
    test(`aligns both perpendicular endpoint-bus rails (turns=${quarterTurns}, reverse=${reverse})`, () => {
      const fixture = createFixture(quarterTurns, reverse)
      const result = alignSameNetJunctions(fixture)
      const bus = result.traces.find(
        (trace) => trace.mspPairId === "endpoint-bus",
      )!
      const lowerToUpperPath =
        bus.pins[0]!.pinId === "lower.endpoint"
          ? bus.tracePath
          : [...bus.tracePath].reverse()

      expect(result.alignedJunctionCount).toBe(1)
      expect(lowerToUpperPath).toEqual([
        fixture.point(0, -1),
        fixture.point(0, -0.7),
        fixture.point(-1, -0.7),
        fixture.point(-1, 1.3),
        fixture.point(0, 1.3),
        fixture.point(0, 1),
      ])
      expect(
        alignSameNetJunctions({ ...fixture, traces: result.traces }).traces,
      ).toEqual(result.traces)
    })
  }
}

test("keeps an endpoint rail offset when its aligned extension crosses a component", () => {
  const fixture = createFixture(0, false)
  const originalBus = structuredClone(
    fixture.traces.find((trace) => trace.mspPairId === "endpoint-bus")!,
  )
  fixture.inputProblem.chips.push({
    chipId: "obstacle",
    center: { x: -0.5, y: 1.3 },
    width: 0.1,
    height: 0.1,
    pins: [],
  })
  const result = alignSameNetJunctions(fixture)
  expect(
    result.traces.find((trace) => trace.mspPairId === "endpoint-bus"),
  ).toEqual(originalBus)
})
