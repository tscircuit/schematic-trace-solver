import { type GraphicsObject, stackGraphicsHorizontally } from "graphics-debug"
import { InteractiveGraphics } from "graphics-debug/react"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignSameNetTraceSegments"
import { useMemo } from "react"
import inputData from "../../tests/assets/align-same-net-trace-segments.input.json"

const traces = inputData.allTraces as unknown as SolvedTracePath[]

const visualizeTraces = (
  tracesToVisualize: SolvedTracePath[],
): GraphicsObject => ({
  lines: tracesToVisualize.map((trace) => ({
    points: trace.tracePath,
    strokeColor: "blue",
  })),
})

export default () => {
  const graphics = useMemo(() => {
    const alignedTraces = alignSameNetTraceSegments({
      traces,
      inputProblem: inputData.inputProblem,
      allLabelPlacements: [],
      mergedLabelNetIdMap: {},
      paddingBuffer: 0,
    })

    return stackGraphicsHorizontally(
      [visualizeTraces(traces), visualizeTraces(alignedTraces)],
      {
        titles: ["Before: close parallel traces", "After: shared X/Y axes"],
      },
    )
  }, [])

  return <InteractiveGraphics graphics={graphics} />
}
