import type { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

/**
 * Displays every stage of the pipeline with the status ("Solved", "Failed", "Running" or "Not Started"),
 * what iteration it started on, what iteration it ended on, and the time it took to solve.
 *
 * The table also has a column "Actions" that has a download icon to download the getConstructorParams()
 * of each stage.
 */
export const PipelineStageTable = ({
  pipelineSolver,
}: {
  pipelineSolver: SchematicTracePipelineSolver
}) => {
  // TODO
  return null
}
