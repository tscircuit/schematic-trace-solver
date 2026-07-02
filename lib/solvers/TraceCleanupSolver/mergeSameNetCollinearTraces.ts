import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const isHorizontalPath = (path: Point[]) =>
  path.length >= 2 && path.every((p) => Math.abs(p.y - path[0]!.y) < EPS)

const isVerticalPath = (path: Point[]) =>
  path.length >= 2 && path.every((p) => Math.abs(p.x - path[0]!.x) < EPS)

const canMergePair = (a: SolvedTracePath, b: SolvedTracePath) => {
  if (a.globalConnNetId !== b.globalConnNetId) return false

  const aIsHorizontal = isHorizontalPath(a.tracePath)
  const bIsHorizontal = isHorizontalPath(b.tracePath)
  if (aIsHorizontal && bIsHorizontal) {
    return Math.abs(a.tracePath[0]!.y - b.tracePath[0]!.y) < EPS
  }

  const aIsVertical = isVerticalPath(a.tracePath)
  const bIsVertical = isVerticalPath(b.tracePath)
  if (aIsVertical && bIsVertical) {
    return Math.abs(a.tracePath[0]!.x - b.tracePath[0]!.x) < EPS
  }

  return false
}

const mergePair = (
  a: SolvedTracePath,
  b: SolvedTracePath,
): SolvedTracePath | null => {
  const aStart = a.tracePath[0]!
  const aEnd = a.tracePath[a.tracePath.length - 1]!
  const bStart = b.tracePath[0]!
  const bEnd = b.tracePath[b.tracePath.length - 1]!

  let tracePath: Point[] | null = null
  if (pointsEqual(aEnd, bStart))
    tracePath = [...a.tracePath, ...b.tracePath.slice(1)]
  else if (pointsEqual(bEnd, aStart))
    tracePath = [...b.tracePath, ...a.tracePath.slice(1)]
  else if (pointsEqual(aStart, bStart))
    tracePath = [...a.tracePath.slice().reverse(), ...b.tracePath.slice(1)]
  else if (pointsEqual(aEnd, bEnd))
    tracePath = [...a.tracePath, ...b.tracePath.slice(0, -1).reverse()]

  if (!tracePath) return null

  return {
    ...a,
    mspPairId: `${a.mspPairId}+${b.mspPairId}`,
    mspConnectionPairIds: Array.from(
      new Set([
        ...(a.mspConnectionPairIds ?? [a.mspPairId]),
        ...(b.mspConnectionPairIds ?? [b.mspPairId]),
      ]),
    ),
    pinIds: Array.from(new Set([...(a.pinIds ?? []), ...(b.pinIds ?? [])])),
    pins: [a.pins[0], b.pins[1]],
    tracePath: simplifyPath(tracePath),
  }
}

export const mergeSameNetCollinearTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const remaining = [...traces]
  let changed = true

  while (changed) {
    changed = false
    outer: for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const a = remaining[i]!
        const b = remaining[j]!
        if (!canMergePair(a, b)) continue

        const merged = mergePair(a, b)
        if (!merged) continue

        remaining.splice(j, 1)
        remaining.splice(i, 1, merged)
        changed = true
        break outer
      }
    }
  }

  return remaining
}
