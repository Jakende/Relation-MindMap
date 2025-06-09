# Relation-MindMap

Relation-MindMap is a browser based tool for building interactive mind maps. It can display hierarchical structures as well as arbitrary relations and stores your latest map locally in the browser. The application is written in vanilla JavaScript using D3.js and is served directly from the static files in this repository.

## Features

- **Two display modes** – switch between a traditional **Tree** view and a **Graph** view at any time. Both modes share the same interaction model.
- **Live Markdown editor** – edit the map as an indented Markdown list with automatic bullets, indentation via Tab/Shift+Tab and undo/redo support.
- **Import & export** – load maps from `.md` or `.json` files and export the current map back to Markdown or JSON. The exact file structure is documented in [`memory-bank/Importformate.md`](memory-bank/Importformate.md).
- **Search & navigation** – use the search bar to highlight matching nodes and jump directly to them.
- **Display & animation settings** – a settings menu lets you adjust link distance, node size, hierarchy scaling, animation speed and collision radius on the fly.
- **Color schemes and dark mode** – choose from several predefined color palettes and toggle a dark theme.
- **Local persistence** – the current mind map and all settings are saved in `localStorage` so the next session restores automatically.

For an overview of all functions see [`memory-bank/Funktionsübersicht.md`](memory-bank/Funktionsübersicht.md). More detailed help files (in German) are located in the `memory-bank/` directory.

## Getting Started

Simply open `index.html` in any modern web browser. All dependencies are loaded via CDN so no build step or server is required.

```bash
./index.html
```

Use the 📁 import button in the top right corner to load your own Markdown or JSON file. An example dataset can be found in the `Importe/` folder. When exporting, the app will offer both formats for download.

## Repository Layout

```
index.html        HTML entry point for the application
mindmap.js        Main JavaScript logic using D3.js
style.css         Styling for the UI and dark mode
memory-bank/      Additional documentation and examples (German)
Importe/          Example mind map data
Archiv/           Older files, screenshots and code references
```

## License

No license information is provided in this repository. If you plan to use or modify this project, please verify the licensing terms with the original author.
