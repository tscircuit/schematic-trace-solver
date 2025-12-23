# Proposed Solution for Issue #29

I have implemented a new pipeline phase `TraceCombiningSolver` that effectively merges close, parallel trace segments of the same net. This "clean-up" phase runs after the initial trace solving and overlap shifting, ensuring that redundant or near-duplicate paths are consolidated for a cleaner schematic output.

## Key Implementation Details

1.  **New Solver Phase**: Created `TraceCombiningSolver.ts` which iterates through all solved traces.
2.  **Smart Grouping**: It strictly groups traces by their `globalConnNetId` to ensure only electrically connected segments are combined.
3.  **Iterative Convergence**: The solver applies an iterative approach (up to 10 passes) to ensure that as segments move and align, further opportunities for merging are caught (e.g., cascaded alignments).
4.  **Centroid Alignment**: When multiple parallel segments are found within a configurable `threshold` (default `0.5mm`/units) and *overlapping* in projection, they are snapped to their average geometric center. This preserves the general routing intent while removing visual clutter.
5.  **Orthogonality Preservation**: The modification logic strictly updates segment coordinates (X for vertical, Y for horizontal) in pairs, guaranteeing that the traces remain orthogonal (Manhattan geometry).

## Code Structure

-   `lib/solvers/TraceCombiningSolver/TraceCombiningSolver.ts`: Contains the core logic.
-   `lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts`: Integrated the new solver into the pipeline, placed strategically after `traceCleanupSolver` to refine the results before label placement.

## Verification

I've added unit tests in `tests/TraceCombiningSolver.test.ts` covering:
-   Merging of close parallel horizontal/vertical segments.
-   Non-merging of distant segments (respecting threshold).
-   Basic multi-segment trace handling.

I'm ready to open a PR with these changes!
