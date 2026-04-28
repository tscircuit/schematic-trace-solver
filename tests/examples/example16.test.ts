import { test, expect } from "bun:test";
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver";
import inputProblem from "../assets/example16.json";
import "tests/fixtures/matcher";

test("example16", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any);

  solver.solve();

  expect(solver).toMatchSolverSnapshot(import.meta.path);
});
