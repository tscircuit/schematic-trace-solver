import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (mirror = 1, direction = 1, reversed = false) => {
  const point = (x: number, y: number) => ({ x: x * mirror, y: y * direction })
  const pins = [
    { pinId: "U.1", chipId: "U", ...point(0, 0) },
    { pinId: "U.2", chipId: "U", ...point(0, -0.2) },
  ] as const
  const orientation = direction === 1 ? ("y+" as const) : ("y-" as const)
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U",
        center: point(-1, 0),
        width: 2,
        height: 2,
        pins: [...pins],
      },
    ],
    directConnections: [],
    netConnections: [{ netId: "supply", pinIds: pins.map((pin) => pin.pinId) }],
    availableNetLabelOrientations: { supply: [orientation] },
  }
  const rail: SolvedTracePath = {
    mspPairId: "rail",
    mspConnectionPairIds: ["rail"],
    globalConnNetId: "supply",
    dcConnNetId: "supply",
    pins: [...pins],
    pinIds: pins.map((pin) => pin.pinId),
    tracePath: [point(0, 0), point(0.2, 0), point(0.2, -0.2), point(0, -0.2)],
  }
  const connector: SolvedTracePath = {
    ...rail,
    mspPairId: "connector",
    mspConnectionPairIds: ["connector"],
    tracePath: [
      point(0.2, 0),
      point(0.5, 0),
      point(0.5, -0.15),
      point(1.5, -0.15),
      point(1.5, 0),
      point(2, 0),
    ],
  }
  if (reversed) {
    rail.tracePath.reverse()
    connector.tracePath.reverse()
  }
  const label: NetLabelPlacement = {
    globalConnNetId: "supply",
    netId: "supply",
    mspConnectionPairIds: ["rail"],
    pinIds: rail.pinIds,
    orientation,
    anchorPoint: point(2, 0),
    center: point(2, 0.2),
    width: 0.4,
    height: 0.4,
  }
  const blockingLabel: NetLabelPlacement = {
    ...label,
    globalConnNetId: "other",
    netId: "other",
    mspConnectionPairIds: [],
    pinIds: [],
    anchorPoint: point(1, 0.1),
    center: point(1, 0.1),
    width: 0.4,
    height: 0.4,
  }
  return {
    inputProblem,
    traces: [rail, connector],
    originalTraces: [rail, connector],
    netLabelPlacements: [label, blockingLabel],
    netLabelConnectorTraceIds: new Set([connector.mspPairId]),
    onlyOverlappingLabels: true,
  }
}

for (const mirror of [1, -1]) {
  for (const direction of [1, -1]) {
    for (const reversed of [false, true]) {
      test(`reattaches to the clear rail corner, mirror=${mirror}, direction=${direction}, reversed=${reversed}`, () => {
        const fixture = createFixture(mirror, direction, reversed)
        const before = structuredClone(fixture)
        const solver = new RailNetLabelCornerPlacementSolver(fixture)
        solver.solve()
        const output = solver.getOutput()
        expect(output.traces[1]!.tracePath).toEqual([
          { x: 0.2 * mirror, y: -0.2 * direction },
          { x: 2 * mirror, y: -0.2 * direction },
          fixture.netLabelPlacements[0]!.anchorPoint,
        ])
        expect(output.traces[0]).toEqual(before.traces[0])
        expect(output.netLabelPlacements).toEqual(before.netLabelPlacements)
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

for (const obstacle of [
  "chip",
  "text",
  "label",
  "parallel trace",
  "new crossing",
  "branch",
  "pin",
  "attached label",
  "unconnected rail",
  "missing provenance",
]) {
  test(`preserves the connector with ${obstacle}`, () => {
    const fixture = createFixture()
    if (obstacle === "chip" || obstacle === "pin") {
      fixture.inputProblem.chips.push({
        chipId: "load",
        center: { x: 1, y: -0.3 },
        width: 0.2,
        height: 0.3,
        pins: obstacle === "pin" ? [{ pinId: "load.1", x: 1, y: -0.15 }] : [],
      })
    } else if (obstacle === "text") {
      fixture.inputProblem.textBoxes = [
        { center: { x: 1, y: -0.2 }, width: 0.2, height: 0.08, text: "note" },
      ]
    } else if (obstacle === "label" || obstacle === "attached label") {
      fixture.netLabelPlacements.push({
        ...fixture.netLabelPlacements[0]!,
        globalConnNetId: "extra",
        mspConnectionPairIds:
          obstacle === "attached label" ? ["connector"] : [],
        pinIds: [],
        anchorPoint: { x: 1.3, y: -0.15 },
        center: { x: 1.3, y: -0.2 },
        width: 0.2,
        height: 0.08,
      })
    } else if (obstacle === "missing provenance") {
      fixture.netLabelConnectorTraceIds.clear()
    } else if (obstacle === "unconnected rail") {
      fixture.traces[0] = {
        ...fixture.traces[0]!,
        tracePath: fixture.traces[0]!.tracePath.map((point) => ({
          x: point.x,
          y: point.y - 1,
        })),
      }
    } else {
      fixture.traces.push({
        ...fixture.traces[0]!,
        mspPairId: "other",
        globalConnNetId: obstacle === "branch" ? "supply" : "other",
        tracePath:
          obstacle === "parallel trace"
            ? [
                { x: 0.8, y: -0.2 },
                { x: 1.2, y: -0.2 },
              ]
            : [
                { x: 1, y: obstacle === "branch" ? -0.15 : -0.18 },
                { x: 1, y: -1 },
              ],
      })
    }
    const solver = new RailNetLabelCornerPlacementSolver(fixture)
    solver.solve()
    expect(solver.getOutput().traces[1]).toEqual(fixture.traces[1])
    expect(solver.getOutput().netLabelPlacements[0]).toEqual(
      fixture.netLabelPlacements[0],
    )
  })
}
