import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("segmentIntersectsRect detects nearly axis-aligned segments crossing a rect", () => {
  const chip8 = {
    minX: 5.555 - 0.555 / 2,
    maxX: 5.555 + 0.555 / 2,
    minY: 1.2 - 0.9 / 2,
    maxY: 1.2 + 0.9 / 2,
  }

  expect(
    segmentIntersectsRect({ x: 5.3999378, y: 1.95 }, { x: 5.4, y: 1.5 }, chip8),
  ).toBe(true)
  expect(
    segmentIntersectsRect({ x: 5.4, y: 1.95 }, { x: 5.4, y: 1.5 }, chip8),
  ).toBe(true)
  expect(
    segmentIntersectsRect(
      { x: 5.3999378, y: 1.65 },
      { x: 5.4, y: 1.95 },
      chip8,
    ),
  ).toBe(false)
})

test("pipeline solver does not route nearly axis-aligned trace through blocking chip", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_4",
        center: { x: 5.4, y: 2.4 },
        width: 0.3041465,
        height: 0.9,
        pins: [
          {
            pinId: "SJ2.1",
            x: 5.3999378,
            y: 1.9499999999999997,
            _facingDirection: "y-",
          },
        ],
      },
      {
        chipId: "schematic_component_5",
        center: { x: 5.555, y: 1.2 },
        width: 1.21,
        height: 0.6,
        pins: [
          {
            pinId: "R3.2",
            x: 5.4,
            y: 1.5,
            _facingDirection: "y+",
          },
        ],
      },
      {
        chipId: "schematic_component_8",
        center: { x: 5.555, y: 1.2 },
        width: 0.555,
        height: 0.9,
        pins: [],
      },
    ],
    directConnections: [
      { pinIds: ["SJ2.1", "R3.2"], netId: ".SJ2 > .pin1 to .R3 > .pin2" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const chip8 = {
    minX: 5.555 - 0.555 / 2,
    maxX: 5.555 + 0.555 / 2,
    minY: 1.2 - 0.9 / 2,
    maxY: 1.2 + 0.9 / 2,
  }

  const traces = solver.netLabelToTraceSolver?.getOutput().traces ?? []
  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      expect(
        segmentIntersectsRect(
          trace.tracePath[i]!,
          trace.tracePath[i + 1]!,
          chip8,
        ),
      ).toBe(false)
    }
  }
})
