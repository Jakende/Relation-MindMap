# Relation-MindMap

Relation-MindMap is a browser based tool for building interactive mind maps with support for hierarchical structures and custom relations. The application is written in vanilla JavaScript and D3.js and comes with a small set of HTML and CSS files.

## Features

- Import mind maps from **Markdown** or **JSON** files
- Switch between a tree layout and a graph layout
- Interactive editing with drag & drop and node locking
- Support for different color schemes and dark mode
- Export the current map as Markdown

The project is mostly documented in German. Take a look into the `memory-bank` folder for feature descriptions and usage notes.

## Getting Started

Open `index.html` in any modern web browser. All dependencies are loaded through CDNs, so no additional build step is required.

```
./index.html
```

To load your own data, use the import button in the top right corner and select a Markdown or JSON file that matches the format described in `memory-bank/Importformate.md`.

## Repository Layout

```
index.html        HTML entry point for the application
mindmap.js        Main JavaScript logic using D3.js
style.css         Styling for the UI and dark mode
memory-bank/      Additional documentation and examples (German)
Importe/          Example mind map data
```

## License

No license information is provided in this repository. If you plan to use or modify this project, please verify the licensing terms with the original author.
