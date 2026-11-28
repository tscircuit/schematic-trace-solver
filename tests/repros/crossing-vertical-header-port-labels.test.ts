import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("crossing vertical port-only labels on single-column header place V3V3 as y+ and GND as y- without overlap", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_0",
        center: { x: -16.86275975, y: -3.44 },
        width: 1.075,
        height: 2.2,
        pins: [
          {
            pinId: "schematic_port_0",
            x: -16.32525975,
            y: -2.54,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_1",
            x: -16.32525975,
            y: -2.74,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_2",
            x: -16.32525975,
            y: -2.94,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_3",
            x: -16.32525975,
            y: -3.14,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_4",
            x: -16.32525975,
            y: -3.34,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_5",
            x: -16.32525975,
            y: -3.54,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_6",
            x: -16.32525975,
            y: -3.74,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_7",
            x: -16.32525975,
            y: -3.94,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_8",
            x: -16.32525975,
            y: -4.14,
            _facingDirection: "x+",
          },
          {
            pinId: "schematic_port_9",
            x: -16.32525975,
            y: -4.34,
            _facingDirection: "x+",
          },
        ],
      },
      {
        chipId: "schematic_component_remote",
        center: { x: -10, y: -3.44 },
        width: 1,
        height: 2,
        pins: [
          {
            pinId: "remote_vbat_a",
            x: -10.5,
            y: -2.6,
            _facingDirection: "x-",
          },
          {
            pinId: "remote_vbat_b",
            x: -10.5,
            y: -2.8,
            _facingDirection: "x-",
          },
          { pinId: "remote_gnd_a", x: -10.5, y: -3.2, _facingDirection: "x-" },
          { pinId: "remote_gnd_b", x: -10.5, y: -3.4, _facingDirection: "x-" },
          {
            pinId: "remote_v3v3_a",
            x: -10.5,
            y: -3.8,
            _facingDirection: "x-",
          },
          {
            pinId: "remote_v3v3_b",
            x: -10.5,
            y: -4.0,
            _facingDirection: "x-",
          },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "VBAT",
        pinIds: ["schematic_port_0", "remote_vbat_a", "remote_vbat_b"],
      },
      {
        netId: "GND",
        isGround: true,
        pinIds: ["schematic_port_1", "remote_gnd_a", "remote_gnd_b"],
      },
      {
        netId: "V3V3",
        pinIds: ["schematic_port_2", "remote_v3v3_a", "remote_v3v3_b"],
      },
      { netId: "EN", pinIds: ["schematic_port_3"] },
      { netId: "UART_TX", pinIds: ["schematic_port_4"] },
      { netId: "GPIO19", pinIds: ["schematic_port_5"] },
      { netId: "GPIO9", pinIds: ["schematic_port_6"] },
      { netId: "GPIO8", pinIds: ["schematic_port_7"] },
      { netId: "GPIO18", pinIds: ["schematic_port_8"] },
      { netId: "GPIO10", pinIds: ["schematic_port_9"] },
    ],
    textBoxes: [
      {
        chipId: "schematic_component_0",
        center: { x: -16.81705975, y: -4.67 },
        width: 1.1664,
        height: 0.18,
        text: "2.54-1*10PPin",
      },
      {
        chipId: "schematic_component_0",
        center: { x: -17.30485975, y: -2.225 },
        width: 0.3108,
        height: 0.25,
        text: "J1",
      },
    ],
    availableNetLabelOrientations: {
      VBAT: ["y+"],
      GND: ["y-"],
      V3V3: ["y+"],
      EN: ["x+", "x-"],
      UART_TX: ["x+", "x-"],
      GPIO19: ["x+", "x-"],
      GPIO9: ["x+", "x-"],
      GPIO8: ["x+", "x-"],
      GPIO18: ["x+", "x-"],
      GPIO10: ["x+", "x-"],
    },
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const placements =
    solver.netLabelToTraceSolver?.getOutput().netLabelPlacements ?? []
  const vbatHeaderLabel = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_0"),
  )
  const gndHeaderLabel = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_1"),
  )
  const v3v3HeaderLabel = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_2"),
  )

  expect(vbatHeaderLabel?.orientation).toBe("y+")
  expect(gndHeaderLabel?.orientation).toBe("y-")
  expect(v3v3HeaderLabel?.orientation).toBe("y+")
  expect(gndHeaderLabel).toBeDefined()
  expect(v3v3HeaderLabel).toBeDefined()
  if (gndHeaderLabel && v3v3HeaderLabel) {
    expect(
      rectsOverlap(
        getRectBounds(
          gndHeaderLabel.center,
          gndHeaderLabel.width,
          gndHeaderLabel.height,
        ),
        getRectBounds(
          v3v3HeaderLabel.center,
          v3v3HeaderLabel.width,
          v3v3HeaderLabel.height,
        ),
      ),
    ).toBe(false)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
