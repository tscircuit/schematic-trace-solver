import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { DownloadDropdown } from "./DownloadDropdown"

export const getSolverChain = (solver: BaseSolver): BaseSolver[] => {
  if (!solver.activeSubSolver) {
    return [solver]
  }
  return [solver, ...getSolverChain(solver.activeSubSolver)]
}

/**
 * Displays each solver in the chain as a breadcrumb with download functionality
 */
export const SolverBreadcrumbInputDownloader = ({
  solver,
}: {
  solver: BaseSolver
}) => {
  const solverChain = getSolverChain(solver)

  return (
    <div className="flex gap-1 items-center text-sm pt-1">
      {solverChain.map((s, index) => (
        <div key={s.constructor.name} className="flex items-center">
          {index > 0 && <span className="text-gray-400 mx-1">→</span>}
          <DownloadDropdown solver={s} />
        </div>
      ))}
    </div>
  )
}
