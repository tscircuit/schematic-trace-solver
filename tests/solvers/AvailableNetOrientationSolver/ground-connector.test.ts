import { expect, test } from "bun:test"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import type { AvailableNetOrientationSolverParams } from "lib/solvers/AvailableNetOrientationSolver/types"

const makeInput = (): AvailableNetOrientationSolverParams => ({
  inputProblem: {
    chips: [
      {
        chipId: "component",
        center: { x: 0, y: 0.5 },
        width: 1,
        height: 1,
        pins: [{ pinId: "terminal", x: 0, y: 0, _facingDirection: "y-" }],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "return",
        pinIds: ["terminal"],
        isGround: true,
        netLabelWidth: 0.42,
      },
    ],
    availableNetLabelOrientations: { return: ["y-"] },
  },
  traces: [],
  netLabelPlacements: [
    {
      globalConnNetId: "return",
      netId: "return",
      pinIds: ["terminal"],
      mspConnectionPairIds: [],
      orientation: "y-",
      anchorPoint: { x: 0, y: 0 },
      center: { x: 0, y: -0.21 },
      width: 0.2,
      height: 0.42,
    },
  ],
})

test.each([true, false])(
  "adds a ground connector with explicit pin direction: %s",
  (explicit) => {
    const input = makeInput()
    if (!explicit) delete input.inputProblem.chips[0]!.pins[0]!._facingDirection
    const solver = new AvailableNetOrientationSolver(input)
    solver.solve()
    const output = solver.getOutput()
    expect(output.traces).toHaveLength(1)
    expect(output.traces[0]).toMatchObject({
      globalConnNetId: "return",
      pinIds: ["terminal"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: -0.2 },
      ],
    })
    expect(output.netLabelPlacements[0]!.anchorPoint).toEqual({ x: 0, y: -0.2 })
    expect(
      output.netLabelConnectorTraceIds.has(output.traces[0]!.mspPairId),
    ).toBe(true)
    // A second pass must not keep lengthening the connector.
    const again = new AvailableNetOrientationSolver({
      inputProblem: input.inputProblem,
      ...output,
    })
    again.solve()
    expect(again.getOutput().traces).toEqual(output.traces)
    expect(again.getOutput().netLabelPlacements).toEqual(
      output.netLabelPlacements,
    )
  },
)

test.each(["chip", "text", "trace", "label"] as const)(
  "does not add a connector through a %s obstacle",
  (kind) => {
    const input = makeInput()
    const bounds = { center: { x: 0, y: -0.52 }, width: 0.3, height: 0.05 }
    if (kind === "chip")
      input.inputProblem.chips.push({ chipId: "obstacle", ...bounds, pins: [] })
    if (kind === "text")
      input.inputProblem.textBoxes = [{ ...bounds, text: "obstacle" }]
    if (kind === "label")
      input.netLabelPlacements.push({
        ...input.netLabelPlacements[0]!,
        ...bounds,
        netId: "other",
        globalConnNetId: "other",
        anchorPoint: { x: 0, y: -0.495 },
        pinIds: [],
      })
    if (kind === "trace")
      input.traces.push({
        mspPairId: "obstacle",
        mspConnectionPairIds: ["obstacle"],
        dcConnNetId: "other",
        pins: [
          { pinId: "a", chipId: "a", x: -1, y: -0.1 },
          { pinId: "b", chipId: "b", x: 1, y: -0.1 },
        ],
        globalConnNetId: "other",
        pinIds: [],
        tracePath: [
          { x: -1, y: -0.1 },
          { x: 1, y: -0.1 },
        ],
      })
    const solver = new AvailableNetOrientationSolver(input)
    solver.solve()
    expect(solver.getOutput().traces).toEqual(input.traces)
    expect(solver.getOutput().netLabelPlacements).toEqual(
      input.netLabelPlacements,
    )
  },
)

test("leaves non-ground labels unchanged", () => {
  const input = makeInput()
  input.inputProblem.netConnections[0]!.isGround = false
  const solver = new AvailableNetOrientationSolver(input)
  solver.solve()
  expect(solver.getOutput().traces).toEqual([])
  expect(solver.getOutput().netLabelPlacements).toEqual(
    input.netLabelPlacements,
  )
})
