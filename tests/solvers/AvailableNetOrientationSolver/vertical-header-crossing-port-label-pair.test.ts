import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

test("places crossing vertical port-only labels on a single-column vertical header without blocking the lower y+ label", () => {
  const inputProblem = {
    chips: [
      {
        chipId: "schematic_component_0",
        center: { x: -16.86275975, y: -3.44 },
        width: 1.075,
        height: 2.2,
        pins: [
          { pinId: "schematic_port_0", x: -16.32525975, y: -2.54 },
          { pinId: "schematic_port_1", x: -16.32525975, y: -2.74 },
          { pinId: "schematic_port_2", x: -16.32525975, y: -2.94 },
          { pinId: "schematic_port_3", x: -16.32525975, y: -3.14 },
          { pinId: "schematic_port_4", x: -16.32525975, y: -3.34 },
          { pinId: "schematic_port_5", x: -16.32525975, y: -3.54 },
          { pinId: "schematic_port_6", x: -16.32525975, y: -3.74 },
          { pinId: "schematic_port_7", x: -16.32525975, y: -3.94 },
          { pinId: "schematic_port_8", x: -16.32525975, y: -4.14 },
          { pinId: "schematic_port_9", x: -16.32525975, y: -4.34 },
        ],
      },
      {
        chipId: "schematic_component_1",
        center: { x: -10, y: -3.44 },
        width: 1,
        height: 2,
        pins: [
          { pinId: "remote_0", x: -10.5, y: -2.54 },
          { pinId: "remote_1", x: -10.5, y: -2.74 },
          { pinId: "remote_2", x: -10.5, y: -2.94 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "VBAT",
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
        pinIds: ["schematic_port_0", "remote_0"],
      },
      {
        netId: "GND",
        isGround: true,
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
        pinIds: ["schematic_port_1", "remote_1"],
      },
      {
        netId: "V3V3",
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
        pinIds: ["schematic_port_2", "remote_2"],
      },
      {
        netId: "EN",
        netLabelWidth: 0.36,
        pinIds: ["schematic_port_3"],
      },
      {
        netId: "UART_TX",
        netLabelWidth: 0.96,
        pinIds: ["schematic_port_4"],
      },
      {
        netId: "GPIO19",
        netLabelWidth: 0.84,
        pinIds: ["schematic_port_5"],
      },
      {
        netId: "GPIO9",
        netLabelWidth: 0.72,
        pinIds: ["schematic_port_6"],
      },
      {
        netId: "GPIO8",
        netLabelWidth: 0.72,
        pinIds: ["schematic_port_7"],
      },
      {
        netId: "GPIO18",
        netLabelWidth: 0.84,
        pinIds: ["schematic_port_8"],
      },
      {
        netId: "GPIO10",
        netLabelWidth: 0.84,
        pinIds: ["schematic_port_9"],
      },
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

  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const placements =
    solver.netLabelToTraceSolver?.getOutput().netLabelPlacements ?? []
  const gndHeaderLabel = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_1"),
  )
  const v3v3HeaderLabel = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_2"),
  )

  expect(gndHeaderLabel?.orientation).toBe("y-")
  expect(v3v3HeaderLabel?.orientation).toBe("y+")
  expect(
    rectsOverlap(
      getRectBounds(
        gndHeaderLabel!.center,
        gndHeaderLabel!.width,
        gndHeaderLabel!.height,
      ),
      getRectBounds(
        v3v3HeaderLabel!.center,
        v3v3HeaderLabel!.width,
        v3v3HeaderLabel!.height,
      ),
    ),
  ).toBe(false)
})
