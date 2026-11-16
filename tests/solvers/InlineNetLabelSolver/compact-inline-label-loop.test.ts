import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const transformations = {
  up: ({ x, y }: Point) => ({ x, y }),
  down: ({ x, y }: Point) => ({ x, y: -y }),
  right: ({ x, y }: Point) => ({ x: y, y: x }),
  left: ({ x, y }: Point) => ({ x: -y, y: x }),
}

const solveLoop = (
  transform: (point: Point) => Point,
  reach: number,
  crossing?: { y: number; sameNet: boolean },
) => {
  const start = { x: -0.24, y: 1.2 }
  const end = { x: 0.24, y: 1.2 }
  const pins: SolvedTracePath["pins"] = [
    { chipId: "chip", pinId: "left", ...transform(start) },
    { chipId: "chip", pinId: "right", ...transform(end) },
  ]
  const trace: SolvedTracePath = {
    mspPairId: "loop",
    mspConnectionPairIds: ["loop"],
    dcConnNetId: "SENSE",
    globalConnNetId: "SENSE",
    pins,
    pinIds: ["left", "right"],
    tracePath: [
      start,
      { x: start.x, y: start.y + reach },
      { x: end.x, y: end.y + reach },
      end,
    ].map(transform),
  }
  const inputProblem: InputProblem = {
    chips: [
      { chipId: "chip", center: { x: 0, y: 0 }, width: 2, height: 2, pins },
    ],
    directConnections: [
      {
        netId: "SENSE",
        netLabelText: "SENSE",
        pinIds: ["left", "right"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.61,
        inlineNetLabelHeight: 0.12,
      },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const traces = [trace]
  if (crossing) {
    const left = transform({ x: -0.8, y: crossing.y })
    const right = transform({
      x: crossing.sameNet ? start.x : 0.8,
      y: crossing.y,
    })
    const netId = crossing.sameNet ? "SENSE" : "OTHER"
    traces.push({
      mspPairId: "crossing",
      mspConnectionPairIds: ["crossing"],
      dcConnNetId: netId,
      globalConnNetId: netId,
      pins: [
        { ...left, chipId: "other-left", pinId: "other-left" },
        { ...right, chipId: "other-right", pinId: "other-right" },
      ],
      pinIds: ["other-left", "other-right"],
      tracePath: [left, right],
    })
  }
  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces,
    netLabelPlacements: [],
    resolveTraceCollisions: true,
  })
  solver.solve()
  return { trace, output: solver.getOutput() }
}

test.each(Object.entries(transformations))(
  "shortens a loop facing %s when its inline label still fits",
  (_, transform) => {
    // A modest reduction is enough when the new geometry still carries the text.
    const { trace, output } = solveLoop(transform, 1)
    const path = output.traces.find(
      ({ mspPairId }) => mspPairId === "loop",
    )!.tracePath
    expect(path[0]).toEqual(trace.tracePath[0])
    expect(path[3]).toEqual(trace.tracePath[3])
    const expectedElbow = transform({ x: -0.24, y: 1.91 })
    expect(path[1]!.x).toBeCloseTo(expectedElbow.x)
    expect(path[1]!.y).toBeCloseTo(expectedElbow.y)
    const label = output.inlineNetLabelPlacements.find(
      ({ mspPairId }) => mspPairId === "loop",
    )!
    expect(label.netLabelText).toBe("SENSE")
    expect(tracePathContainsPoint(path, label.anchorPoint)).toBe(true)
  },
)

test("keeps a long loop when another wire obstructs its compact inline label", () => {
  const { trace, output } = solveLoop(transformations.up, 3, {
    y: 1.58,
    sameNet: false,
  })
  expect(output.traces[0]!.tracePath).toEqual(trace.tracePath)
  expect(output.inlineNetLabelPlacements[0]!.netLabelText).toBe("SENSE")
})

test("keeps a loop that carries an existing same-net junction", () => {
  const { trace, output } = solveLoop(transformations.up, 3, {
    y: 2.8,
    sameNet: true,
  })
  expect(output.traces[0]!.tracePath).toEqual(trace.tracePath)
  expect(output.inlineNetLabelPlacements[0]!.netLabelText).toBe("SENSE")
})
