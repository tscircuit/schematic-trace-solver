import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

export interface MergedTracePath extends SolvedTracePath {
  originalTracePaths: SolvedTracePath[]
  mergedSegments: MergedSegment[]
}

export interface MergedSegment {
  start: Point
  end: Point
  originalSegments: Array<{
    tracePath: SolvedTracePath
    segmentIndex: number
  }>
}

export class TraceLineMergerSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  mergedTracePaths: MergedTracePath[] = []
  maxMergeDistance: number = 0.1 // Maximum distance for merging lines

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
    maxMergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.maxMergeDistance = params.maxMergeDistance ?? 0.1
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceLineMergerSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      maxMergeDistance: this.maxMergeDistance,
    }
  }

  override _step() {
    if (this.solved) return

    // Group trace paths by net
    const netGroups = this.groupTracePathsByNet()
    
    // Process each net group
    for (const [netId, tracePaths] of netGroups) {
      const mergedPaths = this.mergeTracePathsInNet(tracePaths)
      this.mergedTracePaths.push(...mergedPaths)
    }

    this.solved = true
  }

  private groupTracePathsByNet(): Map<string, SolvedTracePath[]> {
    const netGroups = new Map<string, SolvedTracePath[]>()
    
    for (const tracePath of this.inputTracePaths) {
      const netId = tracePath.userNetId || tracePath.dcConnNetId || tracePath.globalConnNetId || "unknown"
      if (!netGroups.has(netId)) {
        netGroups.set(netId, [])
      }
      netGroups.get(netId)!.push(tracePath)
    }
    
    return netGroups
  }

  private mergeTracePathsInNet(tracePaths: SolvedTracePath[]): MergedTracePath[] {
    if (tracePaths.length <= 1) {
      return tracePaths.map(tp => ({
        ...tp,
        originalTracePaths: [tp],
        mergedSegments: this.createSegmentsFromTracePath(tp)
      }))
    }

    // Extract all line segments from trace paths
    const allSegments = this.extractSegmentsFromTracePaths(tracePaths)
    
    // Find mergeable segments
    const mergedSegments = this.findAndMergeSegments(allSegments)
    
    // If no segments were merged, return original trace paths
    if (mergedSegments.length === allSegments.length) {
      return tracePaths.map(tp => ({
        ...tp,
        originalTracePaths: [tp],
        mergedSegments: this.createSegmentsFromTracePath(tp)
      }))
    }
    
    // Create a single merged trace path from all merged segments
    return this.createSingleMergedTracePath(mergedSegments, tracePaths)
  }

  private extractSegmentsFromTracePaths(tracePaths: SolvedTracePath[]): Array<{
    tracePath: SolvedTracePath
    segmentIndex: number
    start: Point
    end: Point
  }> {
    const segments: Array<{
      tracePath: SolvedTracePath
      segmentIndex: number
      start: Point
      end: Point
    }> = []

    for (const tracePath of tracePaths) {
      const path = tracePath.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        segments.push({
          tracePath,
          segmentIndex: i,
          start: path[i],
          end: path[i + 1]
        })
      }
    }

    return segments
  }

  private findAndMergeSegments(segments: Array<{
    tracePath: SolvedTracePath
    segmentIndex: number
    start: Point
    end: Point
  }>): MergedSegment[] {
    const mergedSegments: MergedSegment[] = []
    const processed = new Set<number>()

    for (let i = 0; i < segments.length; i++) {
      if (processed.has(i)) continue

      const currentSegment = segments[i]
      const mergeableSegments = [currentSegment]
      processed.add(i)

      // Look for mergeable segments
      for (let j = i + 1; j < segments.length; j++) {
        if (processed.has(j)) continue

        const otherSegment = segments[j]
        if (this.areSegmentsMergeable(currentSegment, otherSegment)) {
          mergeableSegments.push(otherSegment)
          processed.add(j)
        }
      }

      // Create merged segment
      const mergedSegment = this.createMergedSegment(mergeableSegments)
      mergedSegments.push(mergedSegment)
    }

    return mergedSegments
  }

  private areSegmentsMergeable(
    seg1: { start: Point; end: Point },
    seg2: { start: Point; end: Point }
  ): boolean {
    // Check if segments are horizontally aligned (same Y, close X)
    if (this.areHorizontallyAligned(seg1, seg2)) {
      return this.areHorizontallyMergeable(seg1, seg2)
    }

    // Check if segments are vertically aligned (same X, close Y)
    if (this.areVerticallyAligned(seg1, seg2)) {
      return this.areVerticallyMergeable(seg1, seg2)
    }

    return false
  }

  private areHorizontallyAligned(
    seg1: { start: Point; end: Point },
    seg2: { start: Point; end: Point }
  ): boolean {
    const y1 = seg1.start.y
    const y2 = seg2.start.y
    return Math.abs(y1 - y2) < this.maxMergeDistance
  }

  private areVerticallyAligned(
    seg1: { start: Point; end: Point },
    seg2: { start: Point; end: Point }
  ): boolean {
    const x1 = seg1.start.x
    const x2 = seg2.start.x
    return Math.abs(x1 - x2) < this.maxMergeDistance
  }

  private areHorizontallyMergeable(
    seg1: { start: Point; end: Point },
    seg2: { start: Point; end: Point }
  ): boolean {
    // Check if segments overlap or are adjacent in X direction
    const seg1MinX = Math.min(seg1.start.x, seg1.end.x)
    const seg1MaxX = Math.max(seg1.start.x, seg1.end.x)
    const seg2MinX = Math.min(seg2.start.x, seg2.end.x)
    const seg2MaxX = Math.max(seg2.start.x, seg2.end.x)

    // Check for overlap
    const overlap = Math.min(seg1MaxX, seg2MaxX) - Math.max(seg1MinX, seg2MinX)
    if (overlap >= 0) {
      return true // Segments overlap
    }

    // Check the gap between segments
    const gap = Math.max(seg1MinX, seg2MinX) - Math.min(seg1MaxX, seg2MaxX)
    return gap <= this.maxMergeDistance
  }

  private areVerticallyMergeable(
    seg1: { start: Point; end: Point },
    seg2: { start: Point; end: Point }
  ): boolean {
    // Check if segments overlap or are adjacent in Y direction
    const seg1MinY = Math.min(seg1.start.y, seg1.end.y)
    const seg1MaxY = Math.max(seg1.start.y, seg1.end.y)
    const seg2MinY = Math.min(seg2.start.y, seg2.end.y)
    const seg2MaxY = Math.max(seg2.start.y, seg2.end.y)

    // Check for overlap
    const overlap = Math.min(seg1MaxY, seg2MaxY) - Math.max(seg1MinY, seg2MinY)
    if (overlap >= 0) {
      return true // Segments overlap
    }

    // Check the gap between segments
    const gap = Math.max(seg1MinY, seg2MinY) - Math.min(seg1MaxY, seg2MaxY)
    return gap <= this.maxMergeDistance
  }

  private createMergedSegment(segments: Array<{
    tracePath: SolvedTracePath
    segmentIndex: number
    start: Point
    end: Point
  }>): MergedSegment {
    if (segments.length === 1) {
      const seg = segments[0]
      return {
        start: seg.start,
        end: seg.end,
        originalSegments: [{
          tracePath: seg.tracePath,
          segmentIndex: seg.segmentIndex
        }]
      }
    }

    // Determine if segments are horizontal or vertical
    const isHorizontal = this.areHorizontallyAligned(segments[0], segments[1])
    
    if (isHorizontal) {
      // Merge horizontally aligned segments
      const allX = segments.flatMap(s => [s.start.x, s.end.x])
      const allY = segments.flatMap(s => [s.start.y, s.end.y])
      
      const minX = Math.min(...allX)
      const maxX = Math.max(...allX)
      // Use the Y coordinate from the first segment instead of averaging
      const y = segments[0].start.y
      
      return {
        start: { x: minX, y },
        end: { x: maxX, y },
        originalSegments: segments.map(s => ({
          tracePath: s.tracePath,
          segmentIndex: s.segmentIndex
        }))
      }
    } else {
      // Merge vertically aligned segments
      const allX = segments.flatMap(s => [s.start.x, s.end.x])
      const allY = segments.flatMap(s => [s.start.y, s.end.y])
      
      const minY = Math.min(...allY)
      const maxY = Math.max(...allY)
      // Use the X coordinate from the first segment instead of averaging
      const x = segments[0].start.x
      
      return {
        start: { x, y: minY },
        end: { x, y: maxY },
        originalSegments: segments.map(s => ({
          tracePath: s.tracePath,
          segmentIndex: s.segmentIndex
        }))
      }
    }
  }

  private createSingleMergedTracePath(
    mergedSegments: MergedSegment[],
    originalTracePaths: SolvedTracePath[]
  ): MergedTracePath[] {
    if (mergedSegments.length === 0) {
      return []
    }

    // Create a merged path by intelligently combining the original paths
    const tracePath = this.reconstructMergedPath(mergedSegments, originalTracePaths)
    
    // Use the first original trace path as the base
    const baseTracePath = originalTracePaths[0]
    
    return [{
      ...baseTracePath,
      tracePath,
      originalTracePaths,
      mergedSegments
    }]
  }

  private reconstructMergedPath(
    mergedSegments: MergedSegment[],
    originalTracePaths: SolvedTracePath[]
  ): Point[] {
    // For complex multi-segment paths, we need to be more careful
    // Let's start with a simple approach: combine all paths and then apply merges
    
    const allPoints: Point[] = []
    
    // Collect all points from all trace paths
    for (const tracePath of originalTracePaths) {
      allPoints.push(...tracePath.tracePath)
    }
    
    // Apply merged segments to replace overlapping/close segments
    return this.applyMergesToPoints(allPoints, mergedSegments)
  }

  private applyMergesToPoints(points: Point[], mergedSegments: MergedSegment[]): Point[] {
    // For each merged segment, find the corresponding points in the path and replace them
    let result = [...points]
    
    for (const mergedSegment of mergedSegments) {
      // Find the start and end points of the merged segment
      const start = mergedSegment.start
      const end = mergedSegment.end
      
      // Find the indices of these points in the result
      const startIndex = result.findIndex(p => this.distance(p, start) < 0.001)
      const endIndex = result.findIndex(p => this.distance(p, end) < 0.001)
      
      if (startIndex >= 0 && endIndex >= 0 && startIndex < endIndex) {
        // Replace the segment with the merged segment
        result = [
          ...result.slice(0, startIndex),
          start,
          end,
          ...result.slice(endIndex + 1)
        ]
      }
    }
    
    return this.removeDuplicateConsecutivePoints(result)
  }

  private removeDuplicateConsecutivePoints(points: Point[]): Point[] {
    if (points.length <= 1) return points
    
    const result: Point[] = [points[0]]
    
    for (let i = 1; i < points.length; i++) {
      const current = points[i]
      const previous = result[result.length - 1]
      
      if (this.distance(current, previous) > 0.001) {
        result.push(current)
      }
    }
    
    return result
  }

  private sortSegmentsForPath(segments: MergedSegment[]): MergedSegment[] {
    if (segments.length <= 1) return segments

    // Simple sorting: connect segments end-to-start
    const sorted: MergedSegment[] = []
    const remaining = [...segments]
    
    // Start with the first segment
    sorted.push(remaining.shift()!)
    
    while (remaining.length > 0) {
      const lastEnd = sorted[sorted.length - 1].end
      let bestMatchIndex = -1
      let bestDistance = Infinity
      
      for (let i = 0; i < remaining.length; i++) {
        const distance = this.distance(lastEnd, remaining[i].start)
        if (distance < bestDistance) {
          bestDistance = distance
          bestMatchIndex = i
        }
      }
      
      if (bestMatchIndex >= 0) {
        sorted.push(remaining.splice(bestMatchIndex, 1)[0])
      } else {
        // If no good match, just add the first remaining segment
        sorted.push(remaining.shift()!)
      }
    }
    
    return sorted
  }

  private createPathFromSegments(segments: MergedSegment[]): Point[] {
    if (segments.length === 0) return []
    
    const path: Point[] = [segments[0].start]
    
    for (const segment of segments) {
      path.push(segment.end)
    }
    
    return path
  }

  private createSegmentsFromTracePath(tracePath: SolvedTracePath): MergedSegment[] {
    const segments: MergedSegment[] = []
    const path = tracePath.tracePath
    
    for (let i = 0; i < path.length - 1; i++) {
      segments.push({
        start: path[i],
        end: path[i + 1],
        originalSegments: [{
          tracePath,
          segmentIndex: i
        }]
      })
    }
    
    return segments
  }

  private distance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    // Draw original trace paths in light gray
    for (const tracePath of this.inputTracePaths) {
      graphics.lines!.push({
        points: tracePath.tracePath,
        strokeColor: "lightgray",
        strokeDash: "2 2",
        strokeWidth: 1,
      })
    }

    // Draw merged trace paths in green
    for (const mergedPath of this.mergedTracePaths) {
      graphics.lines!.push({
        points: mergedPath.tracePath,
        strokeColor: "green",
        strokeWidth: 2,
      })
    }

    return graphics
  }
}
