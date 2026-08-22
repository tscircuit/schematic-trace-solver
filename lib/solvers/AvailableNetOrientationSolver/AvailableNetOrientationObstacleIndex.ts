import type { Bounds, Point } from "@tscircuit/math-utils"
import Flatbush from "flatbush"
import type { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { EPS } from "./constants"
import { segmentCrossesBoundsInterior } from "./geometry"

export type IndexedTraceSegment = {
  trace: SolvedTracePath
  start: Point
  end: Point
}

export class AvailableNetOrientationObstacleIndex {
  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private labelIndex: Flatbush | null = null
  private traceSegmentIndex: Flatbush | null = null
  private traceSegments: IndexedTraceSegment[] = []

  constructor(params: {
    chipObstacleSpatialIndex: ChipObstacleSpatialIndex
    netLabelPlacements: NetLabelPlacement[]
    traces: SolvedTracePath[]
  }) {
    this.chipObstacleSpatialIndex = params.chipObstacleSpatialIndex
    this.rebuild(params)
  }

  rebuild(params: {
    netLabelPlacements: NetLabelPlacement[]
    traces: SolvedTracePath[]
  }) {
    this.labelIndex = this.buildLabelIndex(params.netLabelPlacements)
    this.traceSegments = this.getTraceSegments(params.traces)
    this.traceSegmentIndex = this.buildTraceSegmentIndex(this.traceSegments)
  }

  getLabelIndicesInBounds(bounds: Bounds) {
    if (!this.labelIndex) return []
    return this.labelIndex.search(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    )
  }

  getTraceSegmentsInBounds(bounds: Bounds) {
    if (!this.traceSegmentIndex) return []
    const searchBounds = getPaddedBounds(bounds, EPS)
    return this.traceSegmentIndex
      .search(
        searchBounds.minX,
        searchBounds.minY,
        searchBounds.maxX,
        searchBounds.maxY,
      )
      .map((segmentIndex) => this.traceSegments[segmentIndex]!)
  }

  getLabelIndicesNearTracePath(tracePath: Point[]) {
    const labelIndices = new Set<number>()
    for (let pointIndex = 0; pointIndex < tracePath.length - 1; pointIndex++) {
      const segmentBounds = getPaddedBounds(
        getSegmentBounds(tracePath[pointIndex]!, tracePath[pointIndex + 1]!),
        EPS,
      )
      for (const labelIndex of this.getLabelIndicesInBounds(segmentBounds)) {
        labelIndices.add(labelIndex)
      }
    }
    return [...labelIndices].sort((a, b) => a - b)
  }

  doesTracePathCrossChip(tracePath: Point[]) {
    for (let pointIndex = 0; pointIndex < tracePath.length - 1; pointIndex++) {
      const start = tracePath[pointIndex]!
      const end = tracePath[pointIndex + 1]!
      const nearbyChips = this.chipObstacleSpatialIndex.getChipsInBounds(
        getPaddedBounds(getSegmentBounds(start, end), EPS),
      )
      for (const chip of nearbyChips) {
        if (segmentCrossesBoundsInterior(start, end, chip.bounds)) return true
      }
    }
    return false
  }

  doesTraceCrossBoundsInterior(bounds: Bounds) {
    for (const segment of this.getTraceSegmentsInBounds(bounds)) {
      if (segmentCrossesBoundsInterior(segment.start, segment.end, bounds)) {
        return true
      }
    }
    return false
  }

  doesTraceIntersectBounds(params: {
    bounds: Bounds
    excludedGlobalConnNetId: string
  }) {
    for (const segment of this.getTraceSegmentsInBounds(params.bounds)) {
      if (segment.trace.globalConnNetId === params.excludedGlobalConnNetId) {
        continue
      }
      if (segmentIntersectsRect(segment.start, segment.end, params.bounds)) {
        return true
      }
    }
    return false
  }

  private buildLabelIndex(netLabelPlacements: NetLabelPlacement[]) {
    if (netLabelPlacements.length === 0) return null

    const labelIndex = new Flatbush(netLabelPlacements.length)
    for (const label of netLabelPlacements) {
      labelIndex.add(
        label.center.x - label.width / 2,
        label.center.y - label.height / 2,
        label.center.x + label.width / 2,
        label.center.y + label.height / 2,
      )
    }
    labelIndex.finish()
    return labelIndex
  }

  private getTraceSegments(traces: SolvedTracePath[]) {
    const traceSegments: IndexedTraceSegment[] = []
    for (const trace of traces) {
      for (
        let pointIndex = 0;
        pointIndex < trace.tracePath.length - 1;
        pointIndex++
      ) {
        traceSegments.push({
          trace,
          start: trace.tracePath[pointIndex]!,
          end: trace.tracePath[pointIndex + 1]!,
        })
      }
    }
    return traceSegments
  }

  private buildTraceSegmentIndex(traceSegments: IndexedTraceSegment[]) {
    if (traceSegments.length === 0) return null

    const traceSegmentIndex = new Flatbush(traceSegments.length)
    for (const segment of traceSegments) {
      traceSegmentIndex.add(
        Math.min(segment.start.x, segment.end.x),
        Math.min(segment.start.y, segment.end.y),
        Math.max(segment.start.x, segment.end.x),
        Math.max(segment.start.y, segment.end.y),
      )
    }
    traceSegmentIndex.finish()
    return traceSegmentIndex
  }
}

function getSegmentBounds(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

function getPaddedBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  }
}
