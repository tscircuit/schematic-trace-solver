import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import {
  align,
  getVerticalRailTraces,
  verticalProblem,
} from "./fixtures/alignSameNetRails"

test("does not combine rails from different component sides", () => {
  const traces = getVerticalRailTraces()
  traces[1] = {
    ...traces[1]!,
    pins: traces[1]!.pins.map((item) => ({ ...item, chipId: "U2" })) as [
      SolvedTracePath["pins"][0],
      SolvedTracePath["pins"][1],
    ],
  }
  const inputProblem: InputProblem = {
    ...verticalProblem,
    chips: [
      ...verticalProblem.chips,
      {
        ...verticalProblem.chips[0]!,
        chipId: "U2",
        pins: verticalProblem.chips[0]!.pins.map((item) => ({
          ...item,
          pinId: item.pinId.replace("U1", "U2"),
        })),
      },
    ],
  }

  const result = align(traces, { inputProblem })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
