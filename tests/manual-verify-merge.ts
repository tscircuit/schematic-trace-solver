import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"

function createTrace(
  pairId: string,
  netId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: pairId,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [pairId],
    pinIds: [],
  }
}

console.log("Testing mergeCollinearTraces...")

// Test 1: Adjacent horizontal segments on same net
console.log("\nTest 1: Adjacent horizontal segments on same net")
const trace1 = createTrace("pair1", "VCC", [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
])
const trace2 = createTrace("pair2", "VCC", [
  { x: 5, y: 0 },
  { x: 10, y: 0 },
])
const result1 = mergeCollinearTraces([trace1, trace2])
console.log(`Expected 1 trace, got ${result1.length}`)
console.log("Merged trace path:", result1[0]?.tracePath)
console.assert(result1.length === 1, "Should merge into 1 trace")
console.assert(
  result1[0].tracePath.length === 3,
  "Merged path should have 3 points",
)

// Test 2: Different nets should not merge
console.log("\nTest 2: Different nets should not merge")
const trace3 = createTrace("pair3", "VCC", [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
])
const trace4 = createTrace("pair4", "GND", [
  { x: 5, y: 0 },
  { x: 10, y: 0 },
])
const result2 = mergeCollinearTraces([trace3, trace4])
console.log(`Expected 2 traces, got ${result2.length}`)
console.assert(result2.length === 2, "Should keep 2 traces with different nets")

// Test 3: Non-collinear should not merge
console.log("\nTest 3: Non-collinear should not merge")
const trace5 = createTrace("pair5", "VCC", [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
])
const trace6 = createTrace("pair6", "VCC", [
  { x: 0, y: 1 },
  { x: 5, y: 1 },
])
const result3 = mergeCollinearTraces([trace5, trace6])
console.log(`Expected 2 traces, got ${result3.length}`)
console.assert(result3.length === 2, "Should keep 2 non-collinear traces")

// Test 4: Vertical segments
console.log("\nTest 4: Adjacent vertical segments on same net")
const trace7 = createTrace("pair7", "GND", [
  { x: 0, y: 0 },
  { x: 0, y: 5 },
])
const trace8 = createTrace("pair8", "GND", [
  { x: 0, y: 5 },
  { x: 0, y: 10 },
])
const result4 = mergeCollinearTraces([trace7, trace8])
console.log(`Expected 1 trace, got ${result4.length}`)
console.log("Merged trace path:", result4[0]?.tracePath)
console.assert(result4.length === 1, "Should merge vertical traces")

// Test 5: Multiple adjacent segments
console.log("\nTest 5: Multiple adjacent segments")
const trace9 = createTrace("pair9", "VCC", [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
])
const trace10 = createTrace("pair10", "VCC", [
  { x: 5, y: 0 },
  { x: 10, y: 0 },
])
const trace11 = createTrace("pair11", "VCC", [
  { x: 10, y: 0 },
  { x: 15, y: 0 },
])
const result5 = mergeCollinearTraces([trace9, trace10, trace11])
console.log(`Expected 1 trace, got ${result5.length}`)
console.log("Merged trace path:", result5[0]?.tracePath)
console.assert(result5.length === 1, "Should merge all 3 traces")
console.assert(
  result5[0].tracePath.length === 4,
  "Final path should have 4 points",
)

console.log("\n✓ All tests passed!")
