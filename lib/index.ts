import { SchematicTracePipelineSolver } from "./solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { InputProblem } from "./types/InputProblem"
import { SchematicTraceSingleLineSolver2 } from "./solvers/SchematicTraceSingleLineSolver2"

export type TraceSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  net: string
}

/**
 * Main solve function for the schematic trace solver.
 */
export function solve(input: any[]): any[] {
  // 1. Clone the input to avoid mutating original data
  const output = JSON.parse(JSON.stringify(input))

  // 2. Identify and merge segments within each schematic_trace
  for (const item of output) {
    if (item.type === "schematic_trace" && item.edges) {
      // Map edges to TraceSegment format for merging
      const segments: TraceSegment[] = item.edges.map((edge: any) => ({
        x1: edge.from.x,
        y1: edge.from.y,
        x2: edge.to.x,
        y2: edge.to.y,
        net: item.schematic_trace_id // Using ID as the net grouping
      }))

      const mergedSegments = mergeCollinearSegments(segments)

      // Map merged segments back to the required 'edges' format
      item.edges = mergedSegments.map(s => ({
        from: { x: s.x1, y: s.y1 },
        to: { x: s.x2, y: s.y2 }
      }))
    }
  }

  return output
}

/**
 * Helper function to merge overlapping or touching segments on the same X or Y axis.
 */
function mergeCollinearSegments(segments: TraceSegment[]): TraceSegment[] {
  if (segments.length <= 1) return segments

  const merged: TraceSegment[] = []
  
  // Process Horizontal (y1 === y2)
  const horizontal = segments.filter(s => s.y1 === s.y2)
  const hGroups: Record<number, TraceSegment[]> = {}
  horizontal.forEach(s => {
    hGroups[s.y1] = hGroups[s.y1] || []
    hGroups[s.y1].push(s)
  })

  for (const y in hGroups) {
    const sorted = hGroups[y].sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2))
    let current = { ...sorted[0] }
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      const curMaxX = Math.max(current.x1, current.x2)
      const nextMinX = Math.min(next.x1, next.x2)
      
      if (nextMinX <= curMaxX) {
        current.x2 = Math.max(curMaxX, next.x2)
        current.x1 = Math.min(current.x1, next.x1)
      } else {
        merged.push(current)
        current = { ...next }
      }
    }
    merged.push(current)
  }

  // Process Vertical (x1 === x2)
  const vertical = segments.filter(s => s.x1 === s.x2)
  const vGroups: Record<number, TraceSegment[]> = {}
  vertical.forEach(s => {
    vGroups[s.x1] = vGroups[s.x1] || []
    vGroups[s.x1].push(s)
  })

  for (const x in vGroups) {
    const sorted = vGroups[x].sort((a, b) => Math.min(a.y1, a.y2) - Math.min(b.y1, b.y2))
    let current = { ...sorted[0] }
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      const curMaxY = Math.max(current.y1, current.y2)
      const nextMinY = Math.min(next.y1, next.y2)
      
      if (nextMinY <= curMaxY) {
        current.y2 = Math.max(curMaxY, next.y2)
        current.y1 = Math.min(current.y1, next.y1)
      } else {
        merged.push(current)
        current = { ...next }
      }
    }
    merged.push(current)
  }

  // Add any segments that weren't horizontal or vertical (diagonal)
  const diagonal = segments.filter(s => s.x1 !== s.x2 && s.y1 !== s.y2)
  merged.push(...diagonal)

  return merged
}