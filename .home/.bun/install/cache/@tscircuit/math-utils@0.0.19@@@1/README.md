# @tscircuit/math-utils

This repository contains a collection of TypeScript utility functions for geometric calculations, primarily focused on line intersection and distance calculations.

## Features

- Line intersection detection
- Segment intersection detection
- Point-to-segment distance calculation
- Orientation of points
- Distance between points

## Installation

```bash
bun add @tscircuit/math-utils
```

## Usage

Import the functions you need in your TypeScript project:

```typescript
import {
  doesLineIntersectLine,
  doSegmentsIntersect,
  pointToSegmentDistance,
} from "./src/index"

// Example usage
const point1 = { x: 0, y: 0 }
const point2 = { x: 5, y: 5 }
const point3 = { x: 0, y: 5 }
const point4 = { x: 5, y: 0 }

const intersects = doesLineIntersectLine([point1, point2], [point3, point4])
console.log("Lines intersect:", intersects)
```

## API Reference

### `doesLineIntersectLine(line1: [Point, Point], line2: [Point, Point], options?: { lineThickness?: number }): boolean`

Determines if two lines intersect, optionally considering line thickness.

### `doSegmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean`

Checks if two line segments intersect.

### `orientation(p: Point, q: Point, r: Point): number`

Calculates the orientation of three points.

### `onSegment(p: Point, q: Point, r: Point): boolean`

Checks if point q lies on the segment p-r.

### `pointToSegmentDistance(p: Point, v: Point, w: Point): number`

Calculates the minimum distance between a point and a line segment.

### `distance(p1: Point, p2: Point): number`

Calculates the Euclidean distance between two points.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
