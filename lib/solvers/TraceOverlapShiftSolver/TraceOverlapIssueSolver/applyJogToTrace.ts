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

  if (si === 0) {
    if (isVertical) {
      const jogY = start.y + segDir * JOG_SIZE
      pts.splice(
        1,
        1,
        { x: start.x, y: jogY },
        { x: start.x + offset, y: jogY },
        { x: start.x + offset, y: end.y },
      )
    } else {
      // Horizontal
      const jogX = start.x + segDir * JOG_SIZE
      pts.splice(
        1,
        1,
        { x: jogX, y: start.y },
        { x: jogX, y: start.y + offset },
        { x: end.x, y: start.y + offset },
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
        { x: start.x + offset, y: jogY },
        { x: end.x, y: jogY },
      )
    } else {
      // Horizontal
      const jogX = end.x - segDir * JOG_SIZE
      pts.splice(
        si,
        1,
        { x: start.x, y: start.y + offset },
        { x: jogX, y: start.y + offset },
        { x: jogX, y: end.y },
      )
    }
  }
}
