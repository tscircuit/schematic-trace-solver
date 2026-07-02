type Point = { x: number; y: number }

type TraceWithPath = {
  globalConnNetId: string
  tracePath: Point[]
}

type SegmentOrientation = "horizontal" | "vertical"

type SegmentRef = {
  traceIndex: number
  pointIndex: number
  orientation: SegmentOrientation
  axis: number
  start: number
  end: number
  length: number
}

const DEFAULT_AXIS_TOLERANCE = 0.1
const EPSILON = 1e-9

export const mergeNearbySameNetSegments = <T extends TraceWithPath>(
  traces: T[],
  options: {
    axisTolerance?: number
  } = {},
): T[] => {
  const axisTolerance = options.axisTolerance ?? DEFAULT_AXIS_TOLERANCE
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  for (const trace of outputTraces) {
    trace.tracePath = simplifyPath(
      alignSmallJogs(trace.tracePath, axisTolerance),
    )
  }

  const tracesByNet = new Map<string, Array<{ trace: T; index: number }>>()
  for (let index = 0; index < outputTraces.length; index++) {
    const trace = outputTraces[index]!
    const tracesForNet = tracesByNet.get(trace.globalConnNetId) ?? []
    tracesForNet.push({ trace, index })
    tracesByNet.set(trace.globalConnNetId, tracesForNet)
  }

  for (const tracesForNet of tracesByNet.values()) {
    alignInternalParallelSegments(
      outputTraces,
      tracesForNet.map((entry) => entry.index),
      axisTolerance,
    )
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}

const alignSmallJogs = (tracePath: Point[], axisTolerance: number): Point[] => {
  const points = tracePath.map((point) => ({ ...point }))

  for (let i = 0; i < points.length - 3; i++) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    const p2 = points[i + 2]!
    const p3 = points[i + 3]!

    if (
      isHorizontal(p0, p1) &&
      isVertical(p1, p2) &&
      isHorizontal(p2, p3) &&
      Math.abs(p1.y - p2.y) <= axisTolerance
    ) {
      const canMoveFirstSegment = i > 0
      const canMoveSecondSegment = i + 3 < points.length - 1
      if (!canMoveFirstSegment && !canMoveSecondSegment) continue

      const firstLength = Math.abs(p1.x - p0.x)
      const secondLength = Math.abs(p3.x - p2.x)
      if (
        !canMoveFirstSegment ||
        (canMoveSecondSegment && firstLength >= secondLength)
      ) {
        p2.y = p1.y
        p3.y = p1.y
      } else {
        p0.y = p2.y
        p1.y = p2.y
      }
      continue
    }

    if (
      isVertical(p0, p1) &&
      isHorizontal(p1, p2) &&
      isVertical(p2, p3) &&
      Math.abs(p1.x - p2.x) <= axisTolerance
    ) {
      const canMoveFirstSegment = i > 0
      const canMoveSecondSegment = i + 3 < points.length - 1
      if (!canMoveFirstSegment && !canMoveSecondSegment) continue

      const firstLength = Math.abs(p1.y - p0.y)
      const secondLength = Math.abs(p3.y - p2.y)
      if (
        !canMoveFirstSegment ||
        (canMoveSecondSegment && firstLength >= secondLength)
      ) {
        p2.x = p1.x
        p3.x = p1.x
      } else {
        p0.x = p2.x
        p1.x = p2.x
      }
    }
  }

  return points
}

const alignInternalParallelSegments = <T extends TraceWithPath>(
  traces: T[],
  traceIndexes: number[],
  axisTolerance: number,
) => {
  const segments = traceIndexes.flatMap((traceIndex) =>
    getInternalSegments(traces[traceIndex]!, traceIndex),
  )

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const first = segments[i]!
      const second = segments[j]!
      if (first.orientation !== second.orientation) continue
      if (Math.abs(first.axis - second.axis) > axisTolerance) continue
      if (getProjectionOverlap(first, second) <= 0) continue

      const target = first.length >= second.length ? first : second
      const segmentToMove = target === first ? second : first
      moveSegmentAxis(
        traces[segmentToMove.traceIndex]!,
        segmentToMove,
        target.axis,
      )
      segmentToMove.axis = target.axis
    }
  }
}

const getInternalSegments = (
  trace: TraceWithPath,
  traceIndex: number,
): SegmentRef[] => {
  const segments: SegmentRef[] = []

  for (
    let pointIndex = 1;
    pointIndex < trace.tracePath.length - 2;
    pointIndex++
  ) {
    const startPoint = trace.tracePath[pointIndex]!
    const endPoint = trace.tracePath[pointIndex + 1]!
    const orientation = getOrientation(startPoint, endPoint)
    if (!orientation) continue

    segments.push({
      traceIndex,
      pointIndex,
      orientation,
      axis: orientation === "horizontal" ? startPoint.y : startPoint.x,
      start:
        orientation === "horizontal"
          ? Math.min(startPoint.x, endPoint.x)
          : Math.min(startPoint.y, endPoint.y),
      end:
        orientation === "horizontal"
          ? Math.max(startPoint.x, endPoint.x)
          : Math.max(startPoint.y, endPoint.y),
      length:
        orientation === "horizontal"
          ? Math.abs(endPoint.x - startPoint.x)
          : Math.abs(endPoint.y - startPoint.y),
    })
  }

  return segments
}

const moveSegmentAxis = (
  trace: TraceWithPath,
  segment: SegmentRef,
  targetAxis: number,
) => {
  const startPoint = trace.tracePath[segment.pointIndex]!
  const endPoint = trace.tracePath[segment.pointIndex + 1]!

  if (segment.orientation === "horizontal") {
    startPoint.y = targetAxis
    endPoint.y = targetAxis
  } else {
    startPoint.x = targetAxis
    endPoint.x = targetAxis
  }
}

const simplifyPath = (tracePath: Point[]): Point[] => {
  const deduped: Point[] = []
  for (const point of tracePath) {
    const previous = deduped[deduped.length - 1]
    if (!previous || !areSamePoint(previous, point)) {
      deduped.push({ ...point })
    }
  }

  const simplified: Point[] = []
  for (const point of deduped) {
    simplified.push(point)
    while (simplified.length >= 3) {
      const p0 = simplified[simplified.length - 3]!
      const p1 = simplified[simplified.length - 2]!
      const p2 = simplified[simplified.length - 1]!
      if (!areCollinear(p0, p1, p2)) break
      simplified.splice(simplified.length - 2, 1)
    }
  }

  return simplified
}

const getProjectionOverlap = (first: SegmentRef, second: SegmentRef) =>
  Math.min(first.end, second.end) - Math.max(first.start, second.start)

const getOrientation = (
  startPoint: Point,
  endPoint: Point,
): SegmentOrientation | null => {
  if (isHorizontal(startPoint, endPoint)) return "horizontal"
  if (isVertical(startPoint, endPoint)) return "vertical"
  return null
}

const isHorizontal = (startPoint: Point, endPoint: Point) =>
  Math.abs(startPoint.y - endPoint.y) < EPSILON

const isVertical = (startPoint: Point, endPoint: Point) =>
  Math.abs(startPoint.x - endPoint.x) < EPSILON

const areSamePoint = (first: Point, second: Point) =>
  Math.abs(first.x - second.x) < EPSILON &&
  Math.abs(first.y - second.y) < EPSILON

const areCollinear = (p0: Point, p1: Point, p2: Point) =>
  (isHorizontal(p0, p1) && isHorizontal(p1, p2)) ||
  (isVertical(p0, p1) && isVertical(p1, p2))
