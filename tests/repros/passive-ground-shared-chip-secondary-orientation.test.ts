import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("falls back to shifted secondary orientation when primary horizontal shift is blocked on a passive sharing ground", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_43",
        center: { x: 0.155, y: -36 },
        width: 1.21,
        height: 0.6,
        pins: [
          {
            pinId: "schematic_port_118",
            x: 0,
            y: -36.3,
            _facingDirection: "y-",
          },
          {
            pinId: "schematic_port_119",
            x: 0,
            y: -35.7,
            _facingDirection: "y+",
          },
        ],
      },
      {
        chipId: "schematic_component_50",
        center: { x: 0, y: -42 },
        width: 0.6,
        height: 0.68,
        pins: [
          {
            pinId: "schematic_port_147",
            x: -0.3,
            y: -42,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_148",
            x: 0.3,
            y: -42,
            _facingDirection: "x+",
          },
        ],
      },
      {
        chipId: "schematic_component_55",
        center: { x: 0.095, y: -48 },
        width: 1.09,
        height: 0.6,
        pins: [
          {
            pinId: "schematic_port_158",
            x: 0,
            y: -47.7,
            _facingDirection: "y+",
          },
          {
            pinId: "schematic_port_159",
            x: 0,
            y: -48.3,
            _facingDirection: "y-",
          },
        ],
      },
      {
        chipId: "schematic_component_73",
        center: { x: 45, y: -60 },
        width: 4.8,
        height: 0.6,
        pins: [
          {
            pinId: "schematic_port_340",
            x: 42.6,
            y: -59.9,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_341",
            x: 42.6,
            y: -60.1,
            _facingDirection: "x-",
          },
          {
            pinId: "schematic_port_342",
            x: 47.4,
            y: -59.9,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_343",
            x: 47.4,
            y: -60.1,
            _facingDirection: "x+",
          },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "Net_R3_Pad1",
        isGround: false,
        netLabelWidth: 1.44,
        pinIds: ["schematic_port_158"],
      },
      {
        netId: "GND",
        isGround: true,
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
        pinIds: [
          "schematic_port_118",
          "schematic_port_159",
          "schematic_port_341",
          "schematic_port_343",
        ],
      },
      {
        netId: "Net_RESET1_Pad1",
        isGround: false,
        netLabelWidth: 1.92,
        pinIds: ["schematic_port_340", "schematic_port_342"],
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: {
      Net_R3_Pad1: ["x-", "x+"],
      GND: ["y-"],
      Net_RESET1_Pad1: ["x-", "x+"],
    },
    maxMspPairDistance: 2.4,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const placements =
    solver.netLabelToTraceSolver?.getOutput().netLabelPlacements ?? []
  const r3Label = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_158"),
  )
  const gndLabels = placements.filter((nl) => nl.netId === "GND")

  expect(r3Label).toBeDefined()
  expect(r3Label?.orientation).toBe("x+")
  expect(gndLabels.length).toBeGreaterThan(0)
  for (const gnd of gndLabels) {
    expect(gnd.orientation).toBe("y-")
    if (r3Label) {
      expect(
        rectsOverlap(
          getRectBounds(r3Label.center, r3Label.width, r3Label.height),
          getRectBounds(gnd.center, gnd.width, gnd.height),
        ),
      ).toBe(false)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
