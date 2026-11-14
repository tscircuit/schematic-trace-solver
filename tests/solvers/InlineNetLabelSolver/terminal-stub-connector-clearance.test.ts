import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReportInput from "../../bug-reports/bug-report-20260907T110144Z/bug-report-20260907T110144Z.json"

const createStubConnectorFixture = (
  extraTextBoxes: InputProblem["textBoxes"] = [],
) => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0.1 },
        width: 1,
        height: 0.8,
        pins: [
          { pinId: "U1.epad", x: 0.5, y: 0.3, _facingDirection: "x+" },
          { pinId: "U1.vcc_pg", x: 0.5, y: 0.1, _facingDirection: "x+" },
          { pinId: "U1.pg", x: 0.5, y: -0.1, _facingDirection: "x+" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "VCC_PG",
        pinIds: ["U1.vcc_pg"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.34,
        inlineNetLabelHeight: 0.12,
      },
      {
        netId: "PG",
        pinIds: ["U1.pg"],
        allowInlineNetLabel: true,
        inlineNetLabelWidth: 0.2,
        inlineNetLabelHeight: 0.12,
      },
    ],
    availableNetLabelOrientations: {
      GND: ["y-"],
      VCC_PG: ["x+"],
      PG: ["x+"],
    },
    textBoxes: extraTextBoxes,
  }

  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "GND",
      netId: "GND",
      mspConnectionPairIds: [],
      pinIds: ["U1.epad"],
      orientation: "y-",
      anchorPoint: { x: 1.14, y: 0 },
      center: { x: 1.14, y: -0.15 },
      width: 0.3,
      height: 0.3,
    },
    {
      globalConnNetId: "VCC_PG",
      netId: "VCC_PG",
      mspConnectionPairIds: [],
      pinIds: ["U1.vcc_pg"],
      orientation: "x+",
      anchorPoint: { x: 0.5, y: 0.1 },
      center: { x: 0.8, y: 0.1 },
      width: 0.34,
      height: 0.12,
    },
    {
      globalConnNetId: "PG",
      netId: "PG",
      mspConnectionPairIds: [],
      pinIds: ["U1.pg"],
      orientation: "x+",
      anchorPoint: { x: 0.5, y: -0.1 },
      center: { x: 0.8, y: -0.1 },
      width: 0.2,
      height: 0.12,
    },
  ]

  const traces: SolvedTracePath[] = [
    {
      mspPairId: "available-net-orientation-GND",
      dcConnNetId: "GND",
      globalConnNetId: "GND",
      pins: [] as unknown as SolvedTracePath["pins"],
      tracePath: [
        { x: 0.5, y: 0.3 },
        { x: 1.14, y: 0.3 },
        { x: 1.14, y: 0 },
      ],
      mspConnectionPairIds: [],
      pinIds: ["U1.epad"],
    },
  ]

  return {
    inputProblem,
    traces,
    netLabelPlacements,
    netLabelConnectorTraceIds: new Set(["available-net-orientation-GND"]),
  }
}

test("shifts a perpendicular label connector outward so terminal inline stubs stay clear and aligned", () => {
  const fixture = createStubConnectorFixture()
  const solver = new InlineNetLabelSolver({
    ...fixture,
    resolveTraceCollisions: true,
  })
  solver.solve()

  const output = solver.getOutput()
  const vccPg = output.inlineNetLabelPlacements.find(
    (label) => label.netId === "VCC_PG",
  )!
  const pg = output.inlineNetLabelPlacements.find(
    (label) => label.netId === "PG",
  )!
  const gndConnector = output.traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-GND",
  )!

  expect(vccPg.stubTracePath![1].x).toBeCloseTo(1.1)
  expect(pg.stubTracePath![1].x).toBeCloseTo(1.1)
  expect(
    gndConnector.tracePath[1]!.x - vccPg.stubTracePath![1].x,
  ).toBeGreaterThanOrEqual(0.2 - 1e-6)
})

test("retains the collision-limited terminal stub when the perpendicular connector is blocked", () => {
  const fixture = createStubConnectorFixture([
    {
      center: { x: 1.45, y: -0.15 },
      width: 0.3,
      height: 0.6,
      text: "obstacle",
    },
  ])
  const solver = new InlineNetLabelSolver({
    ...fixture,
    resolveTraceCollisions: true,
  })
  solver.solve()

  const output = solver.getOutput()
  const vccPg = output.inlineNetLabelPlacements.find(
    (label) => label.netId === "VCC_PG",
  )!
  const gndConnector = output.traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-GND",
  )!

  expect(vccPg.stubTracePath![1].x).toBeCloseTo(1.09)
  expect(gndConnector.tracePath[1]!.x).toBeCloseTo(1.14)
})

test("keeps U3 right-side inline stubs clear of EPAD and AGND connectors in bug-report-20260907T110144Z", () => {
  const solver = new SchematicTracePipelineSolver(
    JSON.parse(JSON.stringify(bugReportInput)) as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.inlineNetLabelSolver!.getOutput()
  for (const [stubPinId, gndPinId] of [
    ["schematic_port_24", "schematic_port_25"],
    ["schematic_port_16", "schematic_port_18"],
  ] as const) {
    const inlineStub = output.inlineNetLabelPlacements.find((label) =>
      label.pinIds.includes(stubPinId),
    )!
    const gndConnector = output.traces.find(
      (trace) =>
        output.netLabelConnectorTraceIds?.has(trace.mspPairId) &&
        trace.pinIds.includes(gndPinId),
    )!
    const stubEndX = inlineStub.stubTracePath![1].x
    const connectorDropX = gndConnector.tracePath[1]!.x
    expect(stubEndX).toBeCloseTo(2.5)
    expect(connectorDropX - stubEndX).toBeGreaterThanOrEqual(0.2 - 1e-6)
  }
})
