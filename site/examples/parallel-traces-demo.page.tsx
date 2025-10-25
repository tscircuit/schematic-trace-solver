import React from "react"
import { TraceOverlapIssueSolver } from "../../lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/TraceOverlapIssueSolver"

const DEMO_PROBLEM = {
  overlappingTraceSegments: [
    {
      connNetId: "net1",
      pathsWithOverlap: [
        { solvedTracePathIndex: 0, traceSegmentIndex: 1 },
        { solvedTracePathIndex: 1, traceSegmentIndex: 1 },
        { solvedTracePathIndex: 2, traceSegmentIndex: 1 },
        { solvedTracePathIndex: 3, traceSegmentIndex: 1 },
      ],
    },
  ],
  traceNetIslands: {
    net1: [
      // First trace (matches pin 3 in screenshot)
      {
        tracePath: [
          { x: 10, y: 10 }, // Left connection
          { x: 50, y: 10 }, // Vertical segment start
          { x: 50, y: 100 }, // Vertical segment end
        ],
        mspConnectionPairIds: ["pair1"],
        mspPairId: "pair1",
        netId: "net1",
        pinIds: ["pin1", "pin2"],
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { x: 10, y: 10, pinId: "pin1", chipId: "chip1" },
          { x: 50, y: 100, pinId: "pin2", chipId: "chip2" },
        ] as [any, any],
      },
      // Second trace (matches pin 4)
      {
        tracePath: [
          { x: 10, y: 20 },
          { x: 50, y: 20 },
          { x: 50, y: 120 },
        ],
        mspConnectionPairIds: ["pair2"],
        mspPairId: "pair2",
        netId: "net1",
        pinIds: ["pin3", "pin4"],
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { x: 10, y: 20, pinId: "pin3", chipId: "chip1" },
          { x: 50, y: 120, pinId: "pin4", chipId: "chip2" },
        ] as [any, any],
      },
      // Third trace (matches pin 5)
      {
        tracePath: [
          { x: 10, y: 30 },
          { x: 50, y: 30 },
          { x: 50, y: 140 },
        ],
        mspConnectionPairIds: ["pair3"],
        mspPairId: "pair3",
        netId: "net1",
        pinIds: ["pin5", "pin6"],
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { x: 10, y: 30, pinId: "pin5", chipId: "chip1" },
          { x: 50, y: 140, pinId: "pin6", chipId: "chip2" },
        ] as [any, any],
      },
      // Fourth trace (matches pin 6)
      {
        tracePath: [
          { x: 10, y: 40 },
          { x: 50, y: 40 },
          { x: 50, y: 160 },
        ],
        mspConnectionPairIds: ["pair4"],
        mspPairId: "pair4",
        netId: "net1",
        pinIds: ["pin7", "pin8"],
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { x: 10, y: 40, pinId: "pin7", chipId: "chip1" },
          { x: 50, y: 160, pinId: "pin8", chipId: "chip2" },
        ] as [any, any],
      },
    ],
  },
}

export default function ParallelTracesDemo() {
  // Create and run solver
  const solver = new TraceOverlapIssueSolver(DEMO_PROBLEM)
  solver._step()
  const graphics = solver.visualize()

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Parallel Traces Optimization Demo</h1>
      <div className="border p-4 bg-white">
        <svg width="400" height="400" viewBox="0 -10 200 200">
          {/* Draw original traces in light gray */}
          {graphics.lines!
            .filter((l) => l.strokeColor === "#cccccc")
            .map((line, i) => (
              <polyline
                key={`orig-${i}`}
                points={line.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={line.strokeColor}
                strokeWidth="1"
              />
            ))}

          {/* Draw optimized traces in blue */}
          {graphics.lines!
            .filter((l) => l.strokeColor === "blue")
            .map((line, i) => (
              <polyline
                key={`opt-${i}`}
                points={line.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={line.strokeColor}
                strokeWidth="1"
                strokeDasharray={typeof line.strokeDash === 'string' ? line.strokeDash : undefined}
              />
            ))}
        </svg>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        Original traces shown in gray, optimized traces in blue dashed lines.
        Notice how the parallel segments are offset to minimize crossings.
      </div>
    </div>
  )
}
