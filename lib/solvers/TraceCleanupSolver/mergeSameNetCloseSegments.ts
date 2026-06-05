import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  rangeMin: number
  rangeMax: number
  length: number
}

const EPS = 1e-6

const rangesAreClose = (
  a: Pick<SegmentRef, "rangeMin" | "rangeMax">,
  b: Pick<SegmentRef, "rangeMin" | "rangeMax">,
  tolerance: number,
) =>
  Math.max(a.rangeMin, b.rangeMin) - Math.min(a.rangeMax, b.rangeMax) <=
  tolerance

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((p) => ({ ...p })),
})

const collectMergeableSegments = (
  traces: SolvedTracePath[],
  tolerance: number,
): SegmentRef[] => {
  const refs: SegmentRef[] = []

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const points = trace.tracePath

    for (
      let segmentIndex = 0;
      segmentIndex < points.length - 1;
      segmentIndex++
    ) {
      if (segmentIndex === 0 || segmentIndex === points.length - 2) continue

      const start = points[segmentIndex]!
      const end = points[segmentIndex + 1]!
      const isHorizontal = Math.abs(start.y - end.y) < EPS
      const isVertical = Math.abs(start.x - end.x) < EPS
      if (!isHorizontal && !isVertical) continue

      const orientation: Orientation = isHorizontal ? "horizontal" : "vertical"
      const fixedCoord = isHorizontal ? start.y : start.x
      const rangeStart = isHorizontal ? start.x : start.y
      const rangeEnd = isHorizontal ? end.x : end.y
      const rangeMin = Math.min(rangeStart, rangeEnd)
      const rangeMax = Math.max(rangeStart, rangeEnd)
      const length = rangeMax - rangeMin

      if (length <= tolerance) continue

      refs.push({
        traceIndex,
        segmentIndex,
        orientation,
        fixedCoord,
        rangeMin,
        rangeMax,
        length,
      })
    }
  }

  return refs
}

const findSameNetSegmentClusters = (
  traces: SolvedTracePath[],
  tolerance: number,
) => {
  const byNetAndOrientation = new Map<string, SegmentRef[]>()

  for (const ref of collectMergeableSegments(traces, tolerance)) {
    const trace = traces[ref.traceIndex]!
    const key = `${getTraceNetId(trace)}:${ref.orientation}`
    const refs = byNetAndOrientation.get(key) ?? []
    refs.push(ref)
    byNetAndOrientation.set(key, refs)
  }

  const clusters: SegmentRef[][] = []

  for (const refs of byNetAndOrientation.values()) {
    const sorted = [...refs].sort((a, b) => a.fixedCoord - b.fixedCoord)
    const visited = new Set<number>()

    for (let i = 0; i < sorted.length; i++) {
      if (visited.has(i)) continue

      const cluster: SegmentRef[] = [sorted[i]!]
      visited.add(i)

      for (let j = i + 1; j < sorted.length; j++) {
        if (visited.has(j)) continue

        const candidate = sorted[j]!
        const touchesCluster = cluster.some(
          (existing) =>
            Math.abs(existing.fixedCoord - candidate.fixedCoord) <= tolerance &&
            rangesAreClose(existing, candidate, tolerance),
        )

        if (touchesCluster) {
          cluster.push(candidate)
          visited.add(j)
        }
      }

      if (cluster.length > 1) clusters.push(cluster)
    }
  }

  return clusters
}

export const mergeSameNetCloseSegments = (
  inputTraces: SolvedTracePath[],
  options: {
    tolerance?: number
    canAcceptTraces?: (
      candidateTraces: SolvedTracePath[],
      changedTraceIndexes: Set<number>,
    ) => boolean
  } = {},
): SolvedTracePath[] => {
  const tolerance = options.tolerance ?? 0.12
  const outputTraces = inputTraces.map(cloneTrace)
  const clusters = findSameNetSegmentClusters(outputTraces, tolerance)
  const changedTraceIndexes = new Set<number>()

  for (const cluster of clusters) {
    const target = cluster.reduce((best, next) =>
      next.length > best.length ? next : best,
    ).fixedCoord

    const clusterChangedTraceIndexes = new Set<number>()
    const originalTracePaths = new Map<number, SolvedTracePath["tracePath"]>()

    for (const ref of cluster) {
      if (Math.abs(ref.fixedCoord - target) < EPS) continue

      const trace = outputTraces[ref.traceIndex]!
      if (!originalTracePaths.has(ref.traceIndex)) {
        originalTracePaths.set(
          ref.traceIndex,
          trace.tracePath.map((point) => ({ ...point })),
        )
      }

      const start = trace.tracePath[ref.segmentIndex]!
      const end = trace.tracePath[ref.segmentIndex + 1]!

      if (ref.orientation === "horizontal") {
        start.y = target
        end.y = target
      } else {
        start.x = target
        end.x = target
      }

      clusterChangedTraceIndexes.add(ref.traceIndex)
    }

    for (const traceIndex of clusterChangedTraceIndexes) {
      const trace = outputTraces[traceIndex]!
      trace.tracePath = simplifyPath(trace.tracePath)
    }

    if (
      options.canAcceptTraces &&
      !options.canAcceptTraces(outputTraces, clusterChangedTraceIndexes)
    ) {
      for (const [traceIndex, tracePath] of originalTracePaths) {
        outputTraces[traceIndex]!.tracePath = tracePath
      }
      continue
    }

    for (const traceIndex of clusterChangedTraceIndexes) {
      changedTraceIndexes.add(traceIndex)
    }
  }

  for (const traceIndex of changedTraceIndexes) {
    const trace = outputTraces[traceIndex]!
    trace.tracePath = simplifyPath(trace.tracePath)
  }

  return outputTraces
}
