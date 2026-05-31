import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

const MERGE_THRESHOLD = 0.5

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function areColinear(a: Point, b: Point, c: Point): boolean {
  const eps = 1e-6
  return (
    (Math.abs(a.x - b.x) < eps && Math.abs(b.x - c.x) < eps) ||
    (Math.abs(a.y - b.y) < eps && Math.abs(b.y - c.y) < eps)
  )
}

function collapseColinearPoints(points: Point[]): Point[] {
  if (points.length <= 2) return [...points]
  const result: Point[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    if (!areColinear(result[result.length - 1]!, points[i]!, points[i + 1]!)) {
      result.push(points[i]!)
    }
  }
  result.push(points[points.length - 1]!)
  return result
}

interface EndpointInfo {
  trace: SolvedTracePath
  traceIndex: number
  isStart: boolean
  point: Point
}

interface EndpointPair {
  a: EndpointInfo
  b: EndpointInfo
  distance: number
}

function getPathEndpoints(path: Point[]): { start: Point; end: Point } {
  return {
    start: path[0]!,
    end: path[path.length - 1]!,
  }
}

function reversePath(path: Point[]): Point[] {
  return [...path].reverse()
}

function connectPaths(
  pathA: Point[],
  pathB: Point[],
  aEnd: "start" | "end",
  bEnd: "start" | "end",
): Point[] {
  let adjustedA = pathA
  let adjustedB = pathB

  if (aEnd === "end" && bEnd === "start") {
    return [...adjustedA, ...adjustedB.slice(1)]
  }
  if (aEnd === "start" && bEnd === "start") {
    adjustedA = reversePath(adjustedA)
    return [...adjustedA, ...adjustedB.slice(1)]
  }
  if (aEnd === "end" && bEnd === "end") {
    adjustedB = reversePath(adjustedB)
    return [...adjustedA, ...adjustedB.slice(1)]
  }
  adjustedA = reversePath(adjustedA)
  adjustedB = reversePath(adjustedB)
  return [...adjustedA, ...adjustedB.slice(1)]
}

export class TraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  mergedTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.mergedTraces = [...params.inputTraces]
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceSegmentMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
    }
  }

  override _step() {
    this.mergedTraces = this.mergeTraces()
    this.solved = true
  }

  private mergeTraces(): SolvedTracePath[] {
    const netGroups = new Map<string, SolvedTracePath[]>()
    for (const trace of this.inputTraces) {
      const netId = trace.globalConnNetId
      if (!netGroups.has(netId)) {
        netGroups.set(netId, [])
      }
      netGroups.get(netId)!.push(trace)
    }

    const result: SolvedTracePath[] = []

    for (const [, traces] of netGroups) {
      if (traces.length <= 1) {
        result.push(...traces)
        continue
      }

      const endpoints: EndpointInfo[] = []
      for (let i = 0; i < traces.length; i++) {
        const trace = traces[i]!
        const { start, end } = getPathEndpoints(trace.tracePath)
        endpoints.push({ trace, traceIndex: i, isStart: true, point: start })
        endpoints.push({ trace, traceIndex: i, isStart: false, point: end })
      }

      const gridCellSize = MERGE_THRESHOLD
      const grid = new Map<string, EndpointInfo[]>()

      for (const ep of endpoints) {
        const cx = Math.floor(ep.point.x / gridCellSize)
        const cy = Math.floor(ep.point.y / gridCellSize)
        const key = `${cx},${cy}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key)!.push(ep)
      }

      const pairs: EndpointPair[] = []
      const seenPairKeys = new Set<string>()

      for (const ep of endpoints) {
        const cx = Math.floor(ep.point.x / gridCellSize)
        const cy = Math.floor(ep.point.y / gridCellSize)

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const key = `${cx + dx},${cy + dy}`
            const cellEps = grid.get(key)
            if (!cellEps) continue

            for (const other of cellEps) {
              if (other.traceIndex === ep.traceIndex) continue

              const pairKey =
                ep.traceIndex < other.traceIndex
                  ? `${ep.traceIndex},${other.traceIndex},${ep.isStart},${other.isStart}`
                  : `${other.traceIndex},${ep.traceIndex},${other.isStart},${ep.isStart}`

              const d = dist(ep.point, other.point)
              if (d <= MERGE_THRESHOLD) {
                const traceKey =
                  ep.traceIndex < other.traceIndex
                    ? `${ep.traceIndex},${other.traceIndex}`
                    : `${other.traceIndex},${ep.traceIndex}`

                if (!seenPairKeys.has(traceKey)) {
                  seenPairKeys.add(traceKey)
                  pairs.push({ a: ep, b: other, distance: d })
                }
              }
            }
          }
        }
      }

      if (pairs.length === 0) {
        result.push(...traces)
        continue
      }

      pairs.sort((a, b) => a.distance - b.distance)

      const n = traces.length
      const parent = Array.from({ length: n }, (_, i) => i)
      const find = (x: number): number => {
        while (parent[x] !== x) {
          parent[x] = parent[parent[x]!]!
          x = parent[x]!
        }
        return x
      }
      const union = (a: number, b: number) => {
        const ra = find(a)
        const rb = find(b)
        if (ra !== rb) parent[rb] = ra
      }

      interface MergeEdge {
        a: number
        b: number
        aIsStart: boolean
        bIsStart: boolean
      }
      const mergeEdges: MergeEdge[] = []

      for (const pair of pairs) {
        const rootA = find(pair.a.traceIndex)
        const rootB = find(pair.b.traceIndex)
        if (rootA === rootB) continue

        mergeEdges.push({
          a: pair.a.traceIndex,
          b: pair.b.traceIndex,
          aIsStart: pair.a.isStart,
          bIsStart: pair.b.isStart,
        })
        union(rootA, rootB)
      }

      const components = new Map<number, number[]>()
      for (let i = 0; i < n; i++) {
        const root = find(i)
        if (!components.has(root)) components.set(root, [])
        components.get(root)!.push(i)
      }

      for (const [, indices] of components) {
        if (indices.length === 1) {
          result.push(traces[indices[0]!]!)
          continue
        }

        const compEdges = mergeEdges.filter(
          (e) => find(e.a) === find(indices[0]!),
        )

        const adj = new Map<
          number,
          Array<{ to: number; aIsStart: boolean; bIsStart: boolean }>
        >()
        for (const idx of indices) adj.set(idx, [])

        for (const edge of compEdges) {
          adj
            .get(edge.a)!
            .push({
              to: edge.b,
              aIsStart: edge.aIsStart,
              bIsStart: edge.bIsStart,
            })
          adj
            .get(edge.b)!
            .push({
              to: edge.a,
              aIsStart: edge.bIsStart,
              bIsStart: edge.aIsStart,
            })
        }

        const visited = new Set<number>()
        const allPaths: Point[] = []

        function dfs(idx: number, pathSoFar: Point[] | null): Point[] {
          visited.add(idx)
          const trace = traces[idx]!
          const curPath = trace.tracePath

          if (pathSoFar === null) {
            pathSoFar = [...curPath]
          }

          for (const neighbor of adj.get(idx)!) {
            if (visited.has(neighbor.to)) continue

            const neighborPath = traces[neighbor.to]!.tracePath
            let aIsStart = neighbor.aIsStart
            let bIsStart = neighbor.bIsStart

            if (neighbor.to < idx) {
              ;[aIsStart, bIsStart] = [bIsStart, aIsStart]
            }

            const aEnd = aIsStart ? "start" : "end"
            const bEnd = bIsStart ? "start" : "end"

            const connected = connectPaths(pathSoFar, neighborPath, aEnd, bEnd)
            const childResult = dfs(neighbor.to, connected)

            if (childResult.length > pathSoFar.length) {
              pathSoFar = childResult
            }
          }

          return pathSoFar
        }

        let longestPath: Point[] = []
        for (const idx of indices) {
          if (visited.has(idx)) continue
          const path = dfs(idx, null)
          if (path.length > longestPath.length) {
            longestPath = path
          }
        }

        const collapsed = collapseColinearPoints(longestPath)

        const firstTrace = traces[indices[0]!]!
        result.push({
          ...firstTrace,
          tracePath: collapsed,
          mspPairId: firstTrace.mspPairId,
          mspConnectionPairIds: indices.flatMap(
            (i) => traces[i]!.mspConnectionPairIds,
          ),
          pinIds: [...new Set(indices.flatMap((i) => traces[i]!.pinIds))],
        })
      }
    }

    return result
  }

  override visualize() {
    const graphics: any = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    for (const trace of this.mergedTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "green",
        strokeWidth: 0.03,
      })
    }

    return graphics
  }

  getOutput(): { mergedTraces: SolvedTracePath[] } {
    return { mergedTraces: this.mergedTraces }
  }
}
