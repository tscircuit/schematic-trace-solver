# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library for calculating elbow line paths between two points with optional facing directions. The core algorithm creates connected line segments that respect directional constraints, commonly used for routing connections in diagrams or circuit boards.

Key components:

- `lib/index.ts` - Main library with `calculateElbow` function and `ElbowPoint` interface
- `tests/` - Comprehensive test suite with 10 different elbow scenarios
- `site/` - Interactive React demo for visualizing elbow calculations

The `calculateElbow` function takes two `ElbowPoint` objects (with x, y coordinates and optional facing directions like "x+", "y-") and returns an array of path points that create an elbow route between them.

## Development Commands

**Testing:**

```bash
bun test                    # Run all tests
bun test elbow01.test.ts   # Run a specific test
```

## Code Architecture

- Uses Bun as runtime and test framework
- TypeScript with strict mode enabled
- Test files follow pattern `elbow##.test.ts` with increasingly complex scenarios
- Library exports single function with options pattern for extensibility

The overshoot parameter allows the algorithm to extend beyond the direct path when facing directions require it, useful for avoiding obstacles or creating more natural routing paths.

## Tests

Tests should all have the general form:

```ts
import { test, expect } from "bun:test"
import { calculateElbow } from "lib/index"

const scene = {
  point1: {
    x: 500,
    y: 200,
    facingDirection: "y+",
  },
  point2: {
    x: 250,
    y: 150,
    facingDirection: "x+",
  },
} as const

test("elbow##", () => {
  const result = calculateElbow(scene.point1, scene.point2, {
    overshoot: 50,
  })
  expect(result).toEqual([
    { x: 500, y: 200 },
    { x: 500, y: 250 },
    { x: 375, y: 250 },
    { x: 375, y: 150 },
    { x: 250, y: 150 },
  ])
})
```
