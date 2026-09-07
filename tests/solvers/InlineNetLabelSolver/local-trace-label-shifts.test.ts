import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { InputProblem } from "lib/types/InputProblem"
import type { InlineNetLabelOutput } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getLocalTraceLabelShifts } from "lib/solvers/InlineNetLabelSolver/getLocalTraceLabelShifts"
import { findLabelCollisions } from "tests/fixtures/findLabelCollisions"

const trace = (net: string, path: Point[]): SolvedTracePath => ({
  mspPairId: net,
  mspConnectionPairIds: [net],
  globalConnNetId: net,
  dcConnNetId: net,
  pinIds: [`${net}.1`, `${net}.2`],
  pins: [
    { pinId: `${net}.1`, chipId: "A", ...path[0]! },
    { pinId: `${net}.2`, chipId: "B", ...path.at(-1)! },
  ],
  tracePath: path,
})
const fixture = () => {
  const input: InputProblem = {
    chips: [],
    netConnections: [],
    directConnections: [],
    availableNetLabelOrientations: {},
  }
  const output: Omit<InlineNetLabelOutput, "inputProblem"> = {
    traces: [
      trace("wire", [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: -1 },
        { x: 0, y: -1 },
      ]),
    ],
    netLabelPlacements: [
      {
        globalConnNetId: "label",
        netId: "label",
        pinIds: ["label.1"],
        mspConnectionPairIds: [],
        orientation: "x+",
        anchorPoint: { x: 0.8, y: 0 },
        center: { x: 1, y: 0 },
        width: 0.4,
        height: 0.2,
      },
    ],
    inlineNetLabelPlacements: [],
  }
  return { input, output }
}

for (const rotation of [0, 1, 2, 3])
  test(`slides an existing leg without adding bends (rotation ${rotation})`, () => {
    const { input, output } = fixture()
    const rotate = (p: Point): Point => {
      for (let i = 0; i < rotation; i++) p = { x: -p.y, y: p.x }
      return p
    }
    output.traces[0]!.tracePath = output.traces[0]!.tracePath.map(rotate)
    output.traces[0]!.pins = output.traces[0]!.pins.map((pin) => ({
      ...pin,
      ...rotate(pin),
    })) as SolvedTracePath["pins"]
    const label = output.netLabelPlacements[0]!
    label.anchorPoint = rotate(label.anchorPoint)
    label.center = rotate(label.center)
    label.orientation = (["x+", "y+", "x-", "y-"] as const)[rotation]!
    if (rotation % 2) [label.width, label.height] = [label.height, label.width]
    const saved = structuredClone(output)
    const proposals = [...getLocalTraceLabelShifts(input, output)]
    expect(proposals.length).toBeGreaterThan(0)
    for (const proposal of proposals) {
      const path = proposal.traces[0]!.tracePath
      expect(path).toHaveLength(4)
      expect(path[0]).toEqual(output.traces[0]!.tracePath[0])
      expect(path.at(-1)).toEqual(output.traces[0]!.tracePath.at(-1))
      expect(findLabelCollisions(proposal)).toEqual({
        labelPairs: [],
        traceLabels: [],
      })
    }
    expect(output).toEqual(saved)
  })

test.each(["chip", "parallel wire", "new crossing", "junction"] as const)(
  "does not force a detour through a blocked corridor: %s",
  (obstacle) => {
    const { input, output } = fixture()
    if (obstacle === "chip")
      input.chips.push(
        ...[0.75, 1.25].map((x) => ({
          chipId: `C${x}`,
          center: { x, y: 0 },
          width: 0.08,
          height: 0.5,
          pins: [],
        })),
      )
    if (obstacle === "parallel wire")
      output.traces.push(
        ...[0.75, 1.25].map((x) =>
          trace(`other${x}`, [
            { x, y: -2 },
            { x, y: 2 },
          ]),
        ),
      )
    if (obstacle === "new crossing")
      output.traces.push(
        trace("other", [
          { x: 0.6, y: 0 },
          { x: 0.9, y: 0 },
        ]),
        trace("other2", [
          { x: 1.1, y: 0 },
          { x: 1.4, y: 0 },
        ]),
      )
    if (obstacle === "junction")
      output.traces.push({
        ...trace("branch", [
          { x: 1, y: 0.5 },
          { x: 2, y: 0.5 },
        ]),
        globalConnNetId: "wire",
      })
    expect([...getLocalTraceLabelShifts(input, output)]).toEqual([])
  },
)

test("moves a neighboring power label with its short connector to free a side corridor", () => {
  const { input, output } = fixture()
  input.chips.push({
    chipId: "C",
    center: { x: 0.75, y: 0 },
    width: 0.08,
    height: 0.5,
    pins: [],
  })
  const power = {
    ...trace("power", [
      { x: 0, y: -0.7 },
      { x: 1.4, y: -0.7 },
      { x: 1.4, y: 0.8 },
    ]),
    pinIds: ["power.1"],
  }
  output.traces.push(power)
  output.netLabelPlacements.push({
    globalConnNetId: "power",
    netId: "power",
    pinIds: ["power.1"],
    mspConnectionPairIds: [],
    orientation: "y+",
    anchorPoint: { x: 1.4, y: 0.8 },
    center: { x: 1.4, y: 0.95 },
    width: 0.6,
    height: 0.3,
  })
  const proposals = [...getLocalTraceLabelShifts(input, output)]
  expect(proposals.length).toBeGreaterThan(0)
  for (const proposal of proposals) {
    expect(proposal.traces[0]!.tracePath).toHaveLength(4)
    expect(proposal.traces[1]!.tracePath).toHaveLength(3)
    expect(proposal.traces[1]!.tracePath[0]).toEqual(power.tracePath[0])
    expect(proposal.netLabelPlacements[1]!.anchorPoint.x).toBeGreaterThan(1.4)
    expect(findLabelCollisions(proposal)).toEqual({
      labelPairs: [],
      traceLabels: [],
    })
  }
})

test("clears a moved rail's own tag and a neighboring power label in one proposal", () => {
  const { input, output } = fixture()
  input.chips.push({
    chipId: "C",
    center: { x: 0.75, y: 0 },
    width: 0.08,
    height: 0.5,
    pins: [],
  })
  const power = {
    ...trace("power", [
      { x: 0, y: -0.8 },
      { x: 1.125, y: -0.8 },
      { x: 1.125, y: -0.6 },
    ]),
    pinIds: ["power.1"],
  }
  output.traces.push(power)
  output.netLabelPlacements.push(
    {
      globalConnNetId: "wire",
      netId: "wire",
      pinIds: ["wire.1", "wire.2"],
      mspConnectionPairIds: [],
      orientation: "x-",
      anchorPoint: { x: 1, y: -0.5 },
      center: { x: 0.8, y: -0.5 },
      width: 0.4,
      height: 0.2,
    },
    {
      globalConnNetId: "power",
      netId: "power",
      pinIds: ["power.1"],
      mspConnectionPairIds: [],
      orientation: "y+",
      anchorPoint: { x: 1.125, y: -0.6 },
      center: { x: 1.125, y: -0.5 },
      width: 0.15,
      height: 0.2,
    },
  )
  const saved = structuredClone(output)
  const proposals = [...getLocalTraceLabelShifts(input, output)]
  expect(proposals.length).toBeGreaterThan(0)
  for (const proposal of proposals) {
    expect(proposal.traces.map((trace) => trace.tracePath.length)).toEqual([
      4, 3,
    ])
    expect(proposal.netLabelPlacements[1]!.anchorPoint.x).toBeCloseTo(1.25)
    expect(proposal.netLabelPlacements[2]!.anchorPoint.x).toBeGreaterThan(1.25)
    expect(findLabelCollisions(proposal)).toEqual({
      labelPairs: [],
      traceLabels: [],
    })
  }
  expect(output).toEqual(saved)
})
