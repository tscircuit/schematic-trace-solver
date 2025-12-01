import React from "react";
import { TraceCleanupSolver } from "../../lib/solvers/TraceCleanupSolver/TraceCleanupSolver";

// Input di esempio – valido e identico alla struttura attesa dal solver
const demoInput = {
  chips: [],
  labels: [],
  allTraces: [
    {
      id: "trace-demo",
      mspPairId: "demo",
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }, // ← tratto lineare ridondante (verrà pulito)
        { x: 20, y: 10 },
        { x: 20, y: 20 },
      ],
    },
  ],
};

export default function TraceCleanupDemo() {
  console.log(">>> TraceCleanupDemo PAGE LOADED <<<");

  // esegui il solver
  const solver = new TraceCleanupSolver(demoInput);
  const result = solver.solve();

  return (
    <div style={{ padding: 20 }}>
      <h2>Trace Cleanup Demo</h2>

      <h3>Input</h3>
      <pre>{JSON.stringify(demoInput, null, 2)}</pre>

      <h3>Output (solver.solve())</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
