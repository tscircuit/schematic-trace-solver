# feat: Allow long traces that don't cross any other traces

This pull request implements a performance optimization for the `SchematicTraceSingleLineSolver`.

Previously, the solver would always generate a large number of trace variants, even if the most direct path (the `baseElbow`) was already a valid solution. This could lead to unnecessary computation and slower performance.

This change introduces a check to validate the `baseElbow` before generating other variants. If the `baseElbow` is a valid path (i.e., it doesn't cause any collisions), it is immediately used as the solution, and the variant generation step is skipped.

This optimization significantly improves the solver's performance for cases where a simple, direct trace is possible.

A new test case has been added to verify this functionality, including a snapshot test to ensure the visual output is correct.
