import { expect, test } from "bun:test"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (direction = 1, reversed = false, sameNet = true) => {
  const point = (x: number, y: number) => ({ x, y: y * direction })
  const orientation = direction === 1 ? ("y-" as const) : ("y+" as const)
  const pin = { pinId: "U.1", chipId: "U", ...point(0.5, 1) }
  const inputProblem: InputProblem = {
    chips: [
      { chipId: "U", center: point(0, 1), width: 1, height: 1, pins: [pin] },
    ],
    directConnections: [],
    netConnections: [{ netId: "supply", pinIds: [pin.pinId] }],
    availableNetLabelOrientations: { supply: [orientation] },
  }
  const connector: SolvedTracePath = {
    mspPairId: "connector",
    mspConnectionPairIds: ["connector"],
    globalConnNetId: "supply",
    dcConnNetId: "supply",
    pins: [pin, pin],
    pinIds: [pin.pinId],
    tracePath: [point(0.5, 1), point(1.5, 1), point(1.5, 0.3)],
  }
  if (reversed) connector.tracePath.reverse()
  const crossingTrace: SolvedTracePath = {
    ...connector,
    mspPairId: "crossing",
    mspConnectionPairIds: ["crossing"],
    globalConnNetId: sameNet ? "supply" : "other",
    pins: [
      { pinId: "other.1", chipId: "other", ...point(1, 0.2) },
      { pinId: "other.2", chipId: "other", ...point(2, 0.2) },
    ],
    pinIds: ["other.1", "other.2"],
    tracePath: [point(1, 0.2), point(2, 0.2)],
  }
  const label: NetLabelPlacement = {
    globalConnNetId: "supply",
    netId: "supply",
    mspConnectionPairIds: [],
    pinIds: [pin.pinId],
    orientation,
    anchorPoint: point(1.5, 0.3),
    center: point(1.5, 0.1),
    width: 0.4,
    height: 0.4,
  }
  return {
    inputProblem,
    traces: [connector, crossingTrace],
    netLabelPlacements: [label],
    netLabelConnectorTraceIds: new Set([connector.mspPairId]),
    onlyOverlappingLabels: true,
  }
}

for (const direction of [1, -1]) {
  for (const reversed of [false, true]) {
    for (const sameNet of [false, true]) {
      test(`shortens a terminal connector: direction=${direction}, reversed=${reversed}, sameNet=${sameNet}`, () => {
        const fixture = createFixture(direction, reversed, sameNet)
        const before = structuredClone(fixture)
        const solver = new RailNetLabelCornerPlacementSolver(fixture)
        solver.solve()
        const output = solver.getOutput()
        const label = output.netLabelPlacements[0]!
        const path = output.traces[0]!.tracePath
        expect(label.anchorPoint.y * direction).toBeGreaterThanOrEqual(0.6)
        expect(label.anchorPoint.y * direction).toBeLessThan(1)
        expect(path[reversed ? 0 : path.length - 1]).toEqual(label.anchorPoint)
        expect(Math.min(...path.map((point) => point.y * direction))).toBe(
          label.anchorPoint.y * direction,
        )
        expect(
          traceCrossesBoundsInterior(
            getRectBounds(label.center, label.width, label.height),
            { crossing: output.traces[1]! },
          ),
        ).toBe(false)
        expect(output.traces[1]).toEqual(before.traces[1])
        expect(fixture).toEqual(before)

        const secondPass = new RailNetLabelCornerPlacementSolver({
          ...fixture,
          ...output,
        })
        secondPass.solve()
        expect(secondPass.getOutput()).toEqual(output)
      })
    }
  }
}

test("shortens a reversed straight connector while retaining a branch", () => {
  const fixture = createFixture()
  const pin = { pinId: "U.1", chipId: "U", x: 1.5, y: 1 }
  fixture.inputProblem.chips[0] = {
    chipId: "U",
    center: { x: 1.5, y: 1.5 },
    width: 1,
    height: 1,
    pins: [pin],
  }
  fixture.traces[0] = {
    ...fixture.traces[0]!,
    pins: [pin, pin],
    tracePath: [{ x: 1.5, y: 0.3 }, pin],
  }
  const branch = {
    ...fixture.traces[1]!,
    mspPairId: "branch",
    tracePath: [
      { x: 1.5, y: 0.9 },
      { x: 2, y: 0.9 },
    ],
  }
  fixture.traces.push(branch)
  const before = structuredClone(fixture)
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath[0]!.y).toBeCloseTo(0.6)
  expect(output.traces[0]!.tracePath.at(-1)).toEqual(pin)
  expect(output.traces[2]).toEqual(branch)
  expect(fixture).toEqual(before)
})

for (const obstacle of [
  "branch",
  "pin",
  "attached label",
  "chip",
  "text",
  "missing provenance",
]) {
  test(`does not shorten past ${obstacle}`, () => {
    const fixture = createFixture()
    if (obstacle === "branch") {
      fixture.traces.push({
        ...fixture.traces[1]!,
        mspPairId: "branch",
        tracePath: [
          { x: 1.5, y: 0.4 },
          { x: 2, y: 0.4 },
        ],
      })
    } else if (obstacle === "pin" || obstacle === "chip") {
      fixture.inputProblem.chips.push({
        chipId: "load",
        center: obstacle === "pin" ? { x: 3, y: 0.4 } : { x: 1.5, y: 0.5 },
        width: 0.1,
        height: 1,
        pins: obstacle === "pin" ? [{ pinId: "load.1", x: 1.5, y: 0.4 }] : [],
      })
    } else if (obstacle === "attached label") {
      fixture.netLabelPlacements.push({
        ...fixture.netLabelPlacements[0]!,
        mspConnectionPairIds: ["connector"],
        anchorPoint: { x: 1.5, y: 0.4 },
        center: { x: 1.7, y: 0.4 },
        orientation: "x+",
        height: 0.1,
      })
    } else if (obstacle === "text") {
      fixture.inputProblem.textBoxes = [
        { center: { x: 1.5, y: 0.5 }, width: 0.1, height: 1, text: "note" },
      ]
    } else {
      fixture.netLabelConnectorTraceIds.clear()
    }
    const solver = new RailNetLabelCornerPlacementSolver(fixture)
    solver.solve()
    expect(solver.getOutput().traces[0]).toEqual(fixture.traces[0])
    expect(solver.getOutput().netLabelPlacements[0]).toEqual(
      fixture.netLabelPlacements[0],
    )
  })
}
