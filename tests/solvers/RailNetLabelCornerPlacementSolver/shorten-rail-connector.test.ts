import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (mirror = 1, direction = 1, reversed = false) => {
  const point = (x: number, y: number) => ({ x: x * mirror, y: y * direction })
  const pins = [0, 0.4].map((y, index) => ({
    pinId: `U.${index}`,
    chipId: "U",
    ...point(0, y),
  }))
  const orientation = direction === 1 ? ("y-" as const) : ("y+" as const)
  const inputProblem: InputProblem = {
    chips: [
      { chipId: "U", center: point(1, 0.2), width: 2, height: 1.4, pins },
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
    pins: [pins[0]!, pins[1]!],
    pinIds: pins.map((pin) => pin.pinId),
    tracePath: [point(0, 0), point(-0.1, 0), point(-0.1, 0.4), point(0, 0.4)],
  }
  const connector: SolvedTracePath = {
    ...rail,
    mspPairId: "connector",
    mspConnectionPairIds: ["connector"],
    tracePath: [
      point(-0.1, 0),
      point(-1, 0),
      point(-1, -0.6),
      point(-0.8, -0.6),
      point(-0.8, -0.5),
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
    anchorPoint: point(-0.8, -0.5),
    center: point(-0.8, -0.7),
    width: 0.4,
    height: 0.4,
  }
  const blockingLabel: NetLabelPlacement = {
    ...label,
    globalConnNetId: "signal",
    netId: "signal",
    mspConnectionPairIds: [],
    pinIds: [],
    anchorPoint: point(0, -0.2),
    center: point(-0.45, -0.2),
    width: 0.9,
    height: 0.2,
    orientation: "x-",
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
      test(`ends a detoured connector at a clear corner, mirror=${mirror}, direction=${direction}, reversed=${reversed}`, () => {
        const fixture = createFixture(mirror, direction, reversed)
        const before = structuredClone(fixture)
        const solver = new RailNetLabelCornerPlacementSolver(fixture)
        solver.solve()
        const output = solver.getOutput()
        const path = [
          { x: -0.1 * mirror, y: 0 * direction },
          { x: -1 * mirror, y: 0 * direction },
          { x: -1 * mirror, y: -0.6 * direction },
        ]
        expect(output.traces[1]!.tracePath).toEqual(
          reversed ? path.toReversed() : path,
        )
        expect(output.netLabelPlacements[0]!.anchorPoint).toEqual(path.at(-1)!)
        expect(output.netLabelPlacements[0]!.mspConnectionPairIds).toEqual([
          "connector",
        ])
        expect(output.traces[0]).toEqual(before.traces[0])
        expect(output.netLabelPlacements[1]).toEqual(
          before.netLabelPlacements[1],
        )
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
  "trace",
  "branch",
  "pin",
  "attached label",
  "missing provenance",
]) {
  test(`preserves a detoured connector with ${obstacle}`, () => {
    const fixture = createFixture()
    const bounds = { center: { x: -1, y: -0.8 }, width: 0.2, height: 0.2 }
    if (obstacle === "chip" || obstacle === "pin") {
      fixture.inputProblem.chips.push({
        chipId: "load",
        ...bounds,
        ...(obstacle === "pin" ? { center: { x: -0.9, y: -1.5 } } : {}),
        pins: obstacle === "pin" ? [{ pinId: "load.1", x: -0.9, y: -0.6 }] : [],
      })
    } else if (obstacle === "text") {
      fixture.inputProblem.textBoxes = [{ ...bounds, text: "note" }]
    } else if (obstacle === "label" || obstacle === "attached label") {
      fixture.netLabelPlacements.push({
        ...fixture.netLabelPlacements[0]!,
        ...bounds,
        mspConnectionPairIds:
          obstacle === "attached label" ? ["connector"] : [],
        anchorPoint: { x: -0.9, y: -0.6 },
        ...(obstacle === "attached label"
          ? {
              anchorPoint: { x: -0.8, y: -0.5 },
              center: { x: -0.6, y: -0.5 },
              width: 0.4,
              height: 0.1,
              orientation: "x+" as const,
            }
          : {}),
      })
    } else if (obstacle === "missing provenance") {
      fixture.netLabelConnectorTraceIds.clear()
    } else {
      fixture.traces.push({
        ...fixture.traces[0]!,
        mspPairId: "other",
        globalConnNetId: obstacle === "branch" ? "supply" : "other",
        tracePath: [
          { x: -0.9, y: -0.6 },
          { x: -0.9, y: -1 },
        ],
      })
    }
    const solver = new RailNetLabelCornerPlacementSolver(fixture)
    solver.solve()
    expect(solver.getOutput().traces[1]).toEqual(fixture.traces[1])
    if (obstacle !== "missing provenance") {
      expect(solver.getOutput().netLabelPlacements[0]).toEqual(
        fixture.netLabelPlacements[0],
      )
    }
  })
}
