import React, { useEffect, useRef, useState } from "react";
import { TraceCleanupSolver } from "../lib/solvers/TraceCleanupSolver/TraceCleanupSolver";
import demoInput from "./demoInput/traceCleanupInput.json";

export default {
  name: "TraceCleanupDemo",
  Render() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [solver, setSolver] = useState<any>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
      const s = new TraceCleanupSolver({
        inputProblem: demoInput.inputProblem as any,
        allTraces: demoInput.allTraces as any,
        allLabelPlacements: demoInput.allLabelPlacements,
        mergedLabelNetIdMap: demoInput.mergedLabelNetIdMap || {},
        paddingBuffer: 5,
      });
      setSolver(s);
    }, []);

    useEffect(() => {
      if (!solver) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const g = solver.visualize();

      if (g.lines) {
        for (const line of g.lines) {
          ctx.beginPath();
          ctx.lineWidth = 3;
          ctx.strokeStyle = line.strokeColor || "black";

          const pts = line.points;
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      }
    }, [solver, tick]);

    const step = () => {
      if (!solver) return;
      solver.step();
      setTick((t) => t + 1);
    };

    const reset = () => {
      const s = new TraceCleanupSolver({
        inputProblem: demoInput.inputProblem as any,
        allTraces: demoInput.allTraces as any,
        allLabelPlacements: demoInput.allLabelPlacements,
        mergedLabelNetIdMap: demoInput.mergedLabelNetIdMap || {},
        paddingBuffer: 5,
      });
      setSolver(s);
      setTick((t) => t + 1);
    };

    return (
      <div style={{ padding: 20 }}>
        <h2>Trace Cleanup Demo</h2>

        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{ border: "1px solid #999", background: "white" }}
        />

        <div style={{ marginTop: 20 }}>
          <button onClick={step} style={{ marginRight: 10 }}>
            ▶ Step
          </button>
          <button onClick={reset}>🔄 Reset</button>
        </div>
      </div>
    );
  },
};
