import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

const EPS = 1e-6
const DEFAULT_MERGE_DISTANCE = 0.25

type SegmentOrientation = "horizontal" | "vertical"

interface SegmentLocator {
  traceIndex: number
  segmentIndex: number
  orientation: SegmentOrientation
  p1: Point
  p2: Point
}

export interface SameNetTraceSegmentMergeSolverParams {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  mergeDistance?: number
}

export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  mergeDistance: number
  outputTraces: SolvedTracePath[]

  constructor(private params: SameNetTraceSegmentMergeSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    this.outputTraces = params.inputTracePaths.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
    }))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceSegmentMergeSolver
  >[0] {
    return this.params
  }

  override _step() {
    const merged = this.mergeNextCloseSameNetSegment()
    if (!merged) {
      this.solved = true
    }
  }

  private mergeNextCloseSameNetSegment(): boolean {
    for (let i = 0; i < this.outputTraces.length; i++) {
      const traceA = this.outputTraces[i]!
      for (let j = i + 1; j < this.outputTraces.length; j++) {
        const traceB = this.outputTraces[j]!
        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue

        const segmentAList = getOrthogonalSegments(traceA.tracePath, i)
        const segmentBList = getOrthogonalSegments(traceB.tracePath, j)

        for (const segmentA of segmentAList) {
          for (const segmentB of segmentBList) {
            if (segmentA.orientation !== segmentB.orientation) continue

            const candidate = getMergeCandidate(
              segmentA,
              segmentB,
              this.mergeDistance,
            )
            if (!candidate) continue

            const targetSegment =
              candidate.moveTraceIndex === i ? segmentA : segmentB
            const originalTrace = this.outputTraces[candidate.moveTraceIndex]!
            const candidatePath = moveSegmentOntoCoordinate(
              originalTrace.tracePath,
              targetSegment.segmentIndex,
              targetSegment.orientation,
              candidate.targetCoordinate,
            )

            if (
              doesIntroduceDifferentNetIntersection({
                originalPath: originalTrace.tracePath,
                candidatePath,
                sourceTraceIndex: candidate.moveTraceIndex,
                sourceNetId: originalTrace.globalConnNetId,
                allTraces: this.outputTraces,
              })
            ) {
              continue
            }

            this.outputTraces[candidate.moveTraceIndex] = {
              ...originalTrace,
              tracePath: candidatePath,
            }
            return true
          }
        }
      }
    }

    return false
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      traceMap: Object.fromEntries(
        this.outputTraces.map((trace) => [trace.mspPairId, trace]),
      ) as Record<string, SolvedTracePath>,
    }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}

const getOrthogonalSegments = (
  tracePath: Point[],
  traceIndex: number,
): SegmentLocator[] => {
  const segments: SegmentLocator[] = []
  for (
    let segmentIndex = 0;
    segmentIndex < tracePath.length - 1;
    segmentIndex++
  ) {
    const p1 = tracePath[segmentIndex]!
    const p2 = tracePath[segmentIndex + 1]!
    const isHorizontal = Math.abs(p1.y - p2.y) < EPS
    const isVertical = Math.abs(p1.x - p2.x) < EPS

    if (!isHorizontal && !isVertical) continue
    if (Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) < EPS) continue

    segments.push({
      traceIndex,
      segmentIndex,
      orientation: isHorizontal ? "horizontal" : "vertical",
      p1,
      p2,
    })
  }
  return segments
}

const getMergeCandidate = (
  segmentA: SegmentLocator,
  segmentB: SegmentLocator,
  mergeDistance: number,
): { moveTraceIndex: number; targetCoordinate: number } | null => {
  const gap =
    segmentA.orientation === "horizontal"
      ? Math.abs(segmentA.p1.y - segmentB.p1.y)
      : Math.abs(segmentA.p1.x - segmentB.p1.x)

  if (gap < EPS || gap > mergeDistance) return null
  if (!projectedRangesOverlap(segmentA, segmentB)) return null

  const lengthA = getSegmentLength(segmentA)
  const lengthB = getSegmentLength(segmentB)

  return lengthA >= lengthB
    ? {
        moveTraceIndex: segmentB.traceIndex,
        targetCoordinate:
          segmentA.orientation === "horizontal" ? segmentA.p1.y : segmentA.p1.x,
      }
    : {
        moveTraceIndex: segmentA.traceIndex,
        targetCoordinate:
          segmentB.orientation === "horizontal" ? segmentB.p1.y : segmentB.p1.x,
      }
}

const projectedRangesOverlap = (
  segmentA: SegmentLocator,
  segmentB: SegmentLocator,
) => {
  const [aMin, aMax] = getProjectedRange(segmentA)
  const [bMin, bMax] = getProjectedRange(segmentB)
  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > EPS
}

const getProjectedRange = (segment: SegmentLocator): [number, number] => {
  if (segment.orientation === "horizontal") {
    return [
      Math.min(segment.p1.x, segment.p2.x),
      Math.max(segment.p1.x, segment.p2.x),
    ]
  }
  return [
    Math.min(segment.p1.y, segment.p2.y),
    Math.max(segment.p1.y, segment.p2.y),
  ]
}

const getSegmentLength = (segment: SegmentLocator) => {
  if (segment.orientation === "horizontal") {
    return Math.abs(segment.p1.x - segment.p2.x)
  }
  return Math.abs(segment.p1.y - segment.p2.y)
}

const moveSegmentOntoCoordinate = (
  tracePath: Point[],
  segmentIndex: number,
  orientation: SegmentOrientation,
  targetCoordinate: number,
): Point[] => {
  const start = tracePath[segmentIndex]!
  const end = tracePath[segmentIndex + 1]!
  const movedStart =
    orientation === "horizontal"
      ? { x: start.x, y: targetCoordinate }
      : { x: targetCoordinate, y: start.y }
  const movedEnd =
    orientation === "horizontal"
      ? { x: end.x, y: targetCoordinate }
      : { x: targetCoordinate, y: end.y }

  return simplifyPath(
    removeConsecutiveDuplicatePoints([
      ...tracePath.slice(0, segmentIndex + 1),
      movedStart,
      movedEnd,
      ...tracePath.slice(segmentIndex + 1),
    ]),
  )
}

const removeConsecutiveDuplicatePoints = (path: Point[]) =>
  path.filter((point, index) => {
    if (index === 0) return true
    const previous = path[index - 1]!
    return (
      Math.abs(point.x - previous.x) > EPS ||
      Math.abs(point.y - previous.y) > EPS
    )
  })

const doesIntroduceDifferentNetIntersection = ({
  originalPath,
  candidatePath,
  sourceTraceIndex,
  sourceNetId,
  allTraces,
}: {
  originalPath: Point[]
  candidatePath: Point[]
  sourceTraceIndex: number
  sourceNetId: string
  allTraces: SolvedTracePath[]
}) => {
  const originalIntersections = countDifferentNetIntersections({
    path: originalPath,
    sourceTraceIndex,
    sourceNetId,
    allTraces,
  })
  const candidateIntersections = countDifferentNetIntersections({
    path: candidatePath,
    sourceTraceIndex,
    sourceNetId,
    allTraces,
  })

  return candidateIntersections > originalIntersections
}

const countDifferentNetIntersections = ({
  path,
  sourceTraceIndex,
  sourceNetId,
  allTraces,
}: {
  path: Point[]
  sourceTraceIndex: number
  sourceNetId: string
  allTraces: SolvedTracePath[]
}) => {
  let count = 0
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    for (let traceIndex = 0; traceIndex < allTraces.length; traceIndex++) {
      if (traceIndex === sourceTraceIndex) continue
      const otherTrace = allTraces[traceIndex]!
      if (otherTrace.globalConnNetId === sourceNetId) continue

      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        if (
          doSegmentsIntersect(
            p1,
            p2,
            otherTrace.tracePath[j]!,
            otherTrace.tracePath[j + 1]!,
          )
        ) {
          count++
        }
      }
    }
  }
  return count
}
