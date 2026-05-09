import { test, expect } from "bun:test"
import { solve } from "../lib/index"

test("REPRODUCTION: should fail to merge multiple overlapping segments", () => {
  const input = [
	{
	  type: "schematic_trace",
	  schematic_trace_id: "trace_1",
	  edges: [
		{ from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },  // Segment 1
		{ from: { x: 5, y: 0 }, to: { x: 15, y: 0 } },  // Segment 2 (Overlaps 1)
		{ from: { x: 12, y: 0 }, to: { x: 20, y: 0 } }  // Segment 3 (Overlaps 2)
	  ]
	}
  ]

  const output = solve(input)
  const resultTrace = output.find(item => item.type === "schematic_trace")
  
  // LOG THE OUTPUT: This helps you see what's actually happening
  console.log("Edges found:", resultTrace.edges.length)

  // If the bug exists, this will be 3. We want it to be 1.
  expect(resultTrace.edges.length).toBe(1)
})
