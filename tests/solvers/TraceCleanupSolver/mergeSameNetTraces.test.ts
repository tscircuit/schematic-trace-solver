import { expect, test } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import {
  align,
  createTrace,
  verticalProblem,
  getVerticalPin,
} from "./fixtures/alignSameNetRails"

test("merges same-net trace lines at same Y coordinate", () => {
  const inputProblem: InputProblem = {
    ...verticalProblem,
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 6,
        pins: [
          { pinId: "U1.1", x: -1, y: 2, _facingDirection: "x-" },
          { pinId: "U1.2", x: -1, y: 0, _facingDirection: "x-" },
          { pinId: "U1.3", x: -1, y: -2, _facingDirection: "x-" },
        ],
      },
    ],
  }

  const traces = [
    createTrace(
      "trace_a",
      [
        { x: -1, y: 2 },
        { x: -2, y: 2 },
        { x: -2, y: 0 },
        { x: -1, y: 0 },
      ],
      [getVerticalPin("U1.1"), getVerticalPin("U1.2")],
    ),
    createTrace(
      "trace_b",
      [
        { x: -1, y: 0 },
        { x: -2.5, y: 0 },
        { x: -2.5, y: -2 },
        { x: -1, y: -2 },
      ],
      [getVerticalPin("U1.2"), getVerticalPin("U1.3")],
    ),
  ]

  const result = align(traces, { inputProblem })

  expect(result.alignedRailGroupCount).toBeGreaterThan(0)

  const traceA = result.traces.find((t) => t.mspPairId === "trace_a")!
  const traceB = result.traces.find((t) => t.mspPairId === "trace_b")!

  const traceARailX = traceA.tracePath.find((p, i) => i > 0 && i < traceA.tracePath.length - 1 && p.x !== -1)?.x
  const traceBRailX = traceB.tracePath.find((p, i) => i > 0 && i < traceB.tracePath.length - 1 && p.x !== -1)?.x

  expect(traceARailX).toBe(traceBRailX)
})

test("merges same-net trace lines at same X coordinate (vertical rails)", () => {
  const traces = [
    createTrace(
      "upper",
      [
        { x: -1, y: 2 },
        { x: -2, y: 2 },
        { x: -2, y: 0 },
        { x: -1, y: 0 },
      ],
      [getVerticalPin("U1.1"), getVerticalPin("U1.2")],
    ),
    createTrace(
      "lower",
      [
        { x: -1, y: 0 },
        { x: -3, y: 0 },
        { x: -3, y: -2 },
        { x: -1, y: -2 },
      ],
      [getVerticalPin("U1.2"), getVerticalPin("U1.3")],
    ),
  ]

  const result = align(traces)

  expect(result.alignedRailGroupCount).toBeGreaterThan(0)

  const upper = result.traces.find((t) => t.mspPairId === "upper")!
  const lower = result.traces.find((t) => t.mspPairId === "lower")!

  const upperRailX = upper.tracePath.find((p, i) => i > 0 && i < upper.tracePath.length - 1 && p.x !== -1)?.x
  const lowerRailX = lower.tracePath.find((p, i) => i > 0 && i < lower.tracePath.length - 1 && p.x !== -1)?.x

  expect(upperRailX).toBe(lowerRailX)
})
