import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

/**
 * 合并同一网络中挨得很近的线段，将它们对齐到相同的 X 或 Y 坐标
 *
 * 算法思路：
 * 1. 按网络 ID（same-net）分组所有 trace
 * 2. 对每条 trace，提取水平和垂直线段
 * 3. 检测挨得很近的线段（距离小于阈值）
 * 4. 将这些线段对齐到平均 X 或 Y 坐标
 * 5. 重新连接 trace 的路径点
 */

interface LineSegment {
  traceId: string
  segmentIndex: number
  p1: Point
  p2: Point
  isHorizontal: boolean
  isVertical: boolean
  fixedCoord: number // 水平线的 Y，垂直线的 X
  otherCoord1: number
  otherCoord2: number
}

interface MergeCloseSegmentsInput {
  traces: SolvedTracePath[]
  distanceThreshold?: number // 默认 0.5mm，接近就合并
}

export function mergeCloseSegments({
  traces,
  distanceThreshold = 0.5,
}: MergeCloseSegmentsInput): SolvedTracePath[] {
  const resultTraces = traces.map((t) => ({
    ...t,
    tracePath: [...t.tracePath],
  }))

  // 1. 按网络 ID 分组
  const tracesByNetId: Record<string, SolvedTracePath[]> = {}
  for (const trace of resultTraces) {
    const netId = trace.netId || trace.mspPairId.split("-")[0]
    if (!tracesByNetId[netId]) {
      tracesByNetId[netId] = []
    }
    tracesByNetId[netId].push(trace)
  }

  // 2. 对每个网络处理
  for (const netId of Object.keys(tracesByNetId)) {
    const netTraces = tracesByNetId[netId]
    if (netTraces.length < 2) continue

    processNetTraces(netTraces, distanceThreshold)
  }

  return resultTraces
}

function processNetTraces(
  netTraces: SolvedTracePath[],
  distanceThreshold: number,
): void {
  // 提取所有线段
  const segments: LineSegment[] = []

  for (const trace of netTraces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const p1 = trace.tracePath[i]
      const p2 = trace.tracePath[i + 1]
      const isHorizontal = Math.abs(p1.y - p2.y) < 0.001
      const isVertical = Math.abs(p1.x - p2.x) < 0.001

      if (isHorizontal || isVertical) {
        segments.push({
          traceId: trace.mspPairId,
          segmentIndex: i,
          p1,
          p2,
          isHorizontal,
          isVertical,
          fixedCoord: isHorizontal ? p1.y : p1.x,
          otherCoord1: isHorizontal ? p1.x : p1.y,
          otherCoord2: isHorizontal ? p2.x : p2.y,
        })
      }
    }
  }

  // 分组水平线
  const horizontalSegments = segments.filter((s) => s.isHorizontal)
  alignSegments(horizontalSegments, distanceThreshold, true)

  // 分组垂直线
  const verticalSegments = segments.filter((s) => s.isVertical)
  alignSegments(verticalSegments, distanceThreshold, false)
}

function alignSegments(
  segments: LineSegment[],
  threshold: number,
  isHorizontal: boolean,
): void {
  if (segments.length < 2) return

  // 按固定坐标排序
  const sorted = [...segments].sort(
    (a, b) => a.fixedCoord - b.fixedCoord,
  )

  // 找接近的组
  const groups: LineSegment[][] = []
  let currentGroup: LineSegment[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(
      sorted[i].fixedCoord - currentGroup[currentGroup.length - 1].fixedCoord,
    )
    if (diff <= threshold) {
      currentGroup.push(sorted[i])
    } else {
      if (currentGroup.length >= 2) {
        groups.push(currentGroup)
      }
      currentGroup = [sorted[i]]
    }
  }
  if (currentGroup.length >= 2) {
    groups.push(currentGroup)
  }

  // 对齐每个组到平均坐标
  for (const group of groups) {
    const avgCoord =
      group.reduce((sum, s) => sum + s.fixedCoord, 0) / group.length

    for (const seg of group) {
      const trace = seg.traceId
        ? seg.traceId
        : group[0].traceId
      if (isHorizontal) {
        seg.p1.y = avgCoord
        seg.p2.y = avgCoord
      } else {
        seg.p1.x = avgCoord
        seg.p2.x = avgCoord
      }
    }
  }
}

/**
 * 只处理单个 trace 的版本（用于 pipeline 阶段）
 */
export function mergeCloseSegmentsForSingleTrace({
  targetMspConnectionPairId,
  traces,
}: {
  targetMspConnectionPairId: string
  traces: SolvedTracePath[]
}): SolvedTracePath {
  const targetTrace = traces.find(
    (t) => t.mspPairId === targetMspConnectionPairId,
  )!
  const otherTraces = traces.filter(
    (t) => t.mspPairId !== targetMspConnectionPairId,
  )

  // 找到同网络的其他 trace
  const targetNetId = targetTrace.netId || targetTrace.mspPairId.split("-")[0]
  const sameNetTraces = otherTraces.filter(
    (t) => (t.netId || t.mspPairId.split("-")[0]) === targetNetId,
  )

  if (sameNetTraces.length === 0) {
    return { ...targetTrace, tracePath: [...targetTrace.tracePath] }
  }

  // 合并处理
  const allNetTraces = [targetTrace, ...sameNetTraces]
  const merged = mergeCloseSegments({
    traces: allNetTraces,
    distanceThreshold: 0.5,
  })

  // 返回更新后的目标 trace
  return merged.find((t) => t.mspPairId === targetMspConnectionPairId)!
}
