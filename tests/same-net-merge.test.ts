import { test, expect } from "bun:test";
import { SameNetTraceMergeSolver } from "../lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver";

test("merge parallel same-net segments", () => {
  const mockTraces = [
    {
      source_net_id: "net_1",
      edges: [
        { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
        { from: { x: 0, y: 0.05 }, to: { x: 10, y: 0.05 } },
      ],
    },
  ];

  // 1. Create the solver
  const solver = new SameNetTraceMergeSolver({
    allTraces: mockTraces,
  } as any);

  // 2. THIS IS THE FIX: We manually plug the hole in the BaseSolver
  // We attach a fake inputProblem directly to the solver instance
  (solver as any).inputProblem = {
    directConnections: [],
    chips: [],
    components: [],
    obstacles: [],
  };

  // 3. Run your logic
  solver._step();

  // 4. Verify
  const output = solver.getOutput().traces;
  console.log(`Edges after merge: ${output[0].edges.length}`);

  expect(output[0].edges.length).toBe(1);
});
