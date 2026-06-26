import {
  calculateElbowBends,
  type ElbowPoint,
  type NormalisedStartPoint,
} from "./calculateElbowBends"

export type { ElbowPoint }

export const calculateElbow = (
  point1: ElbowPoint,
  point2: ElbowPoint,
  options: {
    /**
     * Amount to overshoot the line if the facingDirection requires that we go
     * beyond "out" before turning
     */
    overshoot?: number
  } = {},
): Array<{ x: number; y: number }> => {
  let p1 = point1
  let p2 = point2
  let orderFlipped = false

  if (p1.x > p2.x || (p1.x === p2.x && p1.y > p2.y)) {
    orderFlipped = true
    ;[p1, p2] = [p2, p1]
  }

  // Mirror the coordinate system around p1 so it never faces "x-" or "y-"
  const mirrorX = p1.facingDirection === "x-"
  const mirrorY = p1.facingDirection === "y-"

  const mirrorPoint = (pt: ElbowPoint): ElbowPoint => {
    const x = mirrorX ? p1.x - (pt.x - p1.x) : pt.x
    const y = mirrorY ? p1.y - (pt.y - p1.y) : pt.y

    let facing = pt.facingDirection
    if (mirrorX) {
      if (facing === "x+") facing = "x-"
      else if (facing === "x-") facing = "x+"
    }
    if (mirrorY) {
      if (facing === "y+") facing = "y-"
      else if (facing === "y-") facing = "y+"
    }

    return { x, y, facingDirection: facing }
  }

  // Rotate a point 90° clockwise around the centre and adjust facingDirection
  const rotateCW = (pt: ElbowPoint, centre: ElbowPoint): ElbowPoint => {
    const dx = pt.x - centre.x
    const dy = pt.y - centre.y
    const x = centre.x + dy
    const y = centre.y - dx

    let facing = pt.facingDirection
    switch (facing) {
      case "x+":
        facing = "y-"
        break
      case "y-":
        facing = "x-"
        break
      case "x-":
        facing = "y+"
        break
      case "y+":
        facing = "x+"
        break
    }

    return { x, y, facingDirection: facing }
  }

  // Rotate a point 90° counter-clockwise around the centre (no facingDirection)
  const rotateCCW = (
    pt: { x: number; y: number },
    centre: { x: number; y: number },
  ): { x: number; y: number } => {
    const dx = pt.x - centre.x
    const dy = pt.y - centre.y
    return { x: centre.x - dy, y: centre.y + dx }
  }

  const mp1 = mirrorX || mirrorY ? mirrorPoint(p1) : p1
  const mp2 = mirrorX || mirrorY ? mirrorPoint(p2) : p2

  // Rotate 90° clockwise around mp1 if it is facing "y+" so that it faces "x+"
  let rp1: ElbowPoint = mp1
  let rp2: ElbowPoint = mp2
  let rotated = false
  if (mp1.facingDirection === "y+") {
    rotated = true
    rp1 = { ...mp1, facingDirection: "x+" }
    rp2 = rotateCW(mp2, mp1)
  }

  const overshootAmount =
    options?.overshoot ??
    0.1 * Math.max(Math.abs(rp1.x - rp2.x), Math.abs(rp1.y - rp2.y))

  let result = calculateElbowBends(
    rp1 as NormalisedStartPoint,
    rp2,
    overshootAmount,
  )

  if (rotated) {
    result = result.map((pt) => rotateCCW(pt, rp1))
  }

  if (mirrorX || mirrorY) {
    result = result.map(({ x, y }) => ({
      x: mirrorX ? p1.x - (x - p1.x) : x,
      y: mirrorY ? p1.y - (y - p1.y) : y,
    }))
  }

  return orderFlipped ? result.reverse() : result
}
