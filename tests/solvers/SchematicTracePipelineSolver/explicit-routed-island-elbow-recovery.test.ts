import { expect, test } from "bun:test"
import type { InlineNetLabelOutput } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { NetLabelToTraceSolver } from "lib/solvers/NetLabelToTraceSolver/NetLabelToTraceSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const createFixture = (): InlineNetLabelOutput => {
  const pins = [
    {
      pinId: "A.1",
      chipId: "A",
      x: 0.5,
      y: 0,
      _facingDirection: "x+" as const,
    },
    {
      pinId: "B.1",
      chipId: "B",
      x: 3,
      y: -2.5,
      _facingDirection: "y+" as const,
    },
    {
      pinId: "C.1",
      chipId: "C",
      x: 1,
      y: 2.5,
      _facingDirection: "y-" as const,
    },
    {
      pinId: "D.1",
      chipId: "D",
      x: 5,
      y: -2.5,
      _facingDirection: "y+" as const,
    },
  ]
  const makeTrace = (
    id: string,
    ends: SolvedTracePath["pins"],
    tracePath: SolvedTracePath["tracePath"],
  ): SolvedTracePath => ({
    mspPairId: id,
    mspConnectionPairIds: [id],
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    pinIds: ends.map((pin) => pin.pinId),
    pins: ends,
    tracePath,
  })
  const traces = [
    makeTrace(
      "left-island",
      [pins[0]!, pins[2]!],
      [
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 2.5 },
      ],
    ),
    makeTrace(
      "right-island",
      [pins[1]!, pins[3]!],
      [
        { x: 3, y: -2.5 },
        { x: 3, y: -1.5 },
        { x: 5, y: -1.5 },
        { x: 5, y: -2.5 },
      ],
    ),
  ]
  const labels: NetLabelPlacement[] = traces.map((trace, index) => ({
    globalConnNetId: "signal",
    netId: "signal",
    netLabelText: "signal",
    pinIds: trace.pinIds,
    mspConnectionPairIds: [trace.mspPairId],
    orientation: "x-",
    anchorPoint: index === 0 ? { x: 1, y: 1.5 } : { x: 5, y: -1.5 },
    center: index === 0 ? { x: 0.6, y: 1.5 } : { x: 4.6, y: -1.5 },
    width: 0.8,
    height: 0.2,
  }))
  const fixture: InlineNetLabelOutput = {
    inputProblem: {
      chips: [
        {
          chipId: "A",
          center: { x: 0, y: 0 },
          width: 1,
          height: 1,
          pins: [pins[0]!],
        },
        {
          chipId: "B",
          center: { x: 3, y: -3 },
          width: 1,
          height: 1,
          pins: [pins[1]!],
        },
        {
          chipId: "C",
          center: { x: 1, y: 3 },
          width: 1,
          height: 1,
          pins: [pins[2]!],
        },
        {
          chipId: "D",
          center: { x: 5, y: -3 },
          width: 1,
          height: 1,
          pins: [pins[3]!],
        },
      ],
      directConnections: [
        { pinIds: ["A.1", "B.1"], netId: "signal", allowInlineNetLabel: true },
      ],
      netConnections: [
        {
          netId: "signal",
          pinIds: pins.map((pin) => pin.pinId),
          isGround: false,
        },
      ],
      availableNetLabelOrientations: {},
    },
    traces,
    netLabelPlacements: labels,
    inlineNetLabelPlacements: [],
  }
  const { netConnMap } = getConnectivityMapsFromInputProblem(
    fixture.inputProblem,
  )
  const globalNet = netConnMap.getNetConnectedToId("A.1")!
  for (const trace of traces) trace.globalConnNetId = globalNet
  for (const label of labels) label.globalConnNetId = globalNet
  return fixture
}

const solve = (fixture: InlineNetLabelOutput) => {
  const solver = new NetLabelToTraceSolver(fixture, {
    onlyInlineDirectConnections: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  return solver
}

test("joins explicit routed islands with distant labels using one outward elbow", () => {
  const fixture = createFixture()
  const solver = solve(fixture)
  const output = solver.getOutput()
  expect(output.traces).toHaveLength(3)
  expect(output.traces[2]!.tracePath).toEqual([
    { x: 0.5, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: -2.5 },
  ])
  expect(output.traces.slice(0, 2)).toEqual(fixture.traces)
  expect(
    getTraceConnectedPinComponents({
      pinIds: ["A.1", "B.1", "C.1", "D.1"],
      traces: output.traces,
    }),
  ).toHaveLength(1)
  expect(output.netLabelPlacements).toHaveLength(0)
})

test("keeps the islands labeled when the outward elbow is blocked by a component", () => {
  const fixture = createFixture()
  fixture.inputProblem.chips.push({
    chipId: "obstacle",
    center: { x: 3, y: 0 },
    width: 0.4,
    height: 0.4,
    pins: [],
  })
  const output = solve(fixture).getOutput()
  expect(output.traces).toEqual(fixture.traces)
  expect(output.netLabelPlacements).toEqual(fixture.netLabelPlacements)
})

test("keeps the islands labeled when a text obstacle blocks the elbow", () => {
  const fixture = createFixture()
  fixture.inputProblem.textBoxes = [
    { center: { x: 2, y: 0 }, width: 0.4, height: 0.4, text: "annotation" },
  ]
  const output = solve(fixture).getOutput()
  expect(output.traces).toEqual(fixture.traces)
  expect(output.netLabelPlacements).toEqual(fixture.netLabelPlacements)
})

test("named connectivity alone does not enable distant-island elbow recovery", () => {
  const fixture = createFixture()
  fixture.inputProblem.directConnections = []
  const solver = new NetLabelToTraceSolver(fixture)
  solver.solve()
  expect(solver.getOutput().traces).toEqual(fixture.traces)
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("does not join distant islands whose pin directions cannot form an outward elbow", () => {
  const fixture = createFixture()
  fixture.inputProblem.chips[0]!.pins[0]!._facingDirection = "x-"
  const output = solve(fixture).getOutput()
  expect(output.traces).toEqual(fixture.traces)
  expect(output.netLabelPlacements).toEqual(fixture.netLabelPlacements)
})

test("preserves labeled ground islands", () => {
  const fixture = createFixture()
  fixture.inputProblem.netConnections[0]!.isGround = true
  expect(solve(fixture).getOutput().traces).toEqual(fixture.traces)
})

test("respects section boundaries for explicit elbow connections", () => {
  const fixture = createFixture()
  fixture.inputProblem.chips[0]!.sectionId = "first"
  fixture.inputProblem.chips[1]!.sectionId = "second"
  expect(solve(fixture).getOutput().traces).toEqual(fixture.traces)
})

test("keeps labels when the elbow would require two crossings of unrelated wires", () => {
  const fixture = createFixture()
  for (const [index, x] of [1.6, 2.2].entries()) {
    const path = [
      { x, y: -1 },
      { x, y: 1 },
    ]
    fixture.traces.push({
      ...fixture.traces[0]!,
      mspPairId: `crossing-${index}`,
      globalConnNetId: `other-${index}`,
      pinIds: [`other-${index}.1`, `other-${index}.2`],
      pins: path.map((point, pinIndex) => ({
        ...point,
        pinId: `other-${index}.${pinIndex + 1}`,
        chipId: `other-${index}`,
      })) as SolvedTracePath["pins"],
      tracePath: path,
    })
  }
  expect(solve(fixture).getOutput().traces).toEqual(fixture.traces)
})

test("leaves distant-island recovery in the final stage unchanged", () => {
  const fixture = createFixture()
  const solver = new NetLabelToTraceSolver(fixture)
  solver.solve()
  expect(solver.getOutput().traces).toEqual(fixture.traces)
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("requires inline opt-in even for an explicit elbow wire", () => {
  const fixture = createFixture()
  fixture.inputProblem.directConnections[0]!.allowInlineNetLabel = false
  expect(solve(fixture).getOutput().traces).toEqual(fixture.traces)
})

test("keeps islands labeled when another net label blocks their elbow", () => {
  const fixture = createFixture()
  fixture.netLabelPlacements.push({
    ...fixture.netLabelPlacements[0]!,
    globalConnNetId: "other",
    netId: "other",
    netLabelText: "other",
    pinIds: [],
    mspConnectionPairIds: [],
    anchorPoint: { x: 2.4, y: 0 },
    center: { x: 2, y: 0 },
  })
  const output = solve(fixture).getOutput()
  expect(output.traces).toEqual(fixture.traces)
  expect(output.netLabelPlacements).toEqual(fixture.netLabelPlacements)
})
