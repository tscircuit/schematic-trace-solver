import type { Point } from "@tscircuit/math-utils"

export const applyJogToTerminalSegment = ({
  pts,
  segmentIndex: si,
  offset,
  JOG_SIZE,
  EPS = 1e-6,
}: {
  pts: Point[]
  segmentIndex: number
  offset: number
  JOG_SIZE: number
  EPS?: number
}) => {
  if (si !== 0 && si !== pts.length - 2) return

  const start = pts[si]!
  const end = pts[si + 1]!
  const isVertical = Math.abs(start.x - end.x) < EPS
  const isHorizontal = Math.abs(start.y - end.y) < EPS
  if (!isVertical && !isHorizontal) return

  const segDir = isVertical
    ? end.y > start.y
      ? 1
      : -1
    : end.x > start.x
      ? 1
      : -1

  // Single-segment trace: both endpoints are pins, so jog at both ends and
  // shift only the middle — neither endpoint may move off its pin.
  if (si === 0 && pts.length === 2) {
    if (isVertical) {
      const jogYStart = start.y + segDir * JOG_SIZE
      const jogYEnd = end.y - segDir * JOG_SIZE
      pts.splice(
        1,
        0,
        { x: start.x, y: jogYStart },
        { x: start.x + offset, y: jogYStart },
        { x: end.x + offset, y: jogYEnd },
        { x: end.x, y: jogYEnd },
      )
    } else {
      // Horizontal
      const jogXStart = start.x + segDir * JOG_SIZE
      const jogXEnd = end.x - segDir * JOG_SIZE
      pts.splice(
        1,
        0,
        { x: jogXStart, y: start.y },
        { x: jogXStart, y: start.y + offset },
        { x: jogXEnd, y: end.y + offset },
        { x: jogXEnd, y: end.y },
      )
    }
    return
  }

  if (si === 0) {
    if (isVertical) {
      const jogY = start.y + segDir * JOG_SIZE
      pts.splice(
        1,
        1,
        { x: start.x, y: jogY },
        { x: start.x + offset, y: jogY },
        { x: end.x + offset, y: end.y },
      )
    } else {
      // Horizontal
      const jogX = start.x + segDir * JOG_SIZE
      pts.splice(
        1,
        1,
        { x: jogX, y: start.y },
        { x: jogX, y: start.y + offset },
        { x: end.x, y: end.y + offset },
      )
    }
  } else {
    // si === pts.length - 2
    if (isVertical) {
      const jogY = end.y - segDir * JOG_SIZE
      pts.splice(
        si,
        1,
        { x: start.x + offset, y: start.y },
        { x: end.x + offset, y: jogY },
        { x: end.x, y: jogY },
      )
    } else {
      // Horizontal
      const jogX = end.x - segDir * JOG_SIZE
      pts.splice(
        si,
        1,
        { x: start.x, y: start.y + offset },
        { x: jogX, y: end.y + offset },
        { x: jogX, y: end.y },
      )
    }
  }
}
