import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import pcm5122ProblemJson from "./assets/repro-pcm5122-dac-label-overlap.input.json"
import stm32f401ProblemJson from "./assets/repro-stm32f401-snare-pot-label-overlap.input.json"

const cloneWithInlineSetting = (
  baseProblem: unknown,
  allowInlineNetLabel: boolean,
): InputProblem => {
  const problem = structuredClone(baseProblem) as InputProblem
  for (const directConnection of problem.directConnections ?? []) {
    if (allowInlineNetLabel) {
      directConnection.allowInlineNetLabel = true
    } else {
      delete directConnection.allowInlineNetLabel
    }
  }
  for (const netConnection of problem.netConnections ?? []) {
    if (allowInlineNetLabel) {
      netConnection.allowInlineNetLabel = true
    } else {
      delete netConnection.allowInlineNetLabel
    }
  }
  return problem
}

test("avoids same-side ground loop trace and label collisions on PCM5122 DAC (#1300)", () => {
  for (const allowInlineNetLabel of [false, true]) {
    const solver = new SchematicTracePipelineSolver(
      cloneWithInlineSetting(pcm5122ProblemJson, allowInlineNetLabel),
    )
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(
      getOutputLabelCollisions(solver.inlineNetLabelSolver!.getOutput()),
    ).toEqual([])
  }
})

test("avoids same-side ground loop trace and label collisions on STM32F401 snare pot (#1301)", () => {
  for (const allowInlineNetLabel of [false, true]) {
    const solver = new SchematicTracePipelineSolver(
      cloneWithInlineSetting(stm32f401ProblemJson, allowInlineNetLabel),
    )
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(
      getOutputLabelCollisions(solver.inlineNetLabelSolver!.getOutput()),
    ).toEqual([])
  }
})
