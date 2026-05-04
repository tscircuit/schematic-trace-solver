import { InteractiveGraphics } from "graphics-debug/react"
import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { useReducer } from "react"
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
