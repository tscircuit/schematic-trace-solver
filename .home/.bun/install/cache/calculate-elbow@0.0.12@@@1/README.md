# calculate-elbow

A TypeScript library that computes "elbow" paths between two points. Each point can optionally declare a facing direction—`"x+"`, `"x-"`, `"y+"`, or `"y-"`—which influences how the path enters or exits the point. This is handy when routing wires or connectors in diagrams.

[View Online Demo](https://calculate-elbow.vercel.app/)

![image](https://github.com/user-attachments/assets/c18c3f71-1277-41fa-a95b-38c228b890e1)

## Installation

```bash
bun add calculate-elbow
```

## Usage

```ts
import { calculateElbow } from "calculate-elbow"

const start = { x: 0, y: 0, facingDirection: "x+" }
const end = { x: 100, y: 50, facingDirection: "y-" }

const path = calculateElbow(start, end, { overshoot: 20 })
console.log(path)
// [
//   { x: 0, y: 0 },
//   { x: 20, y: 0 },
//   { x: 20, y: 50 },
//   { x: 100, y: 50 }
// ]
```

`calculateElbow` returns an array of points representing the orthogonal segments from start to end. The optional `overshoot` parameter controls how far the path extends beyond the end point when aligning with its facing direction.

 The function automatically sorts the two input points internally so calculations always proceed from the left-most (and, when tied on `x`, the lowest `y`) point. If the inputs are provided in the opposite order, the resulting array is reversed so the path still runs from the original first point to the second.

## Testing

Run the test suite with Bun:

```bash
bun test
```
