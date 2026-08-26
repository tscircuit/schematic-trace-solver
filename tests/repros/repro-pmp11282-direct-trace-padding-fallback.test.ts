import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Reduced from C504.pin2 -> R504.pin1 in the PMP11282 reproduction. The
// outward-facing pins need a small U-shaped trace beside H500. Its text is
// physically clear, but the fallback net-label padding closes that route.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_4",
      center: { x: 1.55125, y: 5.84 },
      width: 0.6000000000000001,
      height: 0.8399999999999999,
      pins: [
        {
          pinId: "schematic_port_8",
          x: 1.25125,
          y: 5.84,
          _facingDirection: "x-",
        },
        {
          pinId: "schematic_port_9",
          x: 1.85125,
          y: 5.84,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "schematic_component_37",
      center: { x: 0.73, y: 5.84 },
      width: 0.6000000000000001,
      height: 0.6799999999999997,
      pins: [
        {
          pinId: "schematic_port_74",
          x: 0.42999999999999994,
          y: 5.84,
          _facingDirection: "x-",
        },
        {
          pinId: "schematic_port_75",
          x: 1.03,
          y: 5.84,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "schematic_component_103",
      center: { x: 3.257624999999999, y: 5.989650000000001 },
      width: 2.6000000000000014,
      height: 0.5999999999999996,
      pins: [
        {
          pinId: "schematic_port_266",
          x: 1.9576249999999984,
          y: 6.089650000000001,
        },
        {
          pinId: "schematic_port_267",
          x: 1.9576249999999984,
          y: 5.889650000000001,
        },
        {
          pinId: "schematic_port_268",
          x: 4.557625,
          y: 5.989650000000001,
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: "C504.pin2 to R504.pin1",
      pinIds: ["schematic_port_9", "schematic_port_74"],
    },
  ],
  netConnections: [],
  textBoxes: [
    {
      chipId: "schematic_component_103",
      center: { x: 3.137624999999999, y: 5.559650000000001 },
      width: 1.56,
      height: 0.17999999999999972,
      text: "782653B04250G",
    },
    {
      chipId: "schematic_component_103",
      center: { x: 2.597624999999999, y: 6.40465 },
      width: 0.6000000000000001,
      height: 0.2499999999999991,
      text: "H500",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 100,
}

const targetPairId = "schematic_port_9-schematic_port_74"
const targetNetId = "C504.pin2 to R504.pin1"

test("PMP11282 direct trace falls back after padded text blocks its escape", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.map(
      (pair) => pair.mspPairId,
    ),
  ).toContain(targetPairId)
  expect(
    solver.schematicTraceLinesSolver!.solvedTracePaths.map(
      (trace) => trace.mspPairId,
    ),
  ).not.toContain(targetPairId)
  expect(
    solver
      .inlineNetLabelSolver!.getOutput()
      .netLabelPlacements.filter((label) => label.netId === targetNetId),
  ).toHaveLength(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
