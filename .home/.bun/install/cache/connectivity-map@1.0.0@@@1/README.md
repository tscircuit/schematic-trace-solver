# connectivity-map

A TypeScript module for managing connectivity between nodes in a network. Track and merge connections dynamically with efficient lookups.

## Installation

```bash
npm install connectivity-map
# or
bun install connectivity-map
# or  
yarn add connectivity-map
# or
pnpm add connectivity-map
```

## Usage

```typescript
import { ConnectivityMap } from 'connectivity-map'

// Initialize with existing network topology
const netMap = {
  net1: ["A", "B"],
  net2: ["C", "D"]
}

const connectivity = new ConnectivityMap(netMap)

// Add new connections
connectivity.addConnections([
  ["B", "E"],    // Connect E to existing net1 (A, B)
  ["F", "G"],    // Create new network for F and G
  ["C", "H"]     // Connect H to existing net2 (C, D)
])

// Query connectivity
console.log(connectivity.areIdsConnected("A", "E"))  // true
console.log(connectivity.areIdsConnected("A", "C"))  // false

// Get all nodes connected to a network
const net1Nodes = connectivity.getIdsConnectedToNet("net1")
console.log(net1Nodes)  // ["A", "B", "E"]

// Find which network a node belongs to
const nodeNetwork = connectivity.getNetConnectedToId("F")
console.log(nodeNetwork)  // "connectivity_net2"
```

## API

### Constructor

```typescript
new ConnectivityMap(netMap: Record<string, string[]>)
```

Initialize with an existing network topology where keys are network IDs and values are arrays of node IDs.

### Methods

#### `addConnections(connections: string[][]): void`

Add new connections to the network. Each connection is an array of node IDs that should be connected together. If nodes already belong to different networks, those networks will be merged.

#### `areIdsConnected(id1: string, id2: string): boolean`

Check if two nodes are connected (belong to the same network).

#### `areAllIdsConnected(ids: string[]): boolean`

Check if all nodes in an array belong to the same network.

#### `getIdsConnectedToNet(netId: string): string[]`

Get all node IDs that belong to a specific network.

#### `getNetConnectedToId(id: string): string | undefined`

Get the network ID that a specific node belongs to. Returns `undefined` if the node doesn't exist.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build the package
bun run build

# Format code
bun run format

# Watch mode during development
bun run dev
```

## License

MIT
