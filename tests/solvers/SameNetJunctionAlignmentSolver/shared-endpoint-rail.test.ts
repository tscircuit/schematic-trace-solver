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
  const sharedPin = pin("source.shared", "source", 0, 0, "x+")
  const donorPin = pin("donor.pin", "donor", 0.2, 1, "y-")
  const targetPin = pin("target.pin", "target", 2, -1, "x-")
  const trace = (
    mspPairId: string,
    pins: SolvedTracePath["pins"],
    coordinates: Array<[number, number]>,
  ): SolvedTracePath => ({
    mspPairId,
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    userNetId: "SIGNAL",
    pins,
    pinIds: pins.map((item) => item.pinId),
    mspConnectionPairIds: [mspPairId],
    tracePath: coordinates.map(([x, y]) => point(x, y)),
  })
  const donorTrace = trace(
    "donor",
    [sharedPin, donorPin],
    [
      [0, 0],
      [0.2, 0],
      [0.2, 1],
    ],
  )
  const branchTrace = trace(
    "branch",
    [sharedPin, targetPin],
    [
      [0, 0],
      [0.5, 0],
      [0.5, -1],
      [2, -1],
    ],
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
        center: point(-0.1, 0),
        width: 0.2,
        height: 0.2,
        pins: [sharedPin],
      },
      {
        chipId: "donor",
        center: point(0.2, 1.1),
        width: 0.2,
        height: 0.2,
        pins: [donorPin],
      },
      {
        chipId: "target",
        center: point(2.1, -1),
        width: 0.2,
        height: 0.2,
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

for (const quarterTurns of [0, 1, 2, 3]) {
  for (const reverse of [false, true]) {
    test(`aligns a shared-endpoint rail (turns=${quarterTurns}, reverse=${reverse})`, () => {
      const fixture = createFixture(quarterTurns, reverse)
      const result = alignSameNetJunctions(fixture)
      const branch = result.traces.find(
        (trace) => trace.mspPairId === "branch",
      )!
      const sharedToTarget =
        branch.pins[0]!.pinId === "source.shared"
          ? branch.tracePath
          : [...branch.tracePath].reverse()

      expect(result.alignedJunctionCount).toBe(1)
      expect(sharedToTarget).toEqual([
        fixture.point(0, 0),
        fixture.point(0.2, 0),
        fixture.point(0.2, -1),
        fixture.point(2, -1),
      ])
    })
  }
}

test("keeps a shared-endpoint rail offset when the aligned rail hits a component", () => {
  const fixture = createFixture(0, false)
  const originalBranch = structuredClone(
    fixture.traces.find((trace) => trace.mspPairId === "branch")!,
  )
  fixture.inputProblem.chips.push({
    chipId: "obstacle",
    center: { x: 0.2, y: -0.5 },
    width: 0.1,
    height: 0.1,
    pins: [],
  })

  const result = alignSameNetJunctions(fixture)
  expect(result.traces.find((trace) => trace.mspPairId === "branch")).toEqual(
    originalBranch,
  )
})

test("keeps a shared-endpoint rail offset when the aligned rail hits another net label", () => {
  const fixture = createFixture(0, false)
  const originalBranch = structuredClone(
    fixture.traces.find((trace) => trace.mspPairId === "branch")!,
  )
  fixture.netLabelPlacements.push({
    globalConnNetId: "other-net",
    netId: "OTHER",
    mspConnectionPairIds: [],
    pinIds: [],
    orientation: "x+",
    anchorPoint: { x: 0.2, y: -0.5 },
    center: { x: 0.3, y: -0.5 },
    width: 0.2,
    height: 0.2,
  })

  const result = alignSameNetJunctions(fixture)
  expect(result.traces.find((trace) => trace.mspPairId === "branch")).toEqual(
    originalBranch,
  )
})

test("keeps a shared-endpoint rail offset when its moved label would hit another trace", () => {
  const fixture = createFixture(0, false)
  const originalBranch = structuredClone(
    fixture.traces.find((trace) => trace.mspPairId === "branch")!,
  )
  fixture.netLabelPlacements.push({
    globalConnNetId: "signal",
    dcConnNetId: "signal",
    netId: "SIGNAL",
    mspConnectionPairIds: ["branch"],
    pinIds: ["source.shared", "target.pin"],
    orientation: "x+",
    anchorPoint: { x: 0.5, y: -0.5 },
    center: { x: 0.6, y: -0.5 },
    width: 0.2,
    height: 0.2,
  })
  fixture.traces.push({
    ...structuredClone(originalBranch),
    mspPairId: "foreign",
    dcConnNetId: "foreign",
    globalConnNetId: "foreign",
    userNetId: "FOREIGN",
    mspConnectionPairIds: ["foreign"],
    tracePath: [
      { x: 0.35, y: -0.55 },
      { x: 0.35, y: -0.45 },
    ],
  })

  const result = alignSameNetJunctions(fixture)
  expect(result.traces.find((trace) => trace.mspPairId === "branch")).toEqual(
    originalBranch,
  )
})

test("moves a generated connector junction with its aligned host trace", () => {
  const fixture = createFixture(0, false)
  fixture.traces.push({
    ...structuredClone(
      fixture.traces.find((trace) => trace.mspPairId === "branch")!,
    ),
    mspPairId: "available-net-orientation-0-SIGNAL",
    mspConnectionPairIds: ["available-net-orientation-0-SIGNAL"],
    tracePath: [
      { x: 0.5, y: -0.5 },
      { x: 0.8, y: -0.5 },
    ],
  })
  fixture.netLabelPlacements.push({
    globalConnNetId: "signal",
    dcConnNetId: "signal",
    netId: "SIGNAL",
    mspConnectionPairIds: ["branch"],
    pinIds: ["source.shared", "target.pin"],
    orientation: "x+",
    anchorPoint: { x: 0.8, y: -0.5 },
    center: { x: 0.9, y: -0.5 },
    width: 0.2,
    height: 0.2,
  })

  const result = alignSameNetJunctions(fixture)
  const branch = result.traces.find((trace) => trace.mspPairId === "branch")!
  const connector = result.traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!

  expect(branch.tracePath[1]!.x).toBe(0.2)
  expect(connector.tracePath[0]).toEqual({ x: 0.2, y: -0.5 })
  expect(connector.tracePath[1]).toEqual({ x: 0.8, y: -0.5 })
  expect(result.netLabelPlacements[0]!.anchorPoint).toEqual({ x: 0.8, y: -0.5 })
})
