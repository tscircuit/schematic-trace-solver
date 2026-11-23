import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("interleaved same-side vertical power and ground islands both place labels via horizontal-thickness fallback", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 10, y: 14 },
        width: 2.2,
        height: 3.4,
        pins: [
          { pinId: "U1.1", x: 8.9, y: 15.1 },
          { pinId: "U1.2", x: 8.9, y: 14.9 },
          { pinId: "U1.3", x: 8.9, y: 14.7 },
          { pinId: "U1.4", x: 8.9, y: 14.5 },
        ],
      },
      {
        chipId: "C1",
        center: { x: 16, y: 14 },
        width: 1.0,
        height: 1.0,
        pins: [
          { pinId: "C1.1", x: 16, y: 14.5 },
          { pinId: "C1.2", x: 16, y: 13.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND_DIGITAL",
        isGround: true,
        pinIds: ["U1.1", "U1.3", "C1.2"],
        netLabelWidth: 0.42,
        netLabelHeight: 1.2,
      },
      {
        netId: "VDD_CORE_1V8",
        pinIds: ["U1.2", "U1.4", "C1.1"],
        netLabelWidth: 0.42,
        netLabelHeight: 1.32,
      },
    ],
    availableNetLabelOrientations: {
      GND_DIGITAL: ["y-"],
      VDD_CORE_1V8: ["y+"],
    },
    maxMspPairDistance: 2.4,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.netLabelPlacementSolver?.failedGroups ?? []).toHaveLength(0)

  const output = solver.inlineNetLabelSolver!.getOutput()
  const u1Power = output.netLabelPlacements.find(
    (label) =>
      label.netId === "VDD_CORE_1V8" &&
      label.pinIds.includes("U1.2") &&
      label.pinIds.includes("U1.4"),
  )
  const u1Ground = output.netLabelPlacements.find(
    (label) =>
      label.netId === "GND_DIGITAL" &&
      label.pinIds.includes("U1.1") &&
      label.pinIds.includes("U1.3"),
  )

  expect(u1Power?.orientation).toBe("y+")
  expect(u1Ground?.orientation).toBe("y-")
  expect([...getOutputLabelCollisions(output)]).toEqual([])
})

test("horizontal-thickness fallback skips fully wired 2-pin nets and spans containing port-only labels", () => {
  // 1) Fully wired 2-pin net (pinIds.length === 2): already connected by trace, no disconnected island.
  const fullyWiredSolver = new SchematicTracePipelineSolver({
    chips: [
      {
        chipId: "U1",
        center: { x: 10, y: 14 },
        width: 2.2,
        height: 3.4,
        pins: [
          { pinId: "U1.1", x: 8.9, y: 15.1 },
          { pinId: "U1.2", x: 8.9, y: 14.9 },
          { pinId: "U1.3", x: 8.9, y: 14.7 },
          { pinId: "U1.4", x: 8.9, y: 14.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        isGround: true,
        pinIds: ["U1.1", "U1.3"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
      },
      {
        netId: "VCC_LOCAL",
        pinIds: ["U1.2", "U1.4"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.96,
      },
    ],
    availableNetLabelOrientations: {
      GND: ["y-"],
      VCC_LOCAL: ["y+"],
    },
    maxMspPairDistance: 2.4,
  })
  fullyWiredSolver.solve()
  expect(
    fullyWiredSolver.netLabelPlacementSolver?.failedGroups.some(
      (group) => group.netId === "VCC_LOCAL",
    ),
  ).toBe(true)

  // 2) Span containing a port-only label at U1.5 (y = 14.7 inside [14.5, 15.1]) is skipped.
  const portOnlyInSpanSolver = new SchematicTracePipelineSolver({
    chips: [
      {
        chipId: "U1",
        center: { x: 10, y: 14 },
        width: 2.2,
        height: 3.6,
        pins: [
          { pinId: "U1.1", x: 8.9, y: 15.3 },
          { pinId: "U1.2", x: 8.9, y: 15.1 },
          { pinId: "U1.3", x: 8.9, y: 14.9 },
          { pinId: "U1.5", x: 8.9, y: 14.7 },
          { pinId: "U1.4", x: 8.9, y: 14.5 },
        ],
      },
      {
        chipId: "C1",
        center: { x: 16, y: 14 },
        width: 1.0,
        height: 1.0,
        pins: [
          { pinId: "C1.1", x: 16, y: 14.5 },
          { pinId: "C1.2", x: 16, y: 13.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        isGround: true,
        pinIds: ["U1.1", "U1.3", "C1.2"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
      },
      {
        netId: "SIG_PORT",
        pinIds: ["U1.5"],
        netLabelWidth: 0.72,
      },
      {
        netId: "VCC_SPAN",
        pinIds: ["U1.2", "U1.4", "C1.1"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.96,
      },
    ],
    availableNetLabelOrientations: {
      GND: ["y-"],
      SIG_PORT: ["x-", "x+"],
      VCC_SPAN: ["y+"],
    },
    maxMspPairDistance: 2.4,
  })
  portOnlyInSpanSolver.solve()
  expect(
    portOnlyInSpanSolver.netLabelPlacementSolver?.failedGroups.some(
      (group) => group.netId === "VCC_SPAN",
    ),
  ).toBe(true)
  expect(
    portOnlyInSpanSolver.netLabelPlacementSolver?.netLabelPlacements.some(
      (label) => label.netId === "VCC_SPAN" && label.pinIds.includes("U1.2"),
    ),
  ).toBe(false)
})
