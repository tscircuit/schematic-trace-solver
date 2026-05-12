import { useMemo } from "react";
import { InteractiveGraphics } from "graphics-debug/react";
import { stackGraphicsHorizontally } from "graphics-debug";
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver";
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver";
import inputData from "../../tests/assets/3.input.json";

export default () => {
  const graphics = useMemo(() => {
    const traceCleanupSolver = new TraceCleanupSolver({
      ...inputData.traceCleanupSolver,
      targetTraceIds: new Set(inputData.traceCleanupSolver.targetTraceIds),
      mergedLabelNetIdMap: Object.fromEntries(
        Object.entries(inputData.traceCleanupSolver.mergedLabelNetIdMap).map(
          ([key, value]) => [key, new Set(value as any)],
        ),
      ),
    } as any);
    const singleOverlapSolver = new SingleOverlapSolver(
      inputData.singleOverlapSolver as any,
    );

    traceCleanupSolver.solve();
    singleOverlapSolver.solve();

    return stackGraphicsHorizontally(
      [singleOverlapSolver.visualize(), traceCleanupSolver.visualize()],
      {
        titles: ["SingleOverlapSolver", "TraceCleanupSolver"],
      },
    );
  }, []);

  return <InteractiveGraphics graphics={graphics} />;
};
