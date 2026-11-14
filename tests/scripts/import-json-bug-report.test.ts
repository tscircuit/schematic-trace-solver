import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import {
  assertInputProblem,
  normalizeBugReportInputProblem,
} from "../../.github/scripts/import-json-bug-report"

const createValidInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1.4,
      pins: [
        {
          pinId: "U1.1",
          displayName: "OUT",
          x: 1,
          y: 0,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "R1",
      center: { x: 4, y: 0 },
      width: 1,
      height: 0.6,
      pins: [
        {
          pinId: "R1.1",
          displayName: "1",
          x: 3.5,
          y: 0,
          _facingDirection: "x-",
        },
      ],
    },
  ],
  directConnections: [{ pinIds: ["U1.1", "R1.1"], netId: "U1.1 to R1.1" }],
  netConnections: [],
  availableNetLabelOrientations: {},
})

test("passes through valid InputProblem objects and unwraps solver wrapper payloads", () => {
  const baseProblem = createValidInputProblem()
  expect(normalizeBugReportInputProblem(baseProblem)).toEqual(baseProblem)
  expect(normalizeBugReportInputProblem({ inputProblem: baseProblem })).toEqual(
    baseProblem,
  )
  expect(normalizeBugReportInputProblem({ solverParams: baseProblem })).toEqual(
    baseProblem,
  )
  expect(normalizeBugReportInputProblem({ problem: baseProblem })).toEqual(
    baseProblem,
  )
})

test("converts single-sheet Circuit JSON arrays and wrapper objects into solvable InputProblems", () => {
  const circuitJson = [
    {
      type: "source_port",
      source_port_id: "sp_u1_vcc",
      name: "VCC",
      port_hints: ["pin1", "VCC"],
    },
    {
      type: "source_port",
      source_port_id: "sp_u1_out",
      name: "OUT",
      port_hints: ["pin2"],
    },
    {
      type: "source_port",
      source_port_id: "sp_r1_1",
      name: "1",
      port_hints: ["pin1"],
    },
    {
      type: "source_port",
      source_port_id: "sp_r1_2",
      name: "2",
      port_hints: ["pin2"],
    },
    {
      type: "source_net",
      source_net_id: "sn_v5",
      name: "V5",
      is_ground: false,
      is_power: true,
    },
    {
      type: "source_net",
      source_net_id: "sn_gnd",
      name: "GND",
      is_ground: true,
      is_power: false,
    },
    {
      type: "schematic_component",
      schematic_component_id: "sc_u1",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 1.6 },
      port_labels: { pin1: "5V_IN" },
    },
    {
      type: "schematic_component",
      schematic_component_id: "sc_r1",
      center: { x: 4, y: 0 },
      size: { width: 1.2, height: 0.6 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "sp_sch_u1_vcc",
      schematic_component_id: "sc_u1",
      source_port_id: "sp_u1_vcc",
      center: { x: 0, y: 0.8 },
      facing_direction: "up",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sp_sch_u1_out",
      schematic_component_id: "sc_u1",
      source_port_id: "sp_u1_out",
      center: { x: 1, y: 0 },
      facing_direction: "right",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sp_sch_r1_1",
      schematic_component_id: "sc_r1",
      source_port_id: "sp_r1_1",
      center: { x: 3.4, y: 0 },
      facing_direction: "left",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sp_sch_r1_2",
      schematic_component_id: "sc_r1",
      source_port_id: "sp_r1_2",
      center: { x: 4, y: -0.3 },
      facing_direction: "down",
    },
    {
      type: "schematic_text",
      schematic_text_id: "st_u1_ref",
      schematic_component_id: "sc_u1",
      text: "U1",
      anchor: "left",
      rotation: 0,
      position: { x: -1, y: -1.1 },
      font_size: 0.2,
    },
    {
      type: "schematic_text",
      schematic_text_id: "st_r1_val",
      schematic_component_id: "sc_r1",
      text: "10k",
      anchor: "right",
      rotation: -90,
      position: { x: 4.9, y: 0 },
      font_size: 0.18,
    },
    {
      type: "source_trace",
      source_trace_id: "str_direct",
      connected_source_port_ids: ["sp_u1_out", "sp_r1_1"],
      connected_source_net_ids: [],
      display_name: "U1.OUT to R1.1",
    },
    {
      type: "source_trace",
      source_trace_id: "str_v5",
      connected_source_port_ids: ["sp_u1_vcc"],
      connected_source_net_ids: ["sn_v5"],
    },
    {
      type: "source_trace",
      source_trace_id: "str_gnd",
      connected_source_port_ids: ["sp_r1_2"],
      connected_source_net_ids: ["sn_gnd"],
    },
  ]

  const problem = normalizeBugReportInputProblem(circuitJson)
  expect(() => assertInputProblem(problem)).not.toThrow()
  expect(normalizeBugReportInputProblem({ circuitJson })).toEqual(problem)
  expect(normalizeBugReportInputProblem({ elements: circuitJson })).toEqual(
    problem,
  )

  expect(problem.chips).toHaveLength(2)
  expect(problem.chips[0]?.pins[0]).toMatchObject({
    pinId: "sp_sch_u1_vcc",
    displayName: "5V_IN",
    _facingDirection: "y+",
  })
  expect(problem.directConnections).toEqual([
    { pinIds: ["sp_sch_u1_out", "sp_sch_r1_1"], netId: "U1.OUT to R1.1" },
  ])
  expect(problem.availableNetLabelOrientations["V5"]).toEqual(["y+"])
  expect(problem.availableNetLabelOrientations["GND"]).toEqual(["y-"])
  expect(problem.textBoxes).toHaveLength(2)

  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("separates overlapping multi-sheet Circuit JSON coordinates and scopes cross-sheet nets per sheet", () => {
  const multiSheetCircuitJson = [
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet_0",
      name: "Power",
      sheet_index: 0,
      sheet_width: 100,
      sheet_height: 100,
    },
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet_1",
      name: "MCU",
      sheet_index: 1,
      sheet_width: 100,
      sheet_height: 100,
    },
    {
      type: "source_port",
      source_port_id: "sp_0",
      name: "VOUT",
    },
    {
      type: "source_port",
      source_port_id: "sp_1",
      name: "VIN",
    },
    {
      type: "source_port",
      source_port_id: "sp_cross_a",
      name: "SIG_A",
    },
    {
      type: "source_port",
      source_port_id: "sp_cross_b",
      name: "SIG_B",
    },
    {
      type: "source_net",
      source_net_id: "sn_v5",
      name: "V5",
      is_power: true,
    },
    // Both components sit at sheet-local (0, 0) on different sheets
    {
      type: "schematic_component",
      schematic_component_id: "sc_sheet0",
      schematic_sheet_id: "sheet_0",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 1.2 },
    },
    {
      type: "schematic_component",
      schematic_component_id: "sc_sheet1",
      schematic_sheet_id: "sheet_1",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 1.2 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "sch_p0",
      schematic_component_id: "sc_sheet0",
      schematic_sheet_id: "sheet_0",
      source_port_id: "sp_0",
      center: { x: -1.4, y: 0.2 },
      facing_direction: "left",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sch_cross_a",
      schematic_component_id: "sc_sheet0",
      schematic_sheet_id: "sheet_0",
      source_port_id: "sp_cross_a",
      center: { x: -1.4, y: -0.2 },
      facing_direction: "left",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sch_p1",
      schematic_component_id: "sc_sheet1",
      schematic_sheet_id: "sheet_1",
      source_port_id: "sp_1",
      center: { x: -1.4, y: 0.2 },
      facing_direction: "left",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sch_cross_b",
      schematic_component_id: "sc_sheet1",
      schematic_sheet_id: "sheet_1",
      source_port_id: "sp_cross_b",
      center: { x: -1.4, y: -0.2 },
      facing_direction: "left",
    },
    {
      type: "source_trace",
      source_trace_id: "str_v5",
      connected_source_port_ids: ["sp_0", "sp_1"],
      connected_source_net_ids: ["sn_v5"],
    },
    {
      type: "source_trace",
      source_trace_id: "str_cross_unnamed",
      connected_source_port_ids: ["sp_cross_a", "sp_cross_b"],
      connected_source_net_ids: [],
      display_name: "U1.SIG_A to U2.SIG_B",
    },
  ]

  const problem = normalizeBugReportInputProblem(multiSheetCircuitJson)
  expect(problem.chips).toHaveLength(2)
  const [chip0, chip1] = problem.chips
  expect(chip0!.sectionId).toBe("sheet_0")
  expect(chip1!.sectionId).toBe("sheet_1")
  expect(
    Math.hypot(
      chip1!.center.x - chip0!.center.x,
      chip1!.center.y - chip0!.center.y,
    ),
  ).toBeGreaterThan(100)
  expect(problem.directConnections).toHaveLength(0)
  expect(problem.netConnections).toHaveLength(4)
  expect(problem.netConnections.every((nc) => nc.pinIds.length === 1)).toBe(
    true,
  )

  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("rejects empty arrays, non-Circuit-JSON arrays, and schematic-less Circuit JSON with clear errors", () => {
  expect(() => normalizeBugReportInputProblem(null)).toThrow(
    "input problem must be an object",
  )
  expect(() => normalizeBugReportInputProblem([])).toThrow(
    "input problem must be an object or a Circuit JSON element array",
  )
  expect(() => normalizeBugReportInputProblem([1, 2, 3])).toThrow(
    "input problem must be an object or a Circuit JSON element array",
  )
  expect(() =>
    normalizeBugReportInputProblem([
      { type: "pcb_board", pcb_board_id: "pcb_board_0" },
    ]),
  ).toThrow(
    "Circuit JSON attachment does not contain any schematic_component elements",
  )
  expect(() =>
    normalizeBugReportInputProblem({
      ...createValidInputProblem(),
      chips: [
        {
          chipId: "bad",
          center: { x: 0, y: 0 },
          width: "bad",
          height: 1,
          pins: [],
        },
      ],
    }),
  ).toThrow("chips[0].width must be a finite number")
})

test("inherits component schematic_sheet_id on ports without spawning a phantom default sheet", () => {
  const singleNamedSheetCircuitJson = [
    {
      type: "schematic_sheet",
      schematic_sheet_id: "sheet_1",
      name: "Main",
      sheet_index: 0,
    },
    {
      type: "source_port",
      source_port_id: "sp_a",
      name: "A",
      subcircuit_connectivity_map_key: "conn_net_vcc",
    },
    {
      type: "source_port",
      source_port_id: "sp_b",
      name: "B",
      subcircuit_connectivity_map_key: "conn_net_vcc",
    },
    {
      type: "source_net",
      source_net_id: "sn_vcc",
      name: "VCC",
      is_power: true,
      subcircuit_connectivity_map_key: "conn_net_vcc",
    },
    {
      type: "schematic_component",
      schematic_component_id: "sc_u1",
      schematic_sheet_id: "sheet_1",
      center: { x: 10, y: -5 },
      size: { width: 2, height: 1.4 },
    },
    {
      type: "schematic_component",
      schematic_component_id: "sc_u2",
      schematic_sheet_id: "sheet_1",
      center: { x: 16, y: -5 },
      size: { width: 2, height: 1.4 },
    },
    // Ports intentionally omit schematic_sheet_id (common in real tscircuit exports)
    {
      type: "schematic_port",
      schematic_port_id: "sch_pa",
      schematic_component_id: "sc_u1",
      source_port_id: "sp_a",
      center: { x: 11, y: -5 },
      facing_direction: "right",
    },
    {
      type: "schematic_port",
      schematic_port_id: "sch_pb",
      schematic_component_id: "sc_u2",
      source_port_id: "sp_b",
      center: { x: 15, y: -5 },
      facing_direction: "left",
    },
    // Trace omits connected_source_net_ids but ports link to sn_vcc via subcircuit_connectivity_map_key
    {
      type: "source_trace",
      source_trace_id: "str_vcc",
      connected_source_port_ids: ["sp_a", "sp_b"],
      connected_source_net_ids: [],
      subcircuit_connectivity_map_key: "conn_net_vcc",
    },
  ]

  const problem = normalizeBugReportInputProblem(singleNamedSheetCircuitJson)
  expect(problem.maxMspPairDistance).toBeUndefined()
  expect(problem.chips[0]?.center).toEqual({ x: 10, y: -5 })
  expect(problem.chips[1]?.center).toEqual({ x: 16, y: -5 })
  expect(problem.directConnections).toEqual([])
  expect(problem.netConnections).toEqual([
    {
      netId: "VCC",
      netLabelText: "VCC",
      isGround: false,
      netLabelWidth: 0.54,
      pinIds: ["sch_pa", "sch_pb"],
    },
  ])
})

test("computes rotated schematic_text centers and bounding boxes across 90, -90, 180, and 45 degrees", () => {
  const circuitJson = [
    {
      type: "schematic_component",
      schematic_component_id: "sc_u1",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
    },
    {
      type: "schematic_text",
      schematic_text_id: "st_90",
      text: "ABCD",
      anchor: "left",
      rotation: 90,
      position: { x: 2, y: 3 },
      font_size: 1,
    },
    {
      type: "schematic_text",
      schematic_text_id: "st_neg90",
      text: "ABCD",
      anchor: "left",
      rotation: -90,
      position: { x: 2, y: 3 },
      font_size: 1,
    },
    {
      type: "schematic_text",
      schematic_text_id: "st_180",
      text: "ABCD",
      anchor: "left",
      rotation: 180,
      position: { x: 2, y: 3 },
      font_size: 1,
    },
    {
      type: "schematic_text",
      schematic_text_id: "st_45",
      text: "ABCD",
      anchor: "center",
      rotation: 45,
      position: { x: 0, y: 0 },
      font_size: 1,
    },
  ]

  const problem = normalizeBugReportInputProblem(circuitJson)
  expect(problem.textBoxes).toHaveLength(4)
  const [tb90, tbNeg90, tb180, tb45] = problem.textBoxes!

  // rawWidth = 4 * 1 * 0.65 = 2.6, rawHeight = 1, anchor="left" => localDx = +1.3
  expect(tb90!.width).toBeCloseTo(1, 5)
  expect(tb90!.height).toBeCloseTo(2.6, 5)
  expect(tb90!.center.x).toBeCloseTo(2, 5)
  expect(tb90!.center.y).toBeCloseTo(4.3, 5)

  expect(tbNeg90!.width).toBeCloseTo(1, 5)
  expect(tbNeg90!.height).toBeCloseTo(2.6, 5)
  expect(tbNeg90!.center.x).toBeCloseTo(2, 5)
  expect(tbNeg90!.center.y).toBeCloseTo(1.7, 5)

  expect(tb180!.width).toBeCloseTo(2.6, 5)
  expect(tb180!.height).toBeCloseTo(1, 5)
  expect(tb180!.center.x).toBeCloseTo(0.7, 5)
  expect(tb180!.center.y).toBeCloseTo(3, 5)

  const expectedDiag = (2.6 + 1) * Math.SQRT1_2
  expect(tb45!.width).toBeCloseTo(expectedDiag, 5)
  expect(tb45!.height).toBeCloseTo(expectedDiag, 5)
  expect(tb45!.center.x).toBeCloseTo(0, 5)
  expect(tb45!.center.y).toBeCloseTo(0, 5)
})
