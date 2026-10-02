# Archived routing geometry

Pipeline fixture inputs now specify their obstacle rectangles and terminal
positions explicitly. Older fixtures relied on the pipeline expanding each
rectangle to the outermost pin and projecting interior pins before routing.
Those archived inputs were migrated once to the geometry that their existing
routing regressions actually exercised. Their assertions and snapshots are
preserved; this migration is not performed at runtime.

The Temperature Alarm fixture is deliberately **not** migrated. It retains the
original raw core geometry and tests that external buzzer/MOSFET terminals never
expand the supplied body. `SchematicTracePipelineSolver/body-bounds.test.ts` also
covers asymmetric unconnected terminals and separate interior escape points.
New inputs should always capture actual body, text, and terminal geometry from
core, without any pin-based obstacle expansion.
