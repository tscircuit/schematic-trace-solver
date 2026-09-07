import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

type Rotation = 0 | 90 | 180 | 270

const createInput = (rotation: Rotation, blocked = false) => {
  const rotate = ({ x, y }: Point): Point => {
    switch (rotation) {
      case 90:
        return { x: -y, y: x }
      case 180:
        return { x: -x, y: -y }
      case 270:
        return { x: y, y: -x }
      default:
        return { x, y }
    }
  }
  const orientation = ({ 0: "x-", 90: "y-", 180: "x+", 270: "y+" } as const)[
    rotation
  ]
  const vertical = rotation === 90 || rotation === 270
  const pins = [
    { pinId: "U1.A0", x: -0.5, y: 0.2 },
    { pinId: "U1.CLK", x: -0.5, y: 0 },
    { pinId: "U1.DATA", x: -0.5, y: -0.2 },
  ].map((pin) => ({ ...pin, ...rotate(pin), _facingDirection: orientation }))
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: rotate({ x: 0, y: 0 }),
        width: 1,
        height: 1,
        pins,
      },
    ],
    directConnections: [],
    netConnections: pins.map((pin) => ({
      netId: pin.pinId.slice(3),
      netLabelText: pin.pinId.slice(3),
      pinIds: [pin.pinId],
      allowInlineNetLabel: pin.pinId !== "U1.A0",
      inlineNetLabelWidth: 0.4,
      inlineNetLabelHeight: 0.12,
    })),
    availableNetLabelOrientations: {},
    // This text blocks DATA's alternate side. The final candidate selection
    // must not keep overlapping text when the neighboring label also moves.
    textBoxes: blocked
      ? [
          {
            center: rotate({ x: -0.8, y: -0.4 }),
            width: vertical ? 0.12 : 0.4,
            height: vertical ? 0.4 : 0.12,
            text: "obstacle",
          },
        ]
      : [],
  }
  const netLabelPlacements: NetLabelPlacement[] = pins.map((pin) => ({
    globalConnNetId: pin.pinId.slice(3),
    netId: pin.pinId.slice(3),
    netLabelText: pin.pinId.slice(3),
    pinIds: [pin.pinId],
    mspConnectionPairIds: [],
    orientation,
    anchorPoint: { x: pin.x, y: pin.y },
    center: {
      x: pin.x + rotate({ x: -0.25, y: 0 }).x,
      y: pin.y + rotate({ x: -0.25, y: 0 }).y,
    },
    width: vertical ? 0.2 : 0.5,
    height: vertical ? 0.5 : 0.2,
  }))
  // There is room for the original stubs, but not to push the labels farther
  // outward. The fallback must move text to the other side, not cross the rail.
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "rail",
      dcConnNetId: "rail",
      globalConnNetId: "rail",
      pins: [
        { pinId: "rail.1", chipId: "rail", ...rotate({ x: -1.2, y: -0.5 }) },
        { pinId: "rail.2", chipId: "rail", ...rotate({ x: -1.2, y: 0.5 }) },
      ],
      pinIds: ["rail.1", "rail.2"],
      mspConnectionPairIds: [],
      tracePath: [
        { x: -1.2, y: -0.5 },
        { x: -1.2, y: 0.5 },
      ].map(rotate),
    },
  ]
  return { inputProblem, traces, netLabelPlacements }
}

test.each([0, 90, 180, 270] as const)(
  "retries terminal label sides beside a fixed rail (rotation %i)",
  (rotation) => {
    const input = createInput(rotation)
    const solver = new InlineNetLabelSolver(input)
    solver.solve()
    const output = solver.getOutput()
    expect(
      output.inlineNetLabelPlacements.map((label) => label.netId).sort(),
    ).toEqual(["CLK", "DATA"])
    expect(output.netLabelPlacements.map((label) => label.netId)).toEqual([
      "A0",
    ])
    expect(output.traces).toEqual(input.traces)
    for (const label of output.inlineNetLabelPlacements) {
      expect(label.side).toBe(
        ({ 0: "y-", 90: "x+", 180: "y+", 270: "x-" } as const)[rotation],
      )
      const pin = input.inputProblem.chips[0]!.pins.find(
        (pin) => pin.pinId === label.pinIds[0],
      )!
      expect(label.stubTracePath![0]).toEqual({ x: pin.x, y: pin.y })
      const end = label.stubTracePath![1]
      expect(Math.abs(end.x - pin.x) + Math.abs(end.y - pin.y)).toBeCloseTo(0.6)
    }
  },
)

test.each(["text", "chip", "trace"] as const)(
  "keeps anchored labels when alternate sides are blocked by %s",
  (obstacleKind) => {
    const input = createInput(0, true)
    if (obstacleKind === "chip") {
      input.inputProblem.chips.push({
        chipId: "obstacle",
        ...input.inputProblem.textBoxes![0]!,
        pins: [],
      })
      input.inputProblem.textBoxes = []
    } else if (obstacleKind === "trace") {
      input.traces.push({
        ...input.traces[0]!,
        mspPairId: "lower-rail",
        tracePath: [
          { x: -1, y: -0.35 },
          { x: -0.6, y: -0.35 },
        ],
      })
      input.inputProblem.textBoxes = []
    }
    const solver = new InlineNetLabelSolver(input)
    solver.solve()
    const output = solver.getOutput()
    expect(output.inlineNetLabelPlacements).toHaveLength(0)
    expect(output.netLabelPlacements).toEqual(input.netLabelPlacements)
    expect(output.traces).toEqual(input.traces)
  },
)

test("terminal label side retry snapshot", async () => {
  const solver = new InlineNetLabelSolver(createInput(0))
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
