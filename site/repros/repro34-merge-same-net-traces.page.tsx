import { stackGraphicsHorizontally } from "graphics-debug"
import { InteractiveGraphics } from "graphics-debug/react"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { useMemo } from "react"
import inputProblem from "../../tests/assets/example02.json"

const renderTraces = (
  traces: Array<{ tracePath: Array<{ x: number; y: number }> }>,
  strokeColor: string,
) => ({
  lines: traces.map((trace) => ({
    points: trace.tracePath,
    strokeColor,
    strokeWidth: 0.02,
  })),
})

export default () => {
  const graphics = useMemo(() => {
    const solver = new SchematicTracePipelineSolver(inputProblem as any)
    solver.solveUntilPhase("traceCleanupSolver")

    const cleanup = solver.traceCleanupSolver!
    let beforeTraces = cleanup.getOutput().traces

    while (!cleanup.solved) {
      beforeTraces = structuredClone(cleanup.getOutput().traces)
      cleanup.step()
    }

    const afterTraces = cleanup.getOutput().traces

    return stackGraphicsHorizontally(
      [renderTraces(beforeTraces, "red"), renderTraces(afterTraces, "green")],
      {
        titles: ["Before merge (#34)", "After merge (#34)"],
      },
    )
  }, [])

  return <InteractiveGraphics graphics={graphics} />
}
