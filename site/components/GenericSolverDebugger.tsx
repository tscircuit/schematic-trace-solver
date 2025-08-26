import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo, useReducer } from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { SolverToolbar } from "./SolverToolbar"

export const GenericSolverDebugger = ({ solver }: { solver: BaseSolver }) => {
  const [, incRenderCount] = useReducer((x) => x + 1, 0)

  return (
    <div>
      <SolverToolbar triggerRender={() => incRenderCount()} solver={solver} />
      <InteractiveGraphics graphics={solver.visualize()} />
    </div>
  )
}
