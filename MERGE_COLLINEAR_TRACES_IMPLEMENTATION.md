# Issue #34: Merge Same-Net Trace Lines That Are Close Together

## Summary

Implemented a new phase in the TraceCleanupSolver to merge trace segments that belong to the same net, are collinear (aligned on the same X or Y axis), and are close to each other.

## Changes Made

### 1. New Merge Logic (`lib/solvers/TraceCleanupSolver/mergeCollinearTraces.ts`)

Created a new utility function `mergeCollinearTraces` that:

- Identifies simple two-point line segment traces
- Groups them by net ID
- Checks if segments are collinear (horizontal or vertical)
- Merges segments that:
  - Belong to the same net
  - Are aligned on the same axis
  - Overlap or are within a small threshold distance (default: 0.05 units)
- Combines multiple connected segments into single longer traces

**Key Features:**

- Only merges simple line segments (2-point traces)
- Preserves complex multi-segment traces
- Uses a configurable threshold for "closeness"
- Iteratively merges segments until no more merges are possible

### 2. Integration with TraceCleanupSolver

Modified `lib/solvers/TraceCleanupSolver/TraceCleanupSolver.ts`:

- Added new pipeline step: `"merging_collinear_traces"`
- Updated the cleanup pipeline order:
  1. Untangling Traces
  2. Minimizing Turns
  3. Balancing L-Shapes
  4. **Merging Collinear Traces** (NEW)
- Updated documentation to reflect the new phase

### 3. Test Suite

Created comprehensive tests in `tests/solvers/TraceCleanupSolver/mergeCollinearTraces.test.ts`:

- Test merging horizontal collinear traces
- Test merging vertical collinear traces
- Test that different nets are NOT merged
- Test that non-collinear traces are NOT merged
- Test merging three segments into one
- Test handling of close but not touching segments

### 4. Example Page

Created `site/examples/example29.page.tsx` to demonstrate the functionality visually.

## Algorithm Details

### Merging Criteria

Two trace segments can be merged if ALL of the following are true:

1. **Same Net**: Both traces have the same `netId`
2. **Same Orientation**: Both are horizontal OR both are vertical
3. **Collinear**: They're aligned on the same line (within threshold)
4. **Close/Overlapping**: They overlap or are within threshold distance

### Merge Process

1. Separate traces into simple (2-point) and complex (multi-point) traces
2. For simple traces, extract orientation (horizontal/vertical) and endpoints
3. Iteratively find pairs of traces that can be merged:
   - For horizontal: extend to cover min/max X coordinates
   - For vertical: extend to cover min/max Y coordinates
4. Continue merging until no more pairs can be combined
5. Return merged simple traces + unchanged complex traces

### Threshold Parameter

Default threshold: **0.05 units**

- Used for checking if traces are on the same line
- Used for checking if traces are close enough to merge
- Can be adjusted based on schematic requirements

## Example Use Cases

### Before Merge

```
Trace 1: (0, 0) → (2, 0)
Trace 2: (2, 0) → (4, 0)
```

### After Merge

```
Merged: (0, 0) → (4, 0)
```

This results in cleaner schematics with fewer fragmented traces, improving readability and visual appeal.

## Testing

Run tests with:

```bash
bun test tests/solvers/TraceCleanupSolver/mergeCollinearTraces.test.ts
```

View visual demonstration:

```bash
npm start
# Navigate to example29.page.tsx in the cosmos UI
```

## Future Enhancements

Potential improvements for future iterations:

1. Support merging of multi-segment traces
2. Adaptive threshold based on trace density
3. Merge traces that form L-shapes into cleaner paths
4. Performance optimization for large numbers of traces
