import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { removeRedundantTerminalSegments } from "lib/solvers/SameNetJunctionAlignmentSolver/removeRedundantTerminalSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createTrace = (id: string, tracePath: Point[]): SolvedTracePath => ({
  mspPairId: id,
  globalConnNetId: "power",
  dcConnNetId: "power",
  mspConnectionPairIds: [id],
  pinIds: [`${id}-a`, `${id}-b`],
  pins: [
    { ...tracePath[0]!, pinId: `${id}-a`, chipId: id },
    { ...tracePath.at(-1)!, pinId: `${id}-b`, chipId: id },
  ],
  tracePath,
})

const createFixture = () => {
  const traces = [
    createTrace("branch", [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 3 },
    ]),
    createTrace("top", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    createTrace("return", [
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ]),
  ]
  const inputProblem: InputProblem = {
    chips: traces.map((trace) => ({
      chipId: trace.mspPairId,
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: trace.pins,
    })),
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  return { inputProblem, traces, netLabelPlacements: [] as NetLabelPlacement[] }
}

test("removes a terminal loop edge backed by multiple same-net paths", () => {
  const fixture = createFixture()
  const original = structuredClone(fixture)
  const result = removeRedundantTerminalSegments(fixture)
  expect(result[0]!.tracePath).toEqual([
    { x: -1, y: 0 },
    { x: 0, y: 0 },
  ])
  expect(result.slice(1)).toEqual(fixture.traces.slice(1))
  expect(fixture).toEqual(original)
  expect(
    removeRedundantTerminalSegments({ ...fixture, traces: result }),
  ).toEqual(result)
})

test.each(["reverse", "rotate"])(
  "supports %s paths without coordinate assumptions",
  (mode) => {
    const fixture = createFixture()
    for (const trace of fixture.traces) {
      if (mode === "reverse") trace.tracePath.reverse()
      else
        trace.tracePath = trace.tracePath.map(({ x, y }) => ({ x: -y, y: x }))
    }
    if (mode === "rotate") {
      for (const chip of fixture.inputProblem.chips) {
        chip.pins = chip.pins.map((pin) => ({ ...pin, x: -pin.y, y: pin.x }))
      }
    }
    const expected =
      mode === "reverse"
        ? [
            { x: 0, y: 0 },
            { x: -1, y: 0 },
          ]
        : [
            { x: -0, y: -1 },
            { x: -0, y: 0 },
          ]
    expect(removeRedundantTerminalSegments(fixture)[0]!.tracePath).toEqual(
      expected,
    )
  },
)

test("does not use another net or a disconnected path as the alternate route", () => {
  for (const differentNet of [false, true]) {
    const fixture = createFixture()
    if (differentNet) fixture.traces[2]!.globalConnNetId = "other"
    else fixture.traces.pop()
    expect(removeRedundantTerminalSegments(fixture)).toEqual(fixture.traces)
  }
})

test("retains a segment carrying an otherwise disconnected branch", () => {
  const fixture = createFixture()
  fixture.traces.push(
    createTrace("load", [
      { x: 0, y: 1 },
      { x: -2, y: 1 },
    ]),
  )
  expect(removeRedundantTerminalSegments(fixture)).toEqual(fixture.traces)
})

test.each(["pin", "label"])("preserves an interior %s anchor", (kind) => {
  const fixture = createFixture()
  if (kind === "pin") {
    fixture.inputProblem.chips[0]!.pins.push({ pinId: "load", x: 0, y: 1 })
  } else {
    fixture.netLabelPlacements.push({
      globalConnNetId: "power",
      dcConnNetId: "power",
      mspConnectionPairIds: ["branch"],
      pinIds: [],
      anchorPoint: { x: 0, y: 1 },
      center: { x: 0, y: 1.2 },
      orientation: "y+",
      width: 0.5,
      height: 0.2,
    })
  }
  expect(removeRedundantTerminalSegments(fixture)).toEqual(fixture.traces)
})

test("leaves coincident shared stubs and internal loops unchanged", () => {
  const fixture = createFixture()
  fixture.traces[2]!.tracePath = [
    { x: 2, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 3 },
  ]
  expect(removeRedundantTerminalSegments(fixture)).toEqual(fixture.traces)
  const internal = createFixture()
  internal.traces[0]!.tracePath.push({ x: -1, y: 3 })
  expect(removeRedundantTerminalSegments(internal)).toEqual(internal.traces)
})
