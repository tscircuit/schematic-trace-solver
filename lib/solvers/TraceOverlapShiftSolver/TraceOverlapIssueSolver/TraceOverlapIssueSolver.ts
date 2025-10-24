import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { applyJogToTerminalSegment } from "./applyJogToTrace"

type ConnNetId = string
type Point = { x: number; y: number }

// Configuration for the trace overlap solver
interface TraceOffsetConfig {
  maxBruteForceSize: number  // Maximum number of traces to use brute force approach
  shiftDistance: number      // How far to shift traces to avoid overlap
  strategy: 'brute-force' | 'greedy'  // Which algorithm to use
}

// Represents a single solution's offsets and how good it is
interface OffsetAssignment {
  offsets: number[]  // How much to shift each trace
  score: number      // Lower is better (crossings * 1000 + total_offset)
}

export interface OverlappingTraceSegmentLocator {
  connNetId: string
  pathsWithOverlap: Array<{
    solvedTracePathIndex: number
    traceSegmentIndex: number
  }>
}

export class TraceOverlapIssueSolver extends BaseSolver {
  overlappingTraceSegments: OverlappingTraceSegmentLocator[]
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>

  // How far to shift traces when avoiding overlaps
  SHIFT_DISTANCE = 0.1
  // Small number for floating point comparisons
  EPS = 1e-6

  // Keeps track of traces we've fixed
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}

  constructor(params: {
    overlappingTraceSegments: OverlappingTraceSegmentLocator[]
    traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>
  }) {
    super()
    this.overlappingTraceSegments = params.overlappingTraceSegments
    this.traceNetIslands = params.traceNetIslands

    // Only add the relevant traces to the correctedTraceMap
    for (const { connNetId, pathsWithOverlap } of this
      .overlappingTraceSegments) {
      for (const {
        solvedTracePathIndex,
        traceSegmentIndex,
      } of pathsWithOverlap) {
        const mspPairId =
          this.traceNetIslands[connNetId][solvedTracePathIndex].mspPairId
        this.correctedTraceMap[mspPairId] =
          this.traceNetIslands[connNetId][solvedTracePathIndex]
      }
    }
  }

  // Try every possible combination of offsets to find the absolute best
  private findBestOffsetsBruteForce(shiftDistance: number): OffsetAssignment {
    const n = this.overlappingTraceSegments.length
    let bestScore = Infinity
    let bestOffsets: number[] = []

    // Helper to try all combinations recursively
    const tryAllCombinations = (current: number[], depth: number) => {
      if (depth === n) {
        // We have a complete assignment - see how good it is
        const score = this.evaluateOffsetAssignment(current)
        if (score < bestScore) {
          bestScore = score
          bestOffsets = [...current]
        }
        return
      }

      // For each trace, try shifting it up, down, or leaving it
      for (const mult of [-1, 0, 1]) {
        current[depth] = mult * shiftDistance
        tryAllCombinations(current, depth + 1)
      }
    }

    // Start with all traces unshifted
    tryAllCombinations(new Array(n).fill(0), 0)
    return { offsets: bestOffsets, score: bestScore }
  }

  // Faster approach for many traces - handle one at a time
  private findOffsetsGreedy(shiftDistance: number): number[] {
    const n = this.overlappingTraceSegments.length
    const offsets = new Array(n).fill(0)
    
    // Handle each trace one by one
    for (let i = 0; i < n; i++) {
      let bestScore = Infinity
      let bestOffset = 0
      
      // Try each possible offset for this trace
      for (const mult of [-1, 0, 1]) {
        offsets[i] = mult * shiftDistance
        const score = this.evaluateOffsetAssignment(offsets)
        if (score < bestScore) {
          bestScore = score
          bestOffset = offsets[i]
        }
      }
      
      // Keep the best offset we found for this trace
      offsets[i] = bestOffset
    }
    
    return offsets
  }

  // Calculate how good a particular assignment of offsets is
  private evaluateOffsetAssignment(offsets: number[]): number {
    let crossings = 0
    let totalOffset = 0

    // Apply these offsets temporarily to count crossings
    const simulatedPaths = new Map<string, Point[]>()
    
    this.overlappingTraceSegments.forEach((group, idx) => {
      const offset = offsets[idx]!
      totalOffset += Math.abs(offset)
      
      // Simulate moving each trace by its offset
      group.pathsWithOverlap.forEach(({solvedTracePathIndex, traceSegmentIndex}) => {
        const original = this.traceNetIslands[group.connNetId][solvedTracePathIndex]!
        const path = original.tracePath.map(p => ({...p}))
        
        // Move the overlapping segment
        const start = path[traceSegmentIndex]!
        const end = path[traceSegmentIndex + 1]!
        
        if (Math.abs(start.x - end.x) < this.EPS) {
          // Vertical segment - shift horizontally
          start.x += offset
          end.x += offset
        } else {
          // Horizontal segment - shift vertically
          start.y += offset
          end.y += offset
        }
        
        simulatedPaths.set(`${group.connNetId}-${solvedTracePathIndex}`, path)
      })
    })

    // Count how many times traces cross each other
    const paths = Array.from(simulatedPaths.values())
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        crossings += this.countIntersections(paths[i], paths[j])
      }
    }

    // Score = (crossings * 1000) + total_offset
    // This heavily penalizes crossings while still preferring smaller offsets
    return crossings * 1000 + totalOffset
  }

  // Count how many times two traces intersect
  private countIntersections(path1: Point[], path2: Point[]): number {
    let count = 0
    // Check each segment in path1 against each in path2
    for (let i = 0; i < path1.length - 1; i++) {
      const a1 = path1[i]!
      const a2 = path1[i + 1]!
      for (let j = 0; j < path2.length - 1; j++) {
        const b1 = path2[j]!
        const b2 = path2[j + 1]!
        if (this.segmentsIntersect(a1, a2, b1, b2)) {
          count++
        }
      }
    }
    return count
  }

  // Do two line segments intersect?
  private segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    // Quick check for parallel segments (they can't cross)
    if (Math.abs(a1.x - a2.x) < this.EPS && Math.abs(b1.x - b2.x) < this.EPS) {
      return false  // Both vertical
    }
    if (Math.abs(a1.y - a2.y) < this.EPS && Math.abs(b1.y - b2.y) < this.EPS) {
      return false  // Both horizontal
    }

    // Check if their bounding boxes overlap
    const ax1 = Math.min(a1.x, a2.x), ax2 = Math.max(a1.x, a2.x)
    const ay1 = Math.min(a1.y, a2.y), ay2 = Math.max(a1.y, a2.y)
    const bx1 = Math.min(b1.x, b2.x), bx2 = Math.max(b1.x, b2.x)
    const by1 = Math.min(b1.y, b2.y), by2 = Math.max(b1.y, b2.y)

    return !(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1)
  }

  override _step() {
    // Our configuration - we can make this adjustable later
    const config: TraceOffsetConfig = {
      maxBruteForceSize: 10,    // Try all combinations for up to 10 traces
      shiftDistance: this.SHIFT_DISTANCE,
      strategy: 'brute-force'    // Start with brute force, fall back to greedy
    }

    // Choose which algorithm to use based on problem size
    let offsets: number[]
    if (this.overlappingTraceSegments.length <= config.maxBruteForceSize) {
      // Small enough for brute force - try all combinations
      const bestAssignment = this.findBestOffsetsBruteForce(config.shiftDistance)
      offsets = bestAssignment.offsets
    } else {
      // Too many traces - use faster greedy approach
      offsets = this.findOffsetsGreedy(config.shiftDistance)
    }

    const eq = (a: number, b: number) => Math.abs(a - b) < this.EPS
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined,
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y)

    // For each net island group, shift only its overlapping segments and adjust adjacent joints
    this.overlappingTraceSegments.forEach((group, gidx) => {
      const offset = offsets[gidx]!

      // Gather unique segment indices per path
      const byPath: Map<number, Set<number>> = new Map()
      for (const loc of group.pathsWithOverlap) {
        if (!byPath.has(loc.solvedTracePathIndex)) {
          byPath.set(loc.solvedTracePathIndex, new Set())
        }
        byPath.get(loc.solvedTracePathIndex)!.add(loc.traceSegmentIndex)
      }

      for (const [pathIdx, segIdxSet] of byPath) {
        const original = this.traceNetIslands[group.connNetId][pathIdx]!
        const current = this.correctedTraceMap[original.mspPairId] ?? original
        const pts = current.tracePath.map((p) => ({ ...p }))

        const segIdxs = Array.from(segIdxSet).sort((a, b) => a - b)

        const segIdxsRev = Array.from(segIdxSet)
          .sort((a, b) => a - b)
          .reverse()

        const JOG_SIZE = this.SHIFT_DISTANCE

        // Process from end to start to keep indices valid after splicing
        for (const si of segIdxsRev) {
          if (si < 0 || si >= pts.length - 1) continue

          if (si === 0 || si === pts.length - 2) {
            applyJogToTerminalSegment({
              pts,
              segmentIndex: si,
              offset,
              JOG_SIZE,
              EPS: this.EPS,
            })
          } else {
            // Internal segment - shift both points
            const start = pts[si]!
            const end = pts[si + 1]!
            const isVertical = Math.abs(start.x - end.x) < this.EPS
            const isHorizontal = Math.abs(start.y - end.y) < this.EPS
            if (!isVertical && !isHorizontal) continue

            if (isVertical) {
              start.x += offset
              end.x += offset
            } else {
              // Horizontal
              start.y += offset
              end.y += offset
            }
          }
        }

        // Remove consecutive duplicate points that might appear after shifts
        const cleaned: typeof pts = []
        for (const p of pts) {
          if (
            cleaned.length === 0 ||
            !samePoint(cleaned[cleaned.length - 1], p)
          ) {
            cleaned.push(p)
          }
        }

        this.correctedTraceMap[original.mspPairId] = {
          ...current,
          tracePath: cleaned,
        }
      }
    })

    this.solved = true
  }

  override visualize(): GraphicsObject {
    // Visualize overlapped segments and proposed corrections
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    }

    // Draw overlapped segments in red
    for (const group of this.overlappingTraceSegments) {
      for (const {
        solvedTracePathIndex,
        traceSegmentIndex,
      } of group.pathsWithOverlap) {
        const path =
          this.traceNetIslands[group.connNetId][solvedTracePathIndex]!
        const segStart = path.tracePath[traceSegmentIndex]!
        const segEnd = path.tracePath[traceSegmentIndex + 1]!
        graphics.lines!.push({
          points: [segStart, segEnd],
          strokeColor: "red",
        })
      }
    }

    // Draw corrected traces (post-shift) in blue dashed
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
        strokeDash: "4 2",
      })
    }

    return graphics
  }
}
