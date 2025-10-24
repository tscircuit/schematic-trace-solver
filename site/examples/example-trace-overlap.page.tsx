import React from "react"
import { TraceOverlapIssueSolver } from "../../lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/TraceOverlapIssueSolver"
import type { SolvedTracePath } from "../../lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

// Create a proper SolvedTracePath object with all required fields
const testProblem = {
  overlappingTraceSegments: [
    {
      connNetId: "net1",
      pathsWithOverlap: [
        { solvedTracePathIndex: 0, traceSegmentIndex: 1 },
        { solvedTracePathIndex: 1, traceSegmentIndex: 1 }
      ]
    },
    {
      connNetId: "net2",
      pathsWithOverlap: [
        { solvedTracePathIndex: 0, traceSegmentIndex: 1 },
        { solvedTracePathIndex: 1, traceSegmentIndex: 1 }
      ]
    }
  ],
  traceNetIslands: {
    "net1": [
      {
        tracePath: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 50 }
        ],
        mspConnectionPairIds: ["pair1"],
        mspPairId: "pair1",
        netId: "net1",
        pinIds: ["pin1", "pin2"],
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { x: 0, y: 0, id: "pin1" },
          { x: 50, y: 50, id: "pin2" }
        ]
      },
      {
        tracePath: [
          { x: 0, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 60 }
        ],
        mspConnectionPairIds: ["pair2"],
        mspPairId: "pair2",
        netId: "net1",
        pinIds: ["pin3", "pin4"],
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { x: 0, y: 10, id: "pin3" },
          { x: 50, y: 60, id: "pin4" }
        ]
      }
    ],
    "net2": [
      {
        tracePath: [
          { x: 0, y: 20 },
          { x: 50, y: 20 },
          { x: 50, y: 70 }
        ],
        mspConnectionPairIds: ["pair3"],
        mspPairId: "pair3",
        netId: "net2",
        pinIds: ["pin5", "pin6"],
        dcConnNetId: "net2",
        globalConnNetId: "net2",
        pins: [
          { x: 0, y: 20, id: "pin5" },
          { x: 50, y: 70, id: "pin6" }
        ]
      },
      {
        tracePath: [
          { x: 0, y: 30 },
          { x: 50, y: 30 },
          { x: 50, y: 80 }
        ],
        mspConnectionPairIds: ["pair4"],
        mspPairId: "pair4",
        netId: "net2",
        pinIds: ["pin7", "pin8"],
        dcConnNetId: "net2",
        globalConnNetId: "net2",
        pins: [
          { x: 0, y: 30, id: "pin7" },
          { x: 50, y: 80, id: "pin8" }
        ]
      }
    ]
  }
}

export default function TraceOverlapTest() {
  // Create solver instance with proper typing
  const solver = new TraceOverlapIssueSolver({
    overlappingTraceSegments: testProblem.overlappingTraceSegments,
    traceNetIslands: testProblem.traceNetIslands
  })
  
  // Solve the problem
  solver._step()

  // Get visualization
  const graphics = solver.visualize()

  // Debug info
  console.log('Solver state:', {
    segments: solver.overlappingTraceSegments,
    islands: solver.traceNetIslands,
    corrected: solver.correctedTraceMap
  })

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Trace Overlap Test</h1>
      <div className="border p-4">
        <svg width="400" height="400" viewBox="-10 -10 120 120">
          {/* Draw original traces in light gray */}
          {Object.values(testProblem.traceNetIslands).flat().map((trace, i) => (
            <polyline
              key={`orig-${i}`}
              points={trace.tracePath.map(p => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#ccc"
              strokeWidth="1"
            />
          ))}
          
          {/* Draw overlapping segments in red */}
          {graphics.lines?.filter(l => l.strokeColor === "red").map((line, i) => (
            <line
              key={`overlap-${i}`}
              x1={line.points[0].x}
              y1={line.points[0].y}
              x2={line.points[1].x}
              y2={line.points[1].y}
              stroke="red"
              strokeWidth="2"
            />
          ))}
          
          {/* Draw corrected traces in blue */}
          {graphics.lines?.filter(l => l.strokeColor === "blue").map((line, i) => (
            <polyline
              key={`fixed-${i}`}
              points={line.points.map(p => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="blue"
              strokeDasharray="4 2"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
      
      <div className="mt-4">
        <h2 className="text-xl mb-2">Legend:</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0 border border-gray-400"></div>
            <span>Original traces</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0 border-2 border-red-500"></div>
            <span>Overlapping segments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0 border border-blue-500 border-dashed"></div>
            <span>Optimized traces</span>
          </div>
        </div>
      </div>
    </div>
  )
}