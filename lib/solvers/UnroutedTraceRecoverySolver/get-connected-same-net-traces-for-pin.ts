import { doSegmentsIntersect } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { PinId } from "lib/types/InputProblem"

export const getConnectedSameNetTracesForPin = ({
  pinId,
  sameNetTraces,
}: {
  pinId: PinId
  sameNetTraces: readonly SolvedTracePath[]
}): SolvedTracePath[] => {
  const connectedTraceIndexes = new Set(
    sameNetTraces.flatMap((trace, index) =>
      trace.pinIds.includes(pinId) ? [index] : [],
    ),
  )

  let previousSize = -1
  while (connectedTraceIndexes.size !== previousSize) {
    previousSize = connectedTraceIndexes.size
    for (let traceIndex = 0; traceIndex < sameNetTraces.length; traceIndex++) {
      if (connectedTraceIndexes.has(traceIndex)) continue
      const trace = sameNetTraces[traceIndex]
      if (!trace) continue
      const connectsToComponent = [...connectedTraceIndexes].some(
        (connectedTraceIndex) => {
          const connectedTrace = sameNetTraces[connectedTraceIndex]
          if (!connectedTrace) return false
          if (
            trace.pinIds.some((candidatePinId) =>
              connectedTrace.pinIds.includes(candidatePinId),
            )
          ) {
            return true
          }
          for (
            let firstIndex = 0;
            firstIndex < trace.tracePath.length - 1;
            firstIndex++
          ) {
            const firstStart = trace.tracePath[firstIndex]
            const firstEnd = trace.tracePath[firstIndex + 1]
            if (!firstStart || !firstEnd) continue
            for (
              let secondIndex = 0;
              secondIndex < connectedTrace.tracePath.length - 1;
              secondIndex++
            ) {
              const secondStart = connectedTrace.tracePath[secondIndex]
              const secondEnd = connectedTrace.tracePath[secondIndex + 1]
              if (
                secondStart &&
                secondEnd &&
                doSegmentsIntersect(
                  firstStart,
                  firstEnd,
                  secondStart,
                  secondEnd,
                )
              ) {
                return true
              }
            }
          }
          return false
        },
      )
      if (connectsToComponent) connectedTraceIndexes.add(traceIndex)
    }
  }

  return [...connectedTraceIndexes].flatMap((traceIndex) => {
    const trace = sameNetTraces[traceIndex]
    return trace ? [trace] : []
  })
}
