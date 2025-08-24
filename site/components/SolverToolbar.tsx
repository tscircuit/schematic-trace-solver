import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { useReducer, useRef, useEffect } from "react"
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
  const [isAnimating, setIsAnimating] = useReducer((x) => !x, false)
  const [, incRenderCount] = useReducer((x) => x + 1, 0)
  const animationRef = useRef<number | undefined>(undefined)

  const handleStep = () => {
    solver.step()
    incRenderCount()
  }

  const handleSolve = () => {
    solver.solve()
    incRenderCount()
  }

  const handleAnimate = () => {
    if (isAnimating) {
      if (animationRef.current) {
        clearInterval(animationRef.current)
        animationRef.current = undefined
      }
      setIsAnimating()
    } else {
      setIsAnimating()
      animationRef.current = window.setInterval(() => {
        if (solver.solved || solver.failed) {
          if (animationRef.current) {
            clearInterval(animationRef.current)
            animationRef.current = undefined
          }
          setIsAnimating()
          incRenderCount()
          return
        }
        solver.step()
        incRenderCount()
      }, 25) // 40 iterations/second = 25ms interval
    }
  }

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if ((solver.solved || solver.failed) && isAnimating) {
      if (animationRef.current) {
        clearInterval(animationRef.current)
        animationRef.current = undefined
      }
      setIsAnimating()
    }
  }, [solver.solved, solver.failed, isAnimating])

  return (
    <div className="space-y-4 px-1">
      <SolverBreadcrumbInputDownloader solver={solver} />

      <div className="flex gap-2 items-center">
        <button
          onClick={handleStep}
          disabled={solver.solved || solver.failed || isAnimating}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-3 py-1 rounded"
        >
          Step
        </button>

        <button
          onClick={handleSolve}
          disabled={solver.solved || solver.failed || isAnimating}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-1 rounded"
        >
          Solve
        </button>

        <button
          onClick={handleAnimate}
          disabled={solver.solved || solver.failed}
          className={`px-3 py-1 rounded text-white ${
            isAnimating
              ? "bg-red-500 hover:bg-red-600"
              : "bg-yellow-500 hover:bg-yellow-600"
          } disabled:bg-gray-300`}
        >
          {isAnimating ? "Stop" : "Animate"}
        </button>

        <div className="ml-4 text-sm text-gray-600">
          Iterations: {solver.iterations}
        </div>

        {solver.solved && (
          <div className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            Solved
          </div>
        )}
      </div>

      {solver.failed && (
        <div className="text-red-500">Failed: {solver.error}</div>
      )}
    </div>
  )
}
