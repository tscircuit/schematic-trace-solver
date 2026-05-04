import { InteractiveGraphics } from "graphics-debug/react"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo, useReducer } from "react"
import { PipelineStageTable } from "./PipelineStageTable"
import { SolverToolbar } from "./SolverToolbar"

export const PipelineDebugger = ({
  inputProblem,
}: {
  inputProblem: InputProblem
}) => {
  const [, incRenderCount] = useReducer((x) => x + 1, 0)
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem),
    [inputProblem],
  )

  return (
    <div>
      <SolverToolbar triggerRender={() => incRenderCount()} solver={solver} />
      <InteractiveGraphics graphics={solver.visualize()} />
      <PipelineStageTable
        triggerRender={() => incRenderCount()}
        pipelineSolver={solver}
      />
    </div>
  )
}
