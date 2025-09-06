import type { Point } from "@tscircuit/math-utils"
import { isHorizontal, isVertical } from "./collisions"

const EPS = 1e-9

export type Axis = "x" | "y"

export const shiftSegmentOrth = (
  pts: Point[],
  segIndex: number,
  axis: Axis,
  newCoord: number,
  eps = EPS,
): Point[] | null => {
  if (segIndex < 0 || segIndex >= pts.length - 1) return null
  const a = pts[segIndex]!
  const b = pts[segIndex + 1]!
  const vert = isVertical(a, b, eps)
  const horz = isHorizontal(a, b, eps)
  if (!vert && !horz) return null

  // Ensure axis matches orthogonal shift
  if (vert && axis !== "x") return null
  if (horz && axis !== "y") return null

  const out = pts.map((p) => ({ ...p }))

  if (axis === "x") {
    if (Math.abs(a.x - newCoord) < eps && Math.abs(b.x - newCoord) < eps)
      return null
    out[segIndex] = { ...out[segIndex], x: newCoord }
    out[segIndex + 1] = { ...out[segIndex + 1], x: newCoord }
  } else {
    if (Math.abs(a.y - newCoord) < eps && Math.abs(b.y - newCoord) < eps)
      return null
    out[segIndex] = { ...out[segIndex], y: newCoord }
    out[segIndex + 1] = { ...out[segIndex + 1], y: newCoord }
  }

  // Prevent collapsing adjacent segments
  if (segIndex - 1 >= 0) {
    const p = out[segIndex - 1]!
    const q = out[segIndex]!
    const manhattan = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
    if (manhattan < eps) return null
  }
  if (segIndex + 2 <= out.length - 1) {
    const p = out[segIndex + 1]!
    const q = out[segIndex + 2]!
    const manhattan = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
    if (manhattan < eps) return null
  }

  // Sanity: still orthogonal
  for (let i = 0; i < out.length - 1; i++) {
    const u = out[i]!
    const v = out[i + 1]!
    if (!isHorizontal(u, v, eps) && !isVertical(u, v, eps)) return null
  }

  return out
}

export const pathKey = (pts: Point[], decimals = 6) =>
  pts.map((p) => `${p.x.toFixed(decimals)},${p.y.toFixed(decimals)}`).join("|")
