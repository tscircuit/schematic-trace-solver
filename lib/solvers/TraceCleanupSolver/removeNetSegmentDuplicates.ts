/**
 * Removes duplicate trace segments from the same net.
 * When multiple MSP pairs in the same net are routed independently,
 * they can share physical segments near common pin endpoints,
 * creating visible duplicate trace lines in the schematic (#78).
 */
import type { SolvedTracePath } from "../../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export const removeNetSegmentDuplicates = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const netGroups = new Map<string, SolvedTracePath[]>()
  
  for (const trace of traces) {
    const netId = trace.dcConnNetId || trace.globalConnNetId
    if (!netGroups.has(netId)) netGroups.set(netId, [])
    netGroups.get(netId)!.push(trace)
  }
  
  const result: SolvedTracePath[] = []
  
  for (const [, netTraces] of netGroups) {
    if (netTraces.length === 1) {
      result.push(...netTraces)
      continue
    }
    
    // For multiple traces in same net, keep only unique paths
    const seen = new Set<string>()
    for (const trace of netTraces) {
      const key = trace.tracePath.map(p => `${p.x},${p.y}`).join('|')
      if (!seen.has(key)) {
        seen.add(key)
        result.push(trace)
      }
    }
  }
  
  return result
}
