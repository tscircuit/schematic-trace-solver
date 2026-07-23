import { BaseSolver } from "../../BaseSolver/BaseSolver"
import type { InputProblem } from "../../../types/InputProblem"
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"

import { findAllLShapedTurns, type LShape } from "./findAllLShapedTurns"
import { getTraceObstacles } from "./getTraceObstacles"
import {
  findIntersectionsWithObstacles,
  findPerpendicularPathCrossings,
} from "./findIntersectionsWithObstacles"
import {
  generateLShapeRerouteCandidates,
  generatePerpendicularTraceDetours,
} from "./generateLShapeRerouteCandidates"
import { isPathColliding, type CollisionInfo } from "./isPathColliding"
import {
  generateRectangleCandidates,
  type Rectangle,
  type RectangleCandidate,
} from "./generateRectangleCandidates"

import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"

import { visualizeLSapes } from "./visualizeLSapes"
import { visualizeIntersectionPoints } from "./visualizeIntersectionPoints"
import { visualizeTightRectangle } from "../visualizeTightRectangle"
import { visualizeCandidates } from "./visualizeCandidates"
import { mergeGraphicsObjects } from "../mergeGraphicsObjects"
import { visualizeCollision } from "./visualizeCollision"
import {
  getPathLength,
  isPathCollidingWithChipInterior,
} from "../../Example28Solver/geometry"
import { getObstacleRects } from "../../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

interface TraceCrossing {
  trace: SolvedTracePath
  segmentIndex: number
  otherTrace: SolvedTracePath
  otherSegmentIndex: number
  isInitialBundleCrossing: boolean
}

/**
 * Defines the input structure for the UntangleTraceSubsolver.
 */
export interface UntangleTraceSubsolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}

/**
 * Represents the different visualization modes for the UntangleTraceSubsolver.
 */
type VisualizationMode =
  | "l_shapes"
  | "intersection_points"
  | "tight_rectangle"
  | "candidates"

/**
 * The UntangleTraceSubsolver is designed to resolve complex overlaps and improve the routing of traces,
 * particularly focusing on "L-shaped" turns that might be causing congestion or suboptimal paths.
 * Its main workflow involves several steps:
 * 1. **Identify L-Shapes**: It first identifies all L-shaped turns within the traces that need processing.
 * 2. **Find Intersections**: For each L-shape, it determines intersection points with other traces and obstacles.
 * 3. **Generate Rectangle Candidates**: Based on these intersection points, it generates potential rectangular regions for rerouting.
 * 4. **Evaluate Candidates**: For each rectangular candidate, it generates alternative trace paths and evaluates them for collisions.
 * 5. **Apply Best Route**: If a collision-free and improved route is found, it updates the trace path.
 * This iterative process aims to untangle traces and create a cleaner, more efficient layout.
 */
export class UntangleTraceSubsolver extends BaseSolver {
  private input: UntangleTraceSubsolverInput
  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private lShapesToProcess: LShape[] = []
  private ignoredCrossings = new Set<string>()
  private reroutedTraceIds = new Set<string>()
  private processingCrossings = true
  private visualizationMode: VisualizationMode = "l_shapes"

  private currentLShape: LShape | null = null
  private intersectionPoints: Point[] = []
  private tightRectangle: Rectangle | null = null
  private candidates: Point[][] = []
  private bestRoute: Point[] | null = null
  private lastCollision: CollisionInfo | null = null
  private collidingCandidate: Point[] | null = null

  private rectangleCandidates: RectangleCandidate[] = []
  private currentRectangleIndex = 0

  private isInitialStep = true
  private currentCandidateIndex = 0
  private lShapeProcessingStep:
    | "idle"
    | "intersections"
    | "rectangle_selection"
    | "candidate_evaluation" = "idle"
  private lShapeJustProcessed = false
  private bestRouteFound: Point[] | null = null

  constructor(solverInput: UntangleTraceSubsolverInput) {
    super()
    this.input = solverInput
    this.visualizationMode = "l_shapes"

    this.chipObstacleSpatialIndex =
      this.input.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(this.input.inputProblem.chips)
    if (!this.input.inputProblem._chipObstacleSpatialIndex) {
      this.input.inputProblem._chipObstacleSpatialIndex =
        this.chipObstacleSpatialIndex
    }
  }

  override _step(): void {
    if (this.isInitialStep) {
      this.isInitialStep = false
      return
    }

    if (this.processingCrossings) {
      // The L-shape pass below only reacts when both arms intersect obstacles.
      // Resolve strict crossings on merged-label bundles before entering it.
      const crossing = this._findCrossing()
      if (crossing) {
        if (!this._resolveCrossing(crossing)) {
          this.ignoredCrossings.add(this._crossingKey(crossing))
        }
        return
      }
      this.processingCrossings = false
      this._initializeLShapes()
      return
    }

    if (this.lShapeJustProcessed) {
      this._resetAfterLShapProcessing()
      return
    }

    if (this.lShapesToProcess.length === 0 && this.currentLShape === null) {
      this.solved = true
      return
    }

    switch (this.lShapeProcessingStep) {
      case "idle":
        this._handleIdleStep()
        break
      case "intersections":
        this._handleIntersectionsStep()
        break
      case "rectangle_selection":
        this._handleRectangleSelectionStep()
        break
      case "candidate_evaluation":
        this._handleCandidateEvaluationStep()
        break
    }
  }

  private _initializeLShapes() {
    for (const trace of this.input.allTraces) {
      this.lShapesToProcess.push(
        ...findAllLShapedTurns(trace.tracePath).map((lShape) => ({
          ...lShape,
          traceId: trace.mspPairId,
        })),
      )
    }
  }

  private _crossingKey(crossing: TraceCrossing) {
    return `${crossing.trace.mspPairId}:${crossing.segmentIndex}:${crossing.otherTrace.mspPairId}:${crossing.otherSegmentIndex}`
  }

  private _isTraceBundle(first: SolvedTracePath, second: SolvedTracePath) {
    const componentPair = (trace: SolvedTracePath) =>
      trace.pins
        .map((pin) => pin.chipId)
        .sort()
        .join(":")
    if (componentPair(first) !== componentPair(second)) return false

    return Object.values(this.input.mergedLabelNetIdMap).some(
      (netIds) =>
        netIds.has(first.globalConnNetId) && netIds.has(second.globalConnNetId),
    )
  }

  private _findCrossing(): TraceCrossing | null {
    const traces = this.input.allTraces
    for (let firstIndex = 0; firstIndex < traces.length; firstIndex++) {
      const trace = traces[firstIndex]!
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < traces.length;
        secondIndex++
      ) {
        const otherTrace = traces[secondIndex]!
        if (trace.globalConnNetId === otherTrace.globalConnNetId) continue
        const isInitialBundleCrossing = this._isTraceBundle(trace, otherTrace)
        if (
          !isInitialBundleCrossing &&
          !this.reroutedTraceIds.has(trace.mspPairId) &&
          !this.reroutedTraceIds.has(otherTrace.mspPairId)
        ) {
          continue
        }

        const crossings = findPerpendicularPathCrossings(
          trace.tracePath,
          otherTrace.tracePath,
        )
        for (const { pathSegmentIndex, otherPathSegmentIndex } of crossings) {
          const crossing = {
            trace,
            segmentIndex: pathSegmentIndex,
            otherTrace,
            otherSegmentIndex: otherPathSegmentIndex,
            isInitialBundleCrossing,
          }
          if (!this.ignoredCrossings.has(this._crossingKey(crossing))) {
            return crossing
          }
        }
      }
    }
    return null
  }

  private _resolveCrossing(crossing: TraceCrossing) {
    const chipBounds = this.chipObstacleSpatialIndex.chips.map(
      (chip) => chip.bounds,
    )
    const candidates = [
      ...generatePerpendicularTraceDetours({
        trace: crossing.trace,
        segmentIndex: crossing.segmentIndex,
        obstacleStart:
          crossing.otherTrace.tracePath[crossing.otherSegmentIndex]!,
        obstacleEnd:
          crossing.otherTrace.tracePath[crossing.otherSegmentIndex + 1]!,
        chipBounds,
        clearance: this.input.paddingBuffer,
      }),
      ...generatePerpendicularTraceDetours({
        trace: crossing.otherTrace,
        segmentIndex: crossing.otherSegmentIndex,
        obstacleStart: crossing.trace.tracePath[crossing.segmentIndex]!,
        obstacleEnd: crossing.trace.tracePath[crossing.segmentIndex + 1]!,
        chipBounds,
        clearance: this.input.paddingBuffer,
      }),
    ]
    const chipObstacles = getObstacleRects(this.input.inputProblem).filter(
      (obstacle) => obstacle.kind === "chip",
    )
    // Prefer a globally clear route. If the initial bundle detour transfers
    // the crossing, continue rip-up/reroute from that moved trace until clear.
    const validCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        collision: isPathColliding(
          candidate.path,
          this.input.allTraces,
          candidate.traceId,
        ),
      }))
      .filter(
        (candidate) =>
          !isPathCollidingWithChipInterior(candidate.path, chipObstacles) &&
          !isPathColliding(
            candidate.path,
            [crossing.trace, crossing.otherTrace],
            candidate.traceId,
          ).isColliding &&
          (crossing.isInitialBundleCrossing ||
            !candidate.collision.isColliding),
      )
      .sort(
        (first, second) =>
          Number(first.collision.isColliding) -
            Number(second.collision.isColliding) ||
          getPathLength(first.path) - getPathLength(second.path),
      )
    const bestCandidate = validCandidates[0]
    if (!bestCandidate) return false

    const traceIndex = this.input.allTraces.findIndex(
      (trace) => trace.mspPairId === bestCandidate.traceId,
    )
    this.input.allTraces[traceIndex] = {
      ...this.input.allTraces[traceIndex]!,
      tracePath: bestCandidate.path,
    }
    this.reroutedTraceIds.add(bestCandidate.traceId)
    return true
  }

  private _resetAfterLShapProcessing() {
    this.lShapeProcessingStep = "idle"
    this.currentLShape = null
    this.currentCandidateIndex = 0
    this.lShapeJustProcessed = false
    this.visualizationMode = "l_shapes" // Reset visualization mode
    this.intersectionPoints = [] // Clear temporary data
    this.tightRectangle = null
    this.candidates = []
    this.bestRoute = null
    this.lastCollision = null
    this.collidingCandidate = null
  }

  private _handleIdleStep() {
    this.currentLShape = this.lShapesToProcess.shift()!
    if (!this.currentLShape) {
      this.solved = true
      return
    }
    this.lShapeProcessingStep = "intersections"
    this.visualizationMode = "l_shapes"
  }

  private _handleIntersectionsStep() {
    if (!this.currentLShape!.traceId) {
      this.lShapeProcessingStep = "idle"
      return
    }
    const allObstacles = getTraceObstacles(
      this.input.allTraces,
      this.currentLShape!.traceId,
    )
    const intersections1 = findIntersectionsWithObstacles(
      this.currentLShape!.p1,
      this.currentLShape!.p2,
      allObstacles,
    )
    const intersections2 = findIntersectionsWithObstacles(
      this.currentLShape!.p2,
      this.currentLShape!.p3,
      allObstacles,
    )

    this.intersectionPoints = [...intersections1, ...intersections2]

    if (intersections1.length === 0 || intersections2.length === 0) {
      this.lShapeProcessingStep = "idle"
      return
    }

    this.rectangleCandidates = generateRectangleCandidates(
      intersections1,
      intersections2,
    )
    this.currentRectangleIndex = 0
    this.lShapeProcessingStep = "rectangle_selection"
  }

  private _handleRectangleSelectionStep() {
    if (this.currentRectangleIndex >= this.rectangleCandidates.length) {
      this.lShapeProcessingStep = "idle"
      return
    }

    const { rect, i1, i2 } =
      this.rectangleCandidates[this.currentRectangleIndex]
    this.tightRectangle = rect

    this.candidates = generateLShapeRerouteCandidates({
      lShape: this.currentLShape!,
      rectangle: this.tightRectangle!,
      padding: 2 * this.input.paddingBuffer,
      interactionPoint1: i1,
      interactionPoint2: i2,
    })
    this.currentCandidateIndex = 0
    this.lastCollision = null
    this.collidingCandidate = null

    this.visualizationMode = "candidates"
    this.lShapeProcessingStep = "candidate_evaluation"
  }

  private _handleCandidateEvaluationStep() {
    this.visualizationMode = "candidates"

    if (this.bestRouteFound) {
      this._applyBestRoute(this.bestRouteFound)
      this.bestRouteFound = null
      return
    }

    if (this.currentCandidateIndex >= this.candidates.length) {
      this.currentRectangleIndex++
      this.lShapeProcessingStep = "rectangle_selection"
      return
    }

    const currentCandidate = this.candidates[this.currentCandidateIndex]
    const collisionResult = isPathColliding(
      currentCandidate,
      this.input.allTraces,
      this.currentLShape!.traceId,
    )

    // Untangling must never move a trace through a component body. The candidate
    // only covers the rerouted corner (not the pin-terminal segments), so reject
    // any candidate that crosses a chip; the original (component-clear) path is
    // kept instead, so this stage only ever improves or leaves the trace valid.
    if (
      !collisionResult?.isColliding &&
      this._doesCandidateCrossChip(currentCandidate)
    ) {
      this.lastCollision = null
      this.collidingCandidate = currentCandidate
      this.currentCandidateIndex++
      return
    }

    if (!collisionResult?.isColliding) {
      this.bestRouteFound = currentCandidate
      this.lastCollision = null
      this.collidingCandidate = null
    } else {
      this.lastCollision = collisionResult
      this.collidingCandidate = currentCandidate
      this.currentCandidateIndex++
    }
  }

  /**
   * Returns true if any segment of the candidate reroute passes through a
   * schematic component (chip) body.
   */
  private _doesCandidateCrossChip(candidate: Point[]): boolean {
    for (let i = 0; i < candidate.length - 1; i++) {
      if (
        this.chipObstacleSpatialIndex.doesOrthogonalLineIntersectChip([
          candidate[i]!,
          candidate[i + 1]!,
        ])
      ) {
        return true
      }
    }
    return false
  }

  private _applyBestRoute(bestRoute: Point[]) {
    this.bestRoute = bestRoute
    this.collidingCandidate = null
    this.lastCollision = null

    const traceIndex = this.input.allTraces.findIndex(
      (trace) => trace.mspPairId === this.currentLShape!.traceId,
    )
    if (traceIndex !== -1) {
      const originalTrace = this.input.allTraces[traceIndex]
      const p2Index = originalTrace.tracePath.findIndex(
        (p) =>
          p.x === this.currentLShape!.p2.x && p.y === this.currentLShape!.p2.y,
      )
      if (p2Index !== -1) {
        const newTracePath = [
          ...originalTrace.tracePath.slice(0, p2Index),
          ...bestRoute,
          ...originalTrace.tracePath.slice(p2Index + 1),
        ]
        this.input.allTraces[traceIndex] = {
          ...originalTrace,
          tracePath: newTracePath,
        }
        this.lShapesToProcess = this.lShapesToProcess.filter(
          (l) => l.traceId !== this.currentLShape!.traceId,
        )
      }
    }
    this.lShapeJustProcessed = true
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.input.allTraces }
  }

  override visualize(): GraphicsObject {
    // console.log("VISUALIZE STATE:", {
    //   step: this.lShapeProcessingStep,
    //   vizMode: this.visualizationMode,
    //   lShape: this.currentLShape?.traceId,
    //   rectIdx: this.currentRectangleIndex,
    //   rectCount: this.rectangleCandidates.length,
    //   tightRect: this.tightRectangle,
    //   pathIdx: this.currentCandidateIndex,
    //   pathCount: this.candidates.length,
    //   lastCollision: this.lastCollision?.isColliding,
    // })

    switch (this.visualizationMode) {
      case "l_shapes":
        return visualizeLSapes(this.lShapesToProcess)
      case "intersection_points":
        return mergeGraphicsObjects([
          this.currentLShape ? visualizeLSapes(this.currentLShape) : undefined,
          visualizeIntersectionPoints(this.intersectionPoints),
        ])
      case "tight_rectangle":
        return mergeGraphicsObjects([
          this.currentLShape ? visualizeLSapes(this.currentLShape) : undefined,
          visualizeIntersectionPoints(this.intersectionPoints),
          this.tightRectangle
            ? visualizeTightRectangle(this.tightRectangle)
            : undefined,
        ])
      case "candidates": {
        if (this.lShapeJustProcessed) {
          const allTracesGraphics: GraphicsObject = { lines: [] }
          for (const trace of this.input.allTraces) {
            const isUpdatedTrace =
              trace.mspPairId === this.currentLShape?.traceId
            for (let i = 0; i < trace.tracePath.length - 1; i++) {
              allTracesGraphics.lines!.push({
                points: [trace.tracePath[i], trace.tracePath[i + 1]],
                strokeColor: isUpdatedTrace ? "green" : "#ccc",
              })
            }
          }
          return allTracesGraphics
        }

        const allTracesGraphics: GraphicsObject = { lines: [] }
        for (const trace of this.input.allTraces) {
          for (let i = 0; i < trace.tracePath.length - 1; i++) {
            allTracesGraphics.lines!.push({
              points: [trace.tracePath[i], trace.tracePath[i + 1]],
              strokeColor: "#ccc", // Light gray for other traces
            })
          }
        }

        let candidateToDraw: Point[] | undefined
        if (this.bestRouteFound) {
          candidateToDraw = this.bestRouteFound
        } else if (this.lastCollision?.isColliding) {
          candidateToDraw = this.collidingCandidate ?? undefined
        } else {
          if (this.currentCandidateIndex < this.candidates.length) {
            candidateToDraw = this.candidates[this.currentCandidateIndex]
          }
        }

        return mergeGraphicsObjects([
          allTracesGraphics,
          this.currentLShape ? visualizeLSapes(this.currentLShape) : undefined,
          this.tightRectangle
            ? visualizeTightRectangle(this.tightRectangle)
            : undefined,
          candidateToDraw
            ? visualizeCandidates(
                [candidateToDraw],
                this.bestRouteFound ? "green" : "blue",
                this.intersectionPoints,
              )
            : undefined,
          this.lastCollision
            ? visualizeCollision(this.lastCollision)
            : undefined,
        ])
      }
      default:
        return {}
    }
  }
}
