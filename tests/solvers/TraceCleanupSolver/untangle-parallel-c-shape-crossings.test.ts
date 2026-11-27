import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"

test("untangles interlocking C-shaped parallel capacitor rails onto opposite sides (#624)", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_5",
        center: { x: 2.46810893, y: 8.095 },
        width: 1.68,
        height: 1.1,
        pins: [
          {
            pinId: "C_VM_BYPASS.1",
            x: 1.89310893,
            y: 8.645,
          },
          {
            pinId: "C_VM_BYPASS.2",
            x: 1.89310893,
            y: 7.545,
          },
        ],
      },
      {
        chipId: "schematic_component_6",
        center: { x: 2.34810893, y: 10.405 },
        width: 1.44,
        height: 1.1,
        pins: [
          {
            pinId: "C_VM_BULK.1",
            x: 1.89310893,
            y: 10.955,
          },
          {
            pinId: "C_VM_BULK.2",
            x: 1.89310893,
            y: 9.855,
          },
        ],
      },
    ],
    directConnections: [
      {
        pinIds: ["C_VM_BYPASS.1", "C_VM_BULK.1"],
        netId: "VM",
      },
      {
        pinIds: ["C_VM_BYPASS.2", "C_VM_BULK.2"],
        netId: "GND",
      },
    ],
    netConnections: [
      {
        netId: "VM",
        pinIds: ["C_VM_BYPASS.1", "C_VM_BULK.1"],
        netLabelWidth: 0.48,
      },
      {
        netId: "GND",
        isGround: true,
        pinIds: ["C_VM_BYPASS.2", "C_VM_BULK.2"],
        netLabelWidth: 0.48,
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: {
      VM: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 2.4,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  const vmTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("C_VM_BYPASS.1") &&
      trace.pinIds.includes("C_VM_BULK.1"),
  )!
  const gndTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("C_VM_BYPASS.2") &&
      trace.pinIds.includes("C_VM_BULK.2"),
  )!

  expect(vmTrace).toBeDefined()
  expect(gndTrace).toBeDefined()
  expect(
    findPerpendicularPathCrossings(vmTrace.tracePath, gndTrace.tracePath, {
      includeTerminalSegments: true,
    }),
  ).toEqual([])
})

test("untangles horizontal interlocking C-shaped parallel rails", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "left_cap",
        center: { x: 8.095, y: 2.46810893 },
        width: 1.1,
        height: 1.68,
        pins: [
          { pinId: "C1.1", x: 8.645, y: 1.89310893 },
          { pinId: "C1.2", x: 7.545, y: 1.89310893 },
        ],
      },
      {
        chipId: "right_cap",
        center: { x: 10.405, y: 2.34810893 },
        width: 1.1,
        height: 1.44,
        pins: [
          { pinId: "C2.1", x: 10.955, y: 1.89310893 },
          { pinId: "C2.2", x: 9.855, y: 1.89310893 },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["C1.1", "C2.1"], netId: "VM" },
      { pinIds: ["C1.2", "C2.2"], netId: "GND" },
    ],
    netConnections: [
      { netId: "VM", pinIds: ["C1.1", "C2.1"], netLabelWidth: 0.48 },
      {
        netId: "GND",
        isGround: true,
        pinIds: ["C1.2", "C2.2"],
        netLabelWidth: 0.48,
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: { VM: ["x+"], GND: ["x-"] },
    maxMspPairDistance: 2.4,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  const vmTrace = traces.find(
    (trace) => trace.pinIds.includes("C1.1") && trace.pinIds.includes("C2.1"),
  )!
  const gndTrace = traces.find(
    (trace) => trace.pinIds.includes("C1.2") && trace.pinIds.includes("C2.2"),
  )!
  expect(
    findPerpendicularPathCrossings(vmTrace.tracePath, gndTrace.tracePath, {
      includeTerminalSegments: true,
    }),
  ).toEqual([])
})
