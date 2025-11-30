import type { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

type StageStatus = "Solved" | "Failed" | "Running" | "Not Started"

/**
 * Displays every stage of the pipeline with the status ("Solved", "Failed", "Running" or "Not Started"),
 * what iteration it started on, what iteration it ended on, and the time it took to solve.
 *
 * The table also has a column "Actions" that has a download icon to download the getConstructorParams()
 * of each stage.
 */
export const PipelineStageTable = ({
  pipelineSolver,
  triggerRender,
}: {
  pipelineSolver: SchematicTracePipelineSolver
  triggerRender: () => void
}) => {
  const getStageStatus = (stageIndex: number): StageStatus => {
    if (pipelineSolver.currentPipelineStepIndex > stageIndex) {
      return "Solved"
    }
    if (pipelineSolver.currentPipelineStepIndex === stageIndex) {
      if (pipelineSolver.failed) return "Failed"
      if (pipelineSolver.activeSubSolver) return "Running"
    }
    return "Not Started"
  }

  const downloadParams = (stageName: string) => {
    const stage = pipelineSolver.pipelineDef.find(
      (s) => s.solverName === stageName,
    )
    if (!stage) return

    try {
      const params = stage.getConstructorParams(pipelineSolver)
      const blob = new Blob([JSON.stringify(params, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${stageName}_params.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(
        `Error downloading params for ${stageName}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">
              Stage
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Status
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Start Iteration
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              End Iteration
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Time (ms)
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {pipelineSolver.pipelineDef.map((stage, index) => {
            const status = getStageStatus(index)
            const startIteration =
              pipelineSolver.firstIterationOfPhase[stage.solverName]
            const endIteration =
              status === "Solved"
                ? (pipelineSolver.firstIterationOfPhase[stage.solverName] ||
                    0) +
                  ((pipelineSolver as any)[stage.solverName]?.iterations || 0)
                : undefined
            const timeSpent = pipelineSolver.timeSpentOnPhase[stage.solverName]

            return (
              <tr key={stage.solverName} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                  {stage.solverName}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        status === "Solved"
                          ? "bg-green-100 text-green-800"
                          : status === "Failed"
                            ? "bg-red-100 text-red-800"
                            : status === "Running"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {status}
                    </span>
                    <button
                      onClick={() => {
                        pipelineSolver.solveUntilPhase(stage.solverName)
                        triggerRender()
                      }}
                      className="hover:bg-green-500 text-gray-600 hover:text-white px-2 py-1 rounded text-sm"
                      title={`Run until ${stage.solverName} is active`}
                    >
                      ▶️
                    </button>
                  </div>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {startIteration !== undefined ? startIteration : "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {endIteration !== undefined ? endIteration : "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {timeSpent !== undefined ? Math.round(timeSpent) : "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <button
                    onClick={() => downloadParams(stage.solverName)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm"
                    title="Download constructor params"
                  >
                    ⬇️
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
