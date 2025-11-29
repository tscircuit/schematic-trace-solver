import { createCanvas } from "canvas";
import GIFEncoder from "gifencoder";
import fs from "fs";
import path from "path";

// Importa il solver dal repo
import { TraceCleanupSolver } from "../lib/solvers/TraceCleanupSolver/TraceCleanupSolver.js";
import demoInput from "../site/demoInput/demo1.json" assert { type: "json" };

// Percorso output
const OUTPUT = path.join(process.cwd(), "cleanup_demo.gif");

// Config frame
const WIDTH = 800;
const HEIGHT = 600;

// Setup GIF encoder
const encoder = new GIFEncoder(WIDTH, HEIGHT);
encoder.createReadStream().pipe(fs.createWriteStream(OUTPUT));
encoder.start();
encoder.setRepeat(0);        // loop infinito
encoder.setDelay(150);       // ms per frame
encoder.setQuality(10);      // qualità alta

// Setup canvas
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

function renderFrame(solver) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const g = solver.visualize();

  // Draw lines
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

  encoder.addFrame(ctx);
}

(async () => {
  console.log("▶ Generating TraceCleanup GIF...");

  const solver = new TraceCleanupSolver({
    inputProblem: demoInput.inputProblem,
    allTraces: demoInput.allTraces,
    allLabelPlacements: demoInput.allLabelPlacements,
    mergedLabelNetIdMap: demoInput.mergedLabelNetIdMap || {},
    paddingBuffer: 5,
  });

  // Run solver step-by-step and render each frame
  for (let i = 0; i < 150; i++) {
    solver.step();
    renderFrame(solver);
    if (solver.solved) break;
  }

  encoder.finish();
  console.log("🎉 GIF generated at:", OUTPUT);
})();
