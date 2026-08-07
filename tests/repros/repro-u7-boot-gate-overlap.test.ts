import { expect, test } from "bun:test";
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug";
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver";
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver";
import input from "../assets/repro-u7-boot-gate-overlap.input.json";
import "tests/fixtures/matcher";

const affectedPairIds = new Set([
  "schematic_port_63-schematic_port_24",
  "schematic_port_61-schematic_port_63",
]);

const getVerticalOverlap = (
  first: SolvedTracePath,
  second: SolvedTracePath,
) => {
  const coordinateTolerance = 1e-6;

  for (
    let firstIndex = 0;
    firstIndex < first.tracePath.length - 1;
    firstIndex++
  ) {
    const firstStart = first.tracePath[firstIndex]!;
    const firstEnd = first.tracePath[firstIndex + 1]!;
    if (Math.abs(firstStart.x - firstEnd.x) > coordinateTolerance) continue;

    for (
      let secondIndex = 0;
      secondIndex < second.tracePath.length - 1;
      secondIndex++
    ) {
      const secondStart = second.tracePath[secondIndex]!;
      const secondEnd = second.tracePath[secondIndex + 1]!;
      if (
        Math.abs(secondStart.x - secondEnd.x) > coordinateTolerance ||
        Math.abs(secondStart.x - firstStart.x) > coordinateTolerance
      ) {
        continue;
      }

      const minY = Math.max(
        Math.min(firstStart.y, firstEnd.y),
        Math.min(secondStart.y, secondEnd.y),
      );
      const maxY = Math.min(
        Math.max(firstStart.y, firstEnd.y),
        Math.max(secondStart.y, secondEnd.y),
      );
      if (maxY > minY) {
        return {
          start: { x: firstStart.x, y: minY },
          end: { x: firstStart.x, y: maxY },
        };
      }
    }
  }

  return null;
};

test("reproduces overlapping U7 BOOT_GATE branches", () => {
  const solverInput = input as unknown as ConstructorParameters<
    typeof SingleOverlapSolver
  >[0];
  const solver = new SingleOverlapSolver(solverInput);

  solver.solve();

  const traces = [
    solverInput.tracesToAvoidOverlapping!.find((trace) =>
      affectedPairIds.has(trace.mspPairId),
    )!,
    { ...solverInput.trace, tracePath: solver.solvedTracePath! },
  ];
  const overlap = getVerticalOverlap(traces[0]!, traces[1]!)!;

  const graphics: GraphicsObject = {
    lines: [
      {
        points: traces[0]!.tracePath,
        strokeColor: "#2563eb",
        strokeWidth: 0.06,
        label: "R1 to U7 pin 25",
      },
      {
        points: traces[1]!.tracePath,
        strokeColor: "#dc2626",
        strokeWidth: 0.06,
        label: "Q1 to R1 recovery route",
      },
      {
        points: [overlap.start, overlap.end],
        strokeColor: "#f59e0b",
        strokeWidth: 0.12,
        label: "overlapping segment",
      },
    ],
    points: [
      { ...traces[0]!.pins[0]!, color: "#111827", label: "R1 pin 1" },
      { ...traces[0]!.pins[1]!, color: "#111827", label: "U7 pin 25" },
      { ...traces[1]!.pins[0]!, color: "#111827", label: "Q1 pin 2" },
      {
        x: overlap.start.x,
        y: (overlap.start.y + overlap.end.y) / 2,
        color: "#f59e0b",
        label: "duplicate BOOT_GATE path",
      },
    ],
    texts: [
      {
        x: -2.75,
        y: -0.45,
        text: "Q1 → R1 reroute",
        fontSize: 0.12,
        color: "#dc2626",
      },
      {
        x: -1.55,
        y: -2.05,
        text: "R1 → U7",
        fontSize: 0.12,
        color: "#2563eb",
      },
      {
        x: -1.62,
        y: -2.4,
        text: "overlap",
        fontSize: 0.12,
        color: "#d97706",
      },
    ],
  };

  const svg = getSvgFromGraphicsObject(graphics, {
    backgroundColor: "white",
  });
  expect(svg).toMatchSvgSnapshot(import.meta.path);
});
