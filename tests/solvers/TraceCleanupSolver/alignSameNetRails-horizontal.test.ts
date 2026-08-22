import { expect, test } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import {
  align,
  createTrace,
  verticalProblem,
} from "./fixtures/alignSameNetRails"

test("applies the same component-side rule to horizontal rails", () => {
  const inputProblem: InputProblem = {
    ...verticalProblem,
    chips: [
      {
        chipId: "U2",
        center: { x: 0, y: 0 },
        width: 6,
        height: 2,
        pins: [
          { pinId: "U2.1", x: -2, y: 1, _facingDirection: "y+" },
          { pinId: "U2.2", x: 0, y: 1, _facingDirection: "y+" },
          { pinId: "U2.3", x: 2, y: 1, _facingDirection: "y+" },
        ],
      },
    ],
  }
  const inputPins = inputProblem.chips[0]!.pins.map((inputPin) => ({
    ...inputPin,
    chipId: "U2",
  }))
  const traces = [
    createTrace(
      "left",
      [
        { x: -2, y: 1 },
        { x: -2, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
      ],
      [inputPins[0]!, inputPins[1]!],
    ),
    createTrace(
      "right",
      [
        { x: 0, y: 1 },
        { x: 0, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: 1 },
      ],
      [inputPins[1]!, inputPins[2]!],
    ),
  ]

  const result = align(traces, { inputProblem })

  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 1 },
  ])
})
