import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_23",
      center: { x: 11.084375, y: -5.325 },
      width: 2.3000000000000007,
      height: 3.2000000000000006,
      pins: [
        { pinId: "schematic_port_75", x: 9.934375, y: -4.325 },
        { pinId: "schematic_port_79", x: 9.934375, y: -5.125 },
        { pinId: "schematic_port_80", x: 9.934375, y: -5.325 },
        { pinId: "schematic_port_96", x: 12.234375, y: -5.025 },
        { pinId: "schematic_port_100", x: 12.234375, y: -4.2250000000000005 },
        { pinId: "schematic_port_101", x: 12.234375, y: -4.025 },
      ],
      sectionId: "USB to UART",
    },
    {
      chipId: "schematic_component_26",
      center: { x: 7.629375, y: -3.9250000000000007 },
      width: 0.7800000000000002,
      height: 0.7600000000000011,
      pins: [
        {
          pinId: "schematic_port_106",
          x: 7.564375,
          y: -4.3050000000000015,
          _facingDirection: "y-",
        },
      ],
      sectionId: "USB to UART",
    },
    {
      chipId: "schematic_component_27",
      center: { x: 9.221875, y: -5.55 },
      width: 1.205,
      height: 0.5999999999999996,
      pins: [
        {
          pinId: "schematic_port_108",
          x: 8.944374999999999,
          y: -5.25,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_109",
          x: 8.944374999999999,
          y: -5.85,
          _facingDirection: "y-",
        },
      ],
      sectionId: "USB to UART",
    },
    {
      chipId: "schematic_component_28",
      center: { x: 9.221875, y: -4.23 },
      width: 1.205,
      height: 0.6000000000000014,
      pins: [
        {
          pinId: "schematic_port_111",
          x: 8.944374999999999,
          y: -3.9299999999999997,
        },
      ],
      sectionId: "USB to UART",
    },
    {
      chipId: "schematic_component_32",
      center: { x: 15.769374999999998, y: -4.724999999999999 },
      width: 2,
      height: 0.8000000000000007,
      pins: [
        {
          pinId: "schematic_port_118",
          x: 14.769374999999998,
          y: -4.524999999999999,
        },
        {
          pinId: "schematic_port_119",
          x: 14.769374999999998,
          y: -4.724999999999999,
        },
        {
          pinId: "schematic_port_121",
          x: 16.769374999999997,
          y: -4.924999999999999,
        },
        {
          pinId: "schematic_port_122",
          x: 16.769374999999997,
          y: -4.724999999999999,
        },
      ],
      sectionId: "USB to UART",
    },
  ],
  directConnections: [
    {
      netId: ".R5 > .pin1 to .U6 > .VBUS",
      pinIds: ["schematic_port_108", "schematic_port_80"],
    },
  ],
  netConnections: [
    {
      netId: "GND",
      isGround: true,
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: [
        "schematic_port_75",
        "schematic_port_101",
        "schematic_port_106",
        "schematic_port_109",
      ],
    },
    {
      netId: "VBUS",
      netLabelWidth: 0.42,
      netLabelHeight: 0.6,
      pinIds: ["schematic_port_79", "schematic_port_111"],
    },
    {
      netId: "RTS",
      netLabelWidth: 0.48,
      pinIds: ["schematic_port_96", "schematic_port_118", "schematic_port_122"],
    },
    {
      netId: "DTR",
      netLabelWidth: 0.48,
      pinIds: [
        "schematic_port_100",
        "schematic_port_119",
        "schematic_port_121",
      ],
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: {
    GND: ["y-"],
    VBUS: ["y+"],
    RTS: ["x-", "x+"],
    DTR: ["x-", "x+"],
  },
  maxMspPairDistance: 8,
  _hideRatsNet: false,
}

test("oscillating net pair in TraceOverlapShiftSolver does not abort independent RTS/DTR overlap resolution (#1102)", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  const shiftSolver = solver.traceOverlapShiftSolver!
  expect(shiftSolver.oscillatingNetPairKeys.size).toBe(1)

  const traces = Object.values(shiftSolver.correctedTraceMap)
  const rtsTraces = traces.filter((t) =>
    t.pins.some((p) => p.pinId === "schematic_port_96"),
  )
  const dtrTraces = traces.filter((t) =>
    t.pins.some((p) => p.pinId === "schematic_port_100"),
  )
  expect(rtsTraces.length).toBeGreaterThan(0)
  expect(dtrTraces.length).toBeGreaterThan(0)

  const EPS = 2e-3
  for (const rts of rtsTraces) {
    for (let i = 0; i < rts.tracePath.length - 1; i++) {
      const a1 = rts.tracePath[i]!
      const a2 = rts.tracePath[i + 1]!
      const aVert = Math.abs(a1.x - a2.x) < EPS
      const aHorz = Math.abs(a1.y - a2.y) < EPS
      for (const dtr of dtrTraces) {
        for (let j = 0; j < dtr.tracePath.length - 1; j++) {
          const b1 = dtr.tracePath[j]!
          const b2 = dtr.tracePath[j + 1]!
          const bVert = Math.abs(b1.x - b2.x) < EPS
          const bHorz = Math.abs(b1.y - b2.y) < EPS
          if (aVert && bVert && Math.abs(a1.x - b1.x) < EPS) {
            const overlap =
              Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) -
              Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
            expect(overlap).toBeLessThanOrEqual(EPS)
          }
          if (aHorz && bHorz && Math.abs(a1.y - b1.y) < EPS) {
            const overlap =
              Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) -
              Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
            expect(overlap).toBeLessThanOrEqual(EPS)
          }
        }
      }
    }
  }
})
