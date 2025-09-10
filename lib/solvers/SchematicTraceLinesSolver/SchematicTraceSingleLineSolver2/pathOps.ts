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
  if (segIndex < 0 || segIndex >= pts.length - 1) {
    console.error(`  -> FAILED: segIndex ${segIndex} is out of bounds.`)
    return null
  }
  const a = pts[segIndex]!
  const b = pts[segIndex + 1]!
  const vert = isVertical(a, b, eps)
  const horz = isHorizontal(a, b, eps)
  if (!vert && !horz) {
    console.error(`  -> FAILED: Segment ${segIndex} is not orthogonal.`)
    return null
  }

  // Ensure axis matches orthogonal shift
  if (vert && axis !== "x") {
    console.error(
      `  -> FAILED: Cannot shift a vertical segment along the y-axis.`,
    )
    return null
  }
  if (horz && axis !== "y") {
    console.error(
      `  -> FAILED: Cannot shift a horizontal segment along the x-axis.`,
    )
    return null
  }

  const out = pts.map((p) => ({ ...p }))

  if (axis === "x") {
    if (Math.abs(a.x - newCoord) < eps && Math.abs(b.x - newCoord) < eps) {
      console.warn(
        `  -> FAILED: New x-coordinate ${newCoord} is the same as the old one.`,
      )
      return null
    }
    out[segIndex] = { ...out[segIndex], x: newCoord }
    out[segIndex + 1] = { ...out[segIndex + 1], x: newCoord }
  } else {
    if (Math.abs(a.y - newCoord) < eps && Math.abs(b.y - newCoord) < eps) {
      console.warn(
        `  -> FAILED: New y-coordinate ${newCoord} is the same as the old one.`,
      )
      return null
    }
    out[segIndex] = { ...out[segIndex], y: newCoord }
    out[segIndex + 1] = { ...out[segIndex + 1], y: newCoord }
  }

  // Prevent collapsing adjacent segments
  if (segIndex - 1 >= 0) {
    const p = out[segIndex - 1]!
    const q = out[segIndex]!
    const manhattan = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
    if (manhattan < eps) {
      console.warn(
        `  -> FAILED: Shift would collapse the preceding segment (index ${segIndex - 1}).`,
      )
      return null
    }
  }
  if (segIndex + 2 <= out.length - 1) {
    const p = out[segIndex + 1]!
    const q = out[segIndex + 2]!
    const manhattan = Math.abs(p.x - q.x) + Math.abs(p.y - q.y)
    if (manhattan < eps) {
      console.warn(
        `  -> FAILED: Shift would collapse the following segment (index ${segIndex + 1}).`,
      )
      return null
    }
  }

  // Sanity: still orthogonal
  for (let i = 0; i < out.length - 1; i++) {
    const u = out[i]!
    const v = out[i + 1]!
    if (!isHorizontal(u, v, eps) && !isVertical(u, v, eps)) {
      return null
    }
  }
  return out
}

export const pathKey = (pts: Point[], decimals = 6) => {
  const key = pts
    .map((p) => `${p.x.toFixed(decimals)},${p.y.toFixed(decimals)}`)
    .join("|")
  return key
}
