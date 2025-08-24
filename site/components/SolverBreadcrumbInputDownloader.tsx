import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

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

  const downloadSolverParams = (s: BaseSolver) => {
    try {
      if (typeof s.getConstructorParams !== "function") {
        alert(
          `getConstructorParams() is not implemented for ${s.constructor.name}`,
        )
        return
      }

      const params = s.getConstructorParams()
      const blob = new Blob([JSON.stringify(params, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${s.constructor.name}_params.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(
        `Error downloading params for ${s.constructor.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return (
    <div className="flex gap-1 items-center text-sm pt-1">
      {solverChain.map((s, index) => (
        <div key={s.constructor.name} className="flex items-center">
          {index > 0 && <span className="text-gray-400 mx-1">→</span>}
          <button
            className="px-2 py-1 rounded text-xs cursor-pointer"
            onClick={() => downloadSolverParams(s)}
            title={`Download constructor params for ${s.constructor.name}`}
          >
            {s.constructor.name}
          </button>
        </div>
      ))}
    </div>
  )
}
