import { useMemo } from "react";
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger";
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver";
import inputData from "../../tests/assets/SingleOverlapSolver.test.input.json";

export default () => {
  const solver = useMemo(() => new SingleOverlapSolver(inputData as any), []);

  return <GenericSolverDebugger solver={solver} />;
};
