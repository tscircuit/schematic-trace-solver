export interface ElbowPoint {
  x: number
  y: number
  facingDirection?: "x+" | "x-" | "y+" | "y-"
}

/**
 * The first point is always passed in *normalised* form where it can only face
 * the positive X-axis, positive Y-axis or have no facing at all.  We capture
 * that restriction in a dedicated type so the compiler can keep us honest.
 */
export type NormalisedStartPoint = Omit<ElbowPoint, "facingDirection"> & {
  facingDirection?: "x+"
}

declare global {
  var __DEBUG_CALCULATE_ELBOW_CASE: number
}

/**
 * IMPORTANT:
 * `calculateElbow` always calls this helper with a normalised coordinate system
 * where
 *   • `p1.x` ≤ `p2.x` (and when `x` is equal then `p1.y` ≤ `p2.y`)
 *   • `p1.facingDirection` ∈ {"x+", "y+"} or is `undefined` (`none`)
 *
 * This means any branch that depends on `p1` facing `"x-"` or `"y-"` or on
 * `p1.x > p2.x` can never be taken at runtime.  The new
 * `NormalisedStartPoint` type encodes this guarantee so TypeScript will flag
 * any call-site that violates it.
 */
export const calculateElbowBends = (
  p1: NormalisedStartPoint,
  p2: ElbowPoint,
  overshootAmount: number,
): Array<{ x: number; y: number }> => {
  const result: Array<{ x: number; y: number }> = [{ x: p1.x, y: p1.y }]

  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2

  const p2Target = { x: p2.x, y: p2.y }
  switch (p2.facingDirection) {
    case "x+":
      p2Target.x += overshootAmount
      break
    case "x-":
      p2Target.x -= overshootAmount
      break
    case "y+":
      p2Target.y += overshootAmount
      break
    case "y-":
      p2Target.y -= overshootAmount
      break
  }

  const startDir = p1.facingDirection ?? "none"
  const endDir = p2.facingDirection ?? "none"

  const push = (pt: { x: number; y: number }) => {
    const last = result[result.length - 1]!
    if (last.x !== pt.x || last.y !== pt.y) result.push(pt)
  }

  // Treat very small y differences as equal to produce stable paths
  const yAligned =
    Math.abs(p1.y - p2.y) <= Math.max(1e-6, overshootAmount * 0.1)
  const xAligned =
    Math.abs(p1.x - p2.x) <= Math.max(1e-6, overshootAmount * 0.1)

  if (startDir === "none" && endDir === "none") {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 1
    push({ x: midX, y: p1.y })
    push({ x: midX, y: p2.y })
  } else if (startDir === "x+" && endDir === "y+") {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2
    if (p1.x > p2.x && p1.y < p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.1
      push({ x: p1.x + overshootAmount, y: p1.y })
      push({ x: p1.x + overshootAmount, y: p2.y + overshootAmount })
      push({ x: p2.x, y: p2.y + overshootAmount })
    } else if (!xAligned && !yAligned && p1.x < p2.x && p1.y > p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.2
      push({ x: p2.x, y: p1.y })
    } else if (xAligned) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.3
      push({ x: p1.x + overshootAmount, y: p1.y })
      push({ x: p1.x + overshootAmount, y: p2.y + overshootAmount })
      push({ x: p2.x, y: p2.y + overshootAmount })
    } else {
      if (p1.x < p2.x) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.4
        push({ x: midX, y: p1.y })
        push({ x: midX, y: p2Target.y })
        push({ x: p2.x, y: p2Target.y })
        // Handle the case in the comment below
      } else if (p1.y <= p2.y + overshootAmount) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.5
        push({ x: p1.x + overshootAmount, y: p1.y })
        push({ x: p1.x + overshootAmount, y: p1.y + overshootAmount })
        push({ x: p2.x, y: p1.y + overshootAmount })
        push({ x: p2.x, y: p2.y })
      } else {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.6
        push({ x: p1.x + overshootAmount, y: p1.y })
        push({ x: p1.x + overshootAmount, y: (p1.y + p2.y) / 2 })
        push({ x: p2.x, y: (p1.y + p2.y) / 2 })
      }
    }
  } else if (startDir === "x+" && endDir === "x+" && !yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 3
    const commonX = Math.max(p1.x + overshootAmount, p2Target.x)
    push({ x: commonX, y: p1.y })
    push({ x: commonX, y: p2.y })
  } else if (startDir === "x+" && endDir === "x+" && yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 3.1
    push({ x: p1.x + overshootAmount, y: p1.y })
    push({ x: p1.x + overshootAmount, y: p1.y + overshootAmount })
    push({ x: p2.x + overshootAmount, y: p1.y + overshootAmount })
    push({ x: p2.x + overshootAmount, y: p2.y })
  } else if (startDir === "x+" && endDir === "y-") {
    if (xAligned && p1.y <= p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.11
      push({ x: p1.x + overshootAmount, y: p1.y })
      push({ x: p1.x + overshootAmount, y: midY })
      push({ x: p2.x, y: midY })
    } else if (xAligned && p1.y > p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.12
      push({ x: p1.x + overshootAmount, y: p1.y })
      push({ x: p1.x + overshootAmount, y: p2.y - overshootAmount })
      push({ x: p2.x, y: p2.y - overshootAmount })
    } else if (p1.x < p2.x && p1.y < p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.2
      push({ x: p2.x, y: p1.y })
    } else {
      if (p1.x > p2.x && p1.y < p2.y) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.3
        const p1OvershootX = p1.x + overshootAmount
        push({ x: p1OvershootX, y: p1.y })
        push({ x: p1OvershootX, y: midY })
        push({ x: p2.x, y: midY })
      } else if (p1.x > p2.x && p1.y > p2.y) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.4
        const p1OvershootX = p1.x + overshootAmount
        push({ x: p1OvershootX, y: p1.y })
        push({ x: p1OvershootX, y: p2Target.y })
        push({ x: p2.x, y: p2Target.y })
      } else if (p1.y === p2.y) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.5
        push({ x: p1.x + overshootAmount, y: p1.y })
        push({ x: p1.x + overshootAmount, y: p1.y - overshootAmount })
        push({ x: p2.x, y: p1.y - overshootAmount })
      } else {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.6
        push({ x: midX, y: p1.y })
        push({ x: midX, y: p2Target.y })
        push({ x: p2.x, y: p2Target.y })
      }
    }
  } else if (
    startDir === "x+" &&
    endDir === "x-" &&
    p1.x + overshootAmount >= p2.x - overshootAmount &&
    !yAligned
  ) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 5
    const p1OvershootX = p1.x + overshootAmount
    push({ x: p1OvershootX, y: p1.y })
    push({ x: p1OvershootX, y: midY })
    push({ x: p2Target.x, y: midY })
    push({ x: p2Target.x, y: p2Target.y })
  } else if (startDir === "x+" && endDir === "x-" && yAligned && p2.x > p1.x) {
  } else if (startDir === "x+" && endDir === "x-" && yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 7
    push({ x: p1.x + overshootAmount, y: p1.y })
    push({ x: p1.x + overshootAmount, y: p1.y + overshootAmount })
    push({ x: p2.x - overshootAmount, y: p1.y + overshootAmount })
    push({ x: p2.x - overshootAmount, y: p1.y })
  } else {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 8
    if (startDir === "x+") {
      push({ x: p1.x + overshootAmount, y: p1.y })
    }
    push({ x: midX, y: result[result.length - 1]!.y })
    push({ x: midX, y: p2Target.y })
    push({ x: p2Target.x, y: p2Target.y })
  }

  push({ x: p2.x, y: p2.y })
  return result
}
