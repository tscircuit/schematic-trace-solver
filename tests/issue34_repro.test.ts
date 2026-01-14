import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { fileURLToPath } from "url"

const PRIMARY_Y = 10
const SECONDARY_Y = 10.02

test("same-net close horizontal traces merge onto the first segment's y", async () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "LEFT",
        center: { x: 0, y: (PRIMARY_Y + SECONDARY_Y) / 2 },
        width: 0.8,
        height: 0.6,
        pins: [
          { pinId: "LEFT_TOP", x: 0, y: PRIMARY_Y },
          { pinId: "LEFT_BOTTOM", x: 0, y: SECONDARY_Y },
        ],
      },
      {
        chipId: "RIGHT",
        center: { x: 12, y: (PRIMARY_Y + SECONDARY_Y) / 2 },
        width: 0.8,
        height: 0.6,
        pins: [
          { pinId: "RIGHT_TOP", x: 12, y: PRIMARY_Y },
          { pinId: "RIGHT_BOTTOM", x: 12, y: SECONDARY_Y },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "NET1",
        pinIds: ["LEFT_TOP", "RIGHT_TOP", "LEFT_BOTTOM", "RIGHT_BOTTOM"],
      },
    ],
    availableNetLabelOrientations: {
      NET1: ["x+", "x-", "y+", "y-"],
    },
    maxMspPairDistance: 20,
  }

  const tracesBeforeMerge: SolvedTracePath[] = [
    {
      mspPairId: "trace-top",
      dcConnNetId: "NET1",
      globalConnNetId: "NET1",
      userNetId: "NET1",
      pins: [
        { pinId: "LEFT_TOP", chipId: "LEFT", x: 0, y: PRIMARY_Y },
        { pinId: "RIGHT_TOP", chipId: "RIGHT", x: 12, y: PRIMARY_Y },
      ],
      tracePath: [
        { x: 0, y: PRIMARY_Y },
        { x: 12, y: PRIMARY_Y },
      ],
      mspConnectionPairIds: ["trace-top"],
      pinIds: ["LEFT_TOP", "RIGHT_TOP"],
    },
    {
      mspPairId: "trace-bottom",
      dcConnNetId: "NET1",
      globalConnNetId: "NET1",
      userNetId: "NET1",
      pins: [
        { pinId: "LEFT_BOTTOM", chipId: "LEFT", x: 0, y: SECONDARY_Y },
        { pinId: "RIGHT_BOTTOM", chipId: "RIGHT", x: 12, y: SECONDARY_Y },
      ],
      tracePath: [
        { x: 0, y: SECONDARY_Y },
        { x: 12, y: SECONDARY_Y },
      ],
      mspConnectionPairIds: ["trace-bottom"],
      pinIds: ["LEFT_BOTTOM", "RIGHT_BOTTOM"],
    },
  ]

  const pipeline = new SchematicTracePipelineSolver(inputProblem)

  const mergeSolver = new SameNetTraceMergeSolver({ traces: tracesBeforeMerge })
  mergeSolver.solve()

  const mergedTraces = mergeSolver.getOutput().traces
  expect(mergedTraces).toHaveLength(1)

  const mergedTrace = mergedTraces[0]!
  expect(
    mergedTrace.tracePath.every(
      (point) =>
        Math.abs(point.y - PRIMARY_Y) < 1e-6 ||
        Math.abs(point.y - SECONDARY_Y) < 1e-6,
    ),
  ).toBe(true)
  expect(
    mergedTrace.tracePath.some((point) => Math.abs(point.y - PRIMARY_Y) < 1e-6),
  ).toBe(true)

  mergeSolver.visualize = () => ({
    lines: [
      ...tracesBeforeMerge.map((trace) => ({
        points: trace.tracePath,
        strokeColor: "#a0a0a0",
        strokeDash: "6 3",
      })),
      {
        points: mergedTrace.tracePath,
        strokeColor: "#0c8b3c",
        strokeWidth: 0.12,
      },
    ],
    points: mergedTrace.pins.map((pin) => ({
      x: pin.x,
      y: pin.y,
      color: "#b23a48",
      label: pin.pinId,
    })),
    rects: [],
    circles: [],
    texts: [],
  })

  pipeline.sameNetTraceMergeSolver = mergeSolver

  const svg = getSvgFromGraphicsObject(pipeline.visualize(), {
    backgroundColor: "white",
  })

  const snapshotPath = fileURLToPath(import.meta.url)

  await expect(svg).toMatchSvgSnapshot(snapshotPath)
})
