import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo, useReducer } from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { SolverToolbar } from "./SolverToolbar"
import { PipelineStageTable } from "./PipelineStageTable"

export const PipelineDebugger = ({
  inputProblem,
}: {
  inputProblem: InputProblem
}) => {
  const [, incRenderCount] = useReducer((x) => x + 1, 0)
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem),
    [],
  )

  return (
    <div>
      <SolverToolbar
        triggerRender={() => {
          incRenderCount()
        }}
        solver={solver}
      />
      <InteractiveGraphics graphics={solver.visualize()} />
      <PipelineStageTable pipelineSolver={solver} />
    </div>
  )
}
