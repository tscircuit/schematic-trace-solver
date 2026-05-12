import { BaseSolver } from "../BaseSolver/BaseSolver"
import type {
  SolvedTracePath,
} from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

const COORD_PRECISION = 4

const pointKey = (point: { x: number; y: number }) =>
  `${point.x.toFixed(COORD_PRECISION)},${point.y.toFixed(COORD_PRECISION)}`

/**
 * Create a direction-independent segment key by sorting the two endpoints.
 * This ensures A→B and B→A produce the same key.
 */
const segmentKey = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) => {
  const endpoints = [pointKey(p1), pointKey(p2)].sort()
  return `${endpoints[0]}|${endpoints[1]}`
}

/**
 * Get all segments from a trace path as an array of keys.
 */
const getTraceSegmentKeys = (trace: SolvedTracePath) => {
  const segments: string[] = []
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    segments.push(
      segmentKey(trace.tracePath[i]!, trace.tracePath[i + 1]!),
    )
  }
  return segments
}

/**
 * Get the net identifier for a trace (prefer global, fall back to dc).
 */
const getTraceNetId = (trace: SolvedTracePath): string =>
  trace.globalConnNetId || trace.dcConnNetId || ""

interface DedupResult {
  traces: SolvedTracePath[]
  /** Number of duplicate segments removed */
  removedSegments: number
}

/**
 * Remove duplicate segments from traces sharing the same net.
 *
 * Strategy: Process traces in order. For each trace, mark segments that
 * have already been claimed by an earlier trace on the same net as
 * "duplicate". If duplicate segments form contiguous edges at the start
 * or end of the trace, trim them. If duplicates are in the middle,
 * keep the full trace (splitting would require re-routing).
 */
export function dedupSameNetTraceSegments(
  traces: SolvedTracePath[],
): DedupResult {
  const seenByNet = new Map<string, Set<string>>()
  const output: SolvedTracePath[] = []
  let removedSegments = 0

  for (const trace of traces) {
    const netId = getTraceNetId(trace)
    const seenSegments = seenByNet.get(netId) ?? new Set<string>()
    seenByNet.set(netId, seenSegments)

    const segmentKeys = getTraceSegmentKeys(trace)
    const isDuplicate = segmentKeys.map((key) => seenSegments.has(key))

    // Check if duplicates are contiguous at start/end
    const firstNonDup = isDuplicate.findIndex((d) => !d)
    const lastNonDup = isDuplicate.findLastIndex((d) => !d)

    // Preserve traces with no segments (single-point traces)
    if (segmentKeys.length === 0) {
      output.push(trace)
      continue
    }

    if (firstNonDup === -1) {
      // Entire trace is duplicate — skip it
      removedSegments += segmentKeys.length
      for (const key of segmentKeys) seenSegments.add(key)
      continue
    }

    // Trim leading duplicate segments
    let startIndex = 0
    if (firstNonDup > 0) {
      startIndex = firstNonDup
    }

    // Trim trailing duplicate segments
    let endIndex = segmentKeys.length // exclusive
    if (lastNonDup < segmentKeys.length - 1) {
      endIndex = lastNonDup + 1
    }

    // If duplicates only at edges, we can safely trim
    if (
      (firstNonDup > 0 || lastNonDup < segmentKeys.length - 1) &&
      // Make sure there are no interior duplicates (only edge duplicates)
      isDuplicate.slice(startIndex, endIndex).every((d) => !d)
    ) {
      const trimmedPath = trace.tracePath.slice(startIndex, endIndex + 1)
      removedSegments += segmentKeys.length - (endIndex - startIndex)
      for (const key of segmentKeys) seenSegments.add(key)
      output.push({ ...trace, tracePath: trimmedPath })
    } else {
      // Interior duplicates exist — keep full trace but mark segments as seen
      // so we don't trim future traces' interior segments as "edge" segments
      for (const key of segmentKeys) seenSegments.add(key)
      output.push(trace)
    }
  }

  return { traces: output, removedSegments }
}

interface SameNetTraceSegmentDedupSolverInput {
  inputProblem: import("../../types/InputProblem").InputProblem
  traces: SolvedTracePath[]
}

export class SameNetTraceSegmentDedupSolver extends BaseSolver {
  input: SameNetTraceSegmentDedupSolverInput
  result: DedupResult

  constructor(input: SameNetTraceSegmentDedupSolverInput) {
    super()
    this.input = input
    this.result = dedupSameNetTraceSegments(input.traces)
    this.solved = true
  }

  getOutput(): DedupResult {
    return this.result
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.result.traces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
