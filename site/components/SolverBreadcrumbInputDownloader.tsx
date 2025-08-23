import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

export const getSolverChain = (solver: BaseSolver): BaseSolver[] => {
  if (!solver.activeSubSolver) {
    return [solver]
  }
  return [solver, ...getSolverChain(solver.activeSubSolver)]
}

/**
 * Displays each
 */
export const SolverBreadcrumbInputDownloader = ({
  solver,
}: {
  solver: BaseSolver
}) => {
  const solverChain = getSolverChain(solver)
  return (
    <div>
      {solverChain.map((s) => (
        <div
          className="bg-gray-500 hover:bg-gray-600 hover:underline hover:pointer"
          onClick={() => {
            // TODO download solver.getConstructorParams()
            // alert with error with constructor name if the function isn't implemented
          }}
          key={s.constructor.name}
        >
          {s.constructor.name}
        </div>
      ))}
    </div>
  )
}
