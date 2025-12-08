import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"
import { getColorFromString } from "lib/utils/getColorFromString"

/**
 * Input parameters for SameNetTraceMergeSolver.
 */
interface SameNetTraceMergeSolverInput {
    inputProblem: InputProblem
    allTraces: SolvedTracePath[]
}

/**
 * Represents a straight line segment (horizontal or vertical) extracted from a trace.
 * Used internally for detecting and merging parallel segments on the same net.
 */
type Segment = {
    traceId: string
    netId: string
    orientation: "h" | "v"
    coord: number
    range: [number, number]
    segmentIndex: number
    points: [Point, Point]
}

/**
 * SameNetTraceMergeSolver combines trace segments that belong to the same net
 * and run parallel and close to each other. This reduces visual clutter and
 * creates cleaner schematic layouts.
 *
 * Algorithm:
 * 1. Extract all horizontal and vertical segments from all traces.
 * 2. Find mergeable pairs: same net, same orientation, close distance (≤ GAP_THRESHOLD),
 *    and overlapping ranges.
 * 3. Group mergeable segments into connected components using BFS.
 * 4. For each group, calculate the median coordinate and align all segments to it.
 * 5. Update all trace points to maintain continuity and topology.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
    private input: SameNetTraceMergeSolverInput
    private outputTraces: SolvedTracePath[]
    private mergeGroupsCache: Segment[][] | null = null
    // Algorithm constants
    private readonly GAP_THRESHOLD = 0.15 // Maximum gap to consider for merging
    private readonly EPS = 1e-6
    // Visualization constants
    private readonly TRACE_STROKE_WIDTH = 0.02
    // Highlight stroke width is derived from GAP_THRESHOLD to show the merge zone visually
    private readonly HIGHLIGHT_STROKE_WIDTH = this.GAP_THRESHOLD * 0.5
    private readonly TRACE_OPACITY = 0.9

    constructor(solverInput: SameNetTraceMergeSolverInput) {
        super()
        this.input = solverInput
        this.outputTraces = structuredClone(solverInput.allTraces)
    }

    override _step() {
        // Extract all segments from traces
        const segments = this._extractSegments()

        // Find mergeable segment pairs
        this.mergeGroupsCache = this._findMergeableGroups(segments)

        if (this.mergeGroupsCache.length === 0) {
            this.solved = true
            return
        }

        // Perform all merges in one step (idempotent)
        for (const group of this.mergeGroupsCache) {
            this._mergeSegmentGroup(group)
        }

        this.solved = true
    }

    private _extractSegments(): Segment[] {
        const segments: Segment[] = []

        for (const trace of this.outputTraces) {
            for (let i = 0; i < trace.tracePath.length - 1; i++) {
                const p1 = trace.tracePath[i]!
                const p2 = trace.tracePath[i + 1]!

                if (Math.abs(p1.x - p2.x) < this.EPS) {
                    // Vertical segment
                    const [minY, maxY] = [p1.y, p2.y].sort((a, b) => a - b)
                    segments.push({
                        traceId: trace.mspPairId,
                        netId: trace.globalConnNetId,
                        orientation: "v",
                        coord: p1.x,
                        range: [minY, maxY],
                        segmentIndex: i,
                        points: [p1, p2],
                    })
                } else if (Math.abs(p1.y - p2.y) < this.EPS) {
                    // Horizontal segment
                    const [minX, maxX] = [p1.x, p2.x].sort((a, b) => a - b)
                    segments.push({
                        traceId: trace.mspPairId,
                        netId: trace.globalConnNetId,
                        orientation: "h",
                        coord: p1.y,
                        range: [minX, maxX],
                        segmentIndex: i,
                        points: [p1, p2],
                    })
                }
            }
        }

        return segments
    }

    private _overlap1d(
        [a1, a2]: [number, number],
        [b1, b2]: [number, number],
    ): number {
        const lo = Math.max(Math.min(a1, a2), Math.min(b1, b2))
        const hi = Math.min(Math.max(a1, a2), Math.max(b1, b2))
        return Math.max(0, hi - lo)
    }

    /**
     * Finds groups of mergeable segments using connected components (BFS).
     * Segments are mergeable if they:
     * - Belong to the same net (globalConnNetId)
     * - Have the same orientation (horizontal or vertical)
     * - Are from different traces
     * - Are within GAP_THRESHOLD distance
     * - Have overlapping spatial ranges
     */
    private _findMergeableGroups(segments: Segment[]): Segment[][] {
        // Build adjacency matrix: segments that are mergeable with each other
        const mergeable: boolean[][] = []
        for (let i = 0; i < segments.length; i++) {
            mergeable[i] = []
            for (let j = 0; j < segments.length; j++) {
                mergeable[i]![j] = false
            }
        }

        for (let i = 0; i < segments.length; i++) {
            for (let j = i + 1; j < segments.length; j++) {
                const a = segments[i]!
                const b = segments[j]!

                // Must be same net
                if (a.netId !== b.netId) continue

                // Must be same orientation
                if (a.orientation !== b.orientation) continue

                // Must be different traces
                if (a.traceId === b.traceId) continue

                // Must be close enough
                const separation = Math.abs(a.coord - b.coord)
                if (separation > this.GAP_THRESHOLD) continue

                // Must overlap in their range
                const overlap = this._overlap1d(a.range, b.range)
                if (overlap <= this.EPS) continue

                // Mark as mergeable
                mergeable[i]![j] = true
                mergeable[j]![i] = true
            }
        }

        // Find connected components (groups of mutually mergeable segments) using BFS
        const visited = new Array(segments.length).fill(false)
        const groups: Segment[][] = []

        for (let i = 0; i < segments.length; i++) {
            if (visited[i]) continue

            const group: Segment[] = []
            const queue = [i]
            visited[i] = true

            while (queue.length > 0) {
                const idx = queue.shift()!
                group.push(segments[idx]!)

                for (let j = 0; j < segments.length; j++) {
                    if (!visited[j] && mergeable[idx]![j]) {
                        visited[j] = true
                        queue.push(j)
                    }
                }
            }

            if (group.length >= 2) {
                groups.push(group)
            }
        }

        return groups
    }

    /**
     * Merges all segments in a group by aligning them to their median coordinate.
     */
    private _mergeSegmentGroup(group: Segment[]) {
        if (group.length < 2) return

        // Calculate median coordinate from all segments in the group
        const coords = group.map((s) => s.coord)
        coords.sort((a, b) => a - b)
        const medianCoord = coords[Math.floor(coords.length / 2)]!

        // Update all segments to use the median coordinate
        for (const seg of group) {
            this._updateSegmentCoordinate(seg, medianCoord)
        }
    }

    /**
     * Updates a segment's coordinate and maintains continuity by updating adjacent points.
     */
    private _updateSegmentCoordinate(segment: Segment, newCoord: number) {
        const trace = this.outputTraces.find((t) => t.mspPairId === segment.traceId)
        if (!trace) return

        const idx = segment.segmentIndex
        if (idx < 0 || idx >= trace.tracePath.length - 1) return

        const p1 = trace.tracePath[idx]!
        const p2 = trace.tracePath[idx + 1]!

        if (segment.orientation === "v") {
            // Update x coordinate for vertical segment
            p1.x = newCoord
            p2.x = newCoord
        } else {
            // Update y coordinate for horizontal segment
            p1.y = newCoord
            p2.y = newCoord
        }

        // Also update adjacent segments' endpoints to maintain continuity
        if (idx > 0) {
            const prevPoint = trace.tracePath[idx - 1]!
            if (segment.orientation === "v") {
                if (Math.abs(prevPoint.x - segment.coord) < this.EPS) {
                    prevPoint.x = newCoord
                }
            } else {
                if (Math.abs(prevPoint.y - segment.coord) < this.EPS) {
                    prevPoint.y = newCoord
                }
            }
        }

        if (idx + 2 < trace.tracePath.length) {
            const nextPoint = trace.tracePath[idx + 2]!
            if (segment.orientation === "v") {
                if (Math.abs(nextPoint.x - segment.coord) < this.EPS) {
                    nextPoint.x = newCoord
                }
            } else {
                if (Math.abs(nextPoint.y - segment.coord) < this.EPS) {
                    nextPoint.y = newCoord
                }
            }
        }
    }

    getOutput() {
        return {
            traces: this.outputTraces,
        }
    }

    override visualize(): GraphicsObject {
        const graphics = visualizeInputProblem(this.input.inputProblem, {
            chipAlpha: 0.1,
            connectionAlpha: 0.1,
        })

        if (!graphics.lines) graphics.lines = []
        if (!graphics.points) graphics.points = []
        if (!graphics.texts) graphics.texts = []

        // Draw current traces, colored by net (consistent with NetLabelPlacementSolver)
        for (const trace of this.outputTraces) {
            const line: Line = {
                points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
                strokeColor: getColorFromString(
                    trace.globalConnNetId,
                    this.TRACE_OPACITY,
                ),
                strokeWidth: this.TRACE_STROKE_WIDTH,
            }
            graphics.lines!.push(line)
        }

        // Highlight mergeable segments in red to show which segments will be merged.
        // The stroke width is derived from GAP_THRESHOLD to visually represent the
        // merge zone: if two segments are within this distance, they'll be merged.
        // This helps with debugging: you can see exactly what the algorithm considers mergeable.
        // Use cached merge groups from the solve step if available to avoid redundant computation
        const mergeGroups = this.mergeGroupsCache ?? []

        for (const group of mergeGroups) {
            for (const seg of group) {
                graphics.lines!.push({
                    points: [seg.points[0], seg.points[1]],
                    strokeColor: "red",
                    strokeWidth: this.HIGHLIGHT_STROKE_WIDTH,
                })
            }
        }

        return graphics
    }
}
