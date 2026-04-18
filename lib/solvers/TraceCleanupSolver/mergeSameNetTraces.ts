import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

interface Segment {
  traceIndex: number
  segIndex: number
  p1: Point
  p2: Point
  orientation: "horizontal" | "vertical"
  coord: number
  minSpan: number
  maxSpan: number
}

function getSegments(traces: SolvedTracePath[]): Segment[] {
  const segments: Segment[] = []
  for (let ti = 0; ti < traces.length; ti++) {
    const path = traces[ti].tracePath
    for (let si = 0; si < path.length - 1; si++) {
      const p1 = path[si]
      const p2 = path[si + 1]
      const dx = Math.abs(p1.x - p2.x)
      const dy = Math.abs(p1.y - p2.y)
      if (dx < 1e-9 && dy < 1e-9) continue
      if (dy < 1e-9) {
        segments.push({
          traceIndex: ti,
          segIndex: si,
          p1,
          p2,
          orientation: "horizontal",
          coord: p1.y,
          minSpan: Math.min(p1.x, p2.x),
          maxSpan: Math.max(p1.x, p2.x),
        })
      } else if (dx < 1e-9) {
        segments.push({
          traceIndex: ti,
          segIndex: si,
          p1,
          p2,
          orientation: "vertical",
          coord: p1.x,
          minSpan: Math.min(p1.y, p2.y),
          maxSpan: Math.max(p1.y, p2.y),
        })
      }
    }
  }
  return segments
}

function spansOverlap(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
): boolean {
  return maxA > minB && maxB > minA
}

interface MergeGroup {
  segmentIndices: number[]
  targetCoord: number
  orientation: "horizontal" | "vertical"
}

export function mergeSameNetTraces(
  allTraces: SolvedTracePath[],
  distanceThreshold: number = 0.15,
): SolvedTracePath[] {
  const tracesByNet = new Map<string, number[]>()
  for (let i = 0; i < allTraces.length; i++) {
    const netId = allTraces[i].connectionNetId ?? allTraces[i].mspPairId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(i)
  }

  const updatedPaths: Point[][] = allTraces.map((t) => [...t.tracePath])

  for (const [_netId, traceIndices] of tracesByNet) {
    if (traceIndices.length < 2) continue

    const netTraces = traceIndices.map((i) => ({
      ...allTraces[i],
      tracePath: updatedPaths[i],
    }))

    const segments = getSegments(
      netTraces.map((t, localIdx) => ({
        ...t,
        _localIdx: localIdx,
      })) as any,
    )

    const allSegs: (Segment & { globalTraceIndex: number })[] = []
    for (let ti = 0; ti < netTraces.length; ti++) {
      const path = updatedPaths[traceIndices[ti]]
      for (let si = 0; si < path.length - 1; si++) {
        const p1 = path[si]
        const p2 = path[si + 1]
        const dx = Math.abs(p1.x - p2.x)
        const dy = Math.abs(p1.y - p2.y)
        if (dx < 1e-9 && dy < 1e-9) continue
        if (dy < 1e-9) {
          allSegs.push({
            traceIndex: ti,
            globalTraceIndex: traceIndices[ti],
            segIndex: si,
            p1,
            p2,
            orientation: "horizontal",
            coord: p1.y,
            minSpan: Math.min(p1.x, p2.x),
            maxSpan: Math.max(p1.x, p2.x),
          })
        } else if (dx < 1e-9) {
          allSegs.push({
            traceIndex: ti,
            globalTraceIndex: traceIndices[ti],
            segIndex: si,
            p1,
            p2,
            orientation: "vertical",
            coord: p1.x,
            minSpan: Math.min(p1.y, p2.y),
            maxSpan: Math.max(p1.y, p2.y),
          })
        }
      }
    }

    const mergeGroups: MergeGroup[] = []
    const merged = new Set<number>()

    for (let i = 0; i < allSegs.length; i++) {
      if (merged.has(i)) continue
      const si = allSegs[i]
      const group: number[] = [i]

      for (let j = i + 1; j < allSegs.length; j++) {
        if (merged.has(j)) continue
        const sj = allSegs[j]

        if (si.orientation !== sj.orientation) continue
        if (si.globalTraceIndex === sj.globalTraceIndex) continue

        const coordDist = Math.abs(si.coord - sj.coord)
        if (coordDist > distanceThreshold) continue
        if (coordDist < 1e-9) continue

        if (!spansOverlap(si.minSpan, si.maxSpan, sj.minSpan, sj.maxSpan))
          continue

        group.push(j)
      }

      if (group.length > 1) {
        let sumCoord = 0
        for (const idx of group) {
          sumCoord += allSegs[idx].coord
        }
        const targetCoord = sumCoord / group.length

        mergeGroups.push({
          segmentIndices: group,
          targetCoord,
          orientation: si.orientation,
        })

        for (const idx of group) {
          merged.add(idx)
        }
      }
    }

    for (const mg of mergeGroups) {
      for (const segIdx of mg.segmentIndices) {
        const seg = allSegs[segIdx]
        const globalIdx = seg.globalTraceIndex
        const path = updatedPaths[globalIdx]
        const si = seg.segIndex

        if (si >= path.length - 1) continue

        if (mg.orientation === "horizontal") {
          path[si] = { x: path[si].x, y: mg.targetCoord }
          path[si + 1] = { x: path[si + 1].x, y: mg.targetCoord }
        } else {
          path[si] = { x: mg.targetCoord, y: path[si].y }
          path[si + 1] = { x: mg.targetCoord, y: path[si + 1].y }
        }
      }
    }
  }

  const result: SolvedTracePath[] = allTraces.map((trace, i) => ({
    ...trace,
    tracePath: simplifyPath(updatedPaths[i]),
  }))

  return result
}