import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { useReducer } from "react"
import { SolverBreadcrumbInputDownloader } from "./SolverBreadcrumbInputDownloader"

/**
 * The solver toolbar offers various actions for progressing the solver
 * - "Step" - call solver.step()
 * - "Solve" - call solver.solve()
 * - "Animate" - call solver.step() at 40 iterations/second until solved or failed
 *   - When animate is pressed, show "Stop" button
 *
 * The toolbar also displays the number of iterations (solver.iterations)
 *
 * After any action, we need to incRenderCount internally to trigger a rerender
 */
export const SolverToolbar = ({ solver }: { solver: BaseSolver }) => {
  const [, incRenderCount] = useReducer((x) => x + 1, 0)

  // TODO
  return (
    <div>
      <SolverBreadcrumbInputDownloader solver={solver} />
      <div>{/* buttons */}</div>
      {solver.failed && (
        <div className="text-red-500">Failed: {solver.error}</div>
      )}
    </div>
  )
}
