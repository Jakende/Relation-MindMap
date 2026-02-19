# Import Functionality

Relation-MindMap supports importing mind maps from Markdown (.md) and JSON (.json) formats.

## Markdown Import

- Use hierarchical lists with indentation to define node relationships
- Supported syntax:

  ```
  - Parent Node
      - Child Node 1
      - Child Node 2
  ```

- Add relationships using arrow notation: `Node A -> Node B : Relation Type`

## JSON Import

- Requires specific structure with `nodes` and `links` arrays
- Example:

  ```json
  {
    "nodes": [
      {"id": "Node1"},
      {"id": "Node2"}
    ],
    "links": [
      {"source": "Node1", "target": "Node2", "type": "relation"}
    ]
  }
  ```

For detailed format specifications, see [Import Formats](Importformate.md).
