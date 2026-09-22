import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (direction = 1, mirror = 1) => {
  const point = (x: number, y: number) => ({ x: x * mirror, y: y * direction })
  const pins = [0, 2, 4].map((y, index) => ({
    pinId: `U.${index}`,
    chipId: "U",
    ...point(2, y),
    _facingDirection: mirror === 1 ? ("x-" as const) : ("x+" as const),
  }))
  const orientation = direction === 1 ? ("y+" as const) : ("y-" as const)
  const inputProblem: InputProblem = {
    chips: [{ chipId: "U", center: point(3, 2), width: 2, height: 6, pins }],
    directConnections: [],
    netConnections: [{ netId: "supply", pinIds: pins.map((pin) => pin.pinId) }],
    availableNetLabelOrientations: { supply: [orientation] },
  }
  const traces: SolvedTracePath[] = [0, 1].map((index) => ({
    mspPairId: `rail${index}`,
    mspConnectionPairIds: [`rail${index}`],
    globalConnNetId: "supply",
    dcConnNetId: "supply",
    pins: [pins[index]!, pins[index + 1]!],
    pinIds: [pins[index]!.pinId, pins[index + 1]!.pinId],
    tracePath: [
      point(2, index * 2),
      point(0, index * 2),
      point(0, index * 2 + 2),
      point(2, index * 2 + 2),
    ],
  }))
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "supply",
      dcConnNetId: "supply",
      netId: "supply",
      mspConnectionPairIds: ["rail0"],
      pinIds: [...traces[0]!.pinIds],
      orientation,
      anchorPoint: point(0, 2),
      center: point(0, 2.2),
      width: 0.6,
      height: 0.4,
    },
  ]
  return {
    inputProblem,
    traces,
    netLabelPlacements,
  }
}

for (const direction of [1, -1]) {
  for (const mirror of [1, -1]) {
    test(`moves a crossed rail label onto its joined trace, direction=${direction}, mirror=${mirror}`, () => {
      const fixture = createFixture(direction, mirror)
      const before = structuredClone(fixture)
      const solver = new RailNetLabelCornerPlacementSolver(fixture)
      solver.solve()

      const output = solver.getOutput()
      const label = output.netLabelPlacements[0]!
      expect(label.anchorPoint).toEqual({ x: 0 * mirror, y: 4 * direction })
      expect(label.mspConnectionPairIds).toEqual(["rail1"])
      expect(label.pinIds).toEqual(fixture.traces[1]!.pinIds)
      expect(label.globalConnNetId).toBe("supply")
      expect(
        tracePathContainsPoint(output.traces[1]!.tracePath, label.anchorPoint),
      ).toBe(true)
      expect(output.traces).toEqual(before.traces)
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

test("preserves a label already at a clear rail corner", () => {
  const fixture = createFixture()
  fixture.traces.splice(1)
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})

test("does not move the label to a blocked outer corner", () => {
  const fixture = createFixture()
  fixture.inputProblem.textBoxes = [
    { center: { x: 0, y: 4.2 }, width: 1, height: 0.4, text: "annotation" },
  ]
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("does not attach the label to an intersecting trace on another net", () => {
  const fixture = createFixture()
  fixture.traces[1]!.globalConnNetId = "other"
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})
