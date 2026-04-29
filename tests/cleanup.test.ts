import { SchematicTracePipelineSolver } from "../lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

/**
 * Test to prove that mergeCollinearSegments correctly collapses 3 collinear points into 2.
 */
function testCleanupLogic() {
  const mockProblem: any = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const solver = new SchematicTracePipelineSolver(mockProblem)

  // Test Case 1: Three points on a horizontal line (Y=10)
  const collinearPoints = [
    {
      x: 10,
      y: 10,
    },
    {
      x: 20,
      y: 10,
    }, // Intermediate point should be removed
    {
      x: 30,
      y: 10,
    },
  ]

  // @ts-ignore - accessing private method for testing
  const cleaned = solver.mergeCollinearSegments(collinearPoints)

  console.log("Cleanup Test Result:", cleaned)

  const isValid =
    cleaned.length === 2 && cleaned[0].x === 10 && cleaned[1].x === 30

  if (isValid) {
    console.info("✅ SUCCESS: 3 points merged into 2 successfully.")
  } else {
    console.error("❌ FAILURE: Cleanup logic did not merge points correctly.")
  }
}

testCleanupLogic()
