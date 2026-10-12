import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo, useReducer } from "react"
import { InteractiveGraphicsCanvas } from "graphics-debug/react"
import { SolverToolbar } from "./SolverToolbar"
import { PipelineStageTable } from "./PipelineStageTable"

export const PipelineDebugger = ({
  inputProblem,
  hideRatsNet = false,
}: {
  inputProblem: InputProblem
  hideRatsNet?: boolean
}) => {
  const [, incRenderCount] = useReducer((x) => x + 1, 0)
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem, { hideRatsNet }),
    [inputProblem, hideRatsNet],
  )

  return (
    <div>
      <SolverToolbar triggerRender={() => incRenderCount()} solver={solver} />
      {/* Canvas preserves world-unit text sizes and rotation when zooming. */}
      <InteractiveGraphicsCanvas graphics={solver.visualize()} />
      <PipelineStageTable
        triggerRender={() => incRenderCount()}
        pipelineSolver={solver}
      />
    </div>
  )
}
