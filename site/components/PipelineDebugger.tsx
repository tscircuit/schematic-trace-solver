import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo } from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { SolverToolbar } from "./SolverToolbar"
import { PipelineStageTable } from "./PipelineStageTable"

export const PipelineDebugger = ({
  inputProblem,
}: {
  inputProblem: InputProblem
}) => {
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem),
    [],
  )

  return (
    <div>
      <SolverToolbar solver={solver} />
      <InteractiveGraphics graphics={solver.visualize()} />
      <PipelineStageTable pipelineSolver={solver} />
    </div>
  )
}
