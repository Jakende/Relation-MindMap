# Relation-MindMap

Relation-MindMap is a powerful, browser-based tool designed for creating interactive mind maps. It allows users to visualize hierarchical structures and arbitrary relationships, storing the latest map locally in the browser. The application is built using vanilla JavaScript and D3.js, and can be run directly from the static files in this repository without the need for any build steps or servers.

## Key Features

- **Dual Display Modes**: Seamlessly switch between a traditional Tree view and a Graph view. Both modes share the same intuitive interaction model, making it easy to navigate and edit your mind maps.
- **Live Markdown Editor**: Edit your mind map as an indented Markdown list. The editor supports automatic bullets, indentation using Tab/Shift+Tab, and undo/redo functionality, providing a smooth editing experience.
- **Import & Export**: Easily load mind maps from `.md` or `.json` files and export your current map back to these formats. Detailed documentation on the file structure can be found in [`memory-bank/Importformate.md`](memory-bank/Importformate.md).
- **Search & Navigation**: Utilize the search bar to highlight matching nodes and jump directly to them, enhancing navigation within large mind maps.
- **Customizable Display**: Adjust various settings such as link distance, node size, hierarchy scaling, animation speed, and collision radius through the settings menu.
- **Color Schemes & Dark Mode**: Choose from multiple predefined color palettes and toggle between light and dark themes to suit your preference.
- **Local Persistence**: The application automatically saves the current mind map and settings in `localStorage`, ensuring that your work is restored in the next session.

For a comprehensive overview of all features and functions, refer to [`memory-bank/Funktionsübersicht.md`](memory-bank/Funktionsübersicht.md). Additional detailed help files in German are available in the `memory-bank/` directory.

## Getting Started

1. **Open the Application**: Simply open `index.html` in any modern web browser. The page attempts to load D3.js and marked from a CDN.
   If network access is blocked, the bundled fallback files `d3.v7.min.js` and `marked.min.js` are loaded instead.
   If your browser restricts direct file access, start a tiny web server with `python -m http.server` and open `http://localhost:8000`.

   ```bash
   ./index.html
   ```

2. **Importing Data**: Use the 📁 import button located in the top right corner to load your own Markdown or JSON files. Example datasets are provided in the `Importe/` folder. When exporting, the application will offer both Markdown and JSON formats for download.

## Detailed Usage

### Working with the Live Markdown Editor

- **Creating Hierarchy**: Use the Tab key to indent and create sub-nodes under a parent node. Shift+Tab allows you to outdent and move back up the hierarchy.
- **Adding Relationships**: Define relationships between nodes using the arrow notation in the Markdown editor. Supported formats include `A -> B : Type`, `A -> B`, `-> [Type] B`, and `-> [rel:Type] B`. For more details, see [`memory-bank/Importformate.md`](memory-bank/Importformate.md).

## Repository Structure

The repository is organized as follows:

```index.html        # HTML entry point for the application
mindmap.js        # Main JavaScript logic utilizing D3.js
style.css         # Styling for the UI, including dark mode support
memory-bank/      # Additional documentation and examples (in German)
Importe/          # Example mind map data files
Archiv/           # Older files, screenshots, and code references
```

## License

This project is licensed under the [Apache License 2.0](LICENSE). For more details, please review the LICENSE file in this repository.

## Contributing

Contributions to Relation-MindMap are welcome. Please follow standard GitHub practices for submitting pull requests and issues.

## Acknowledgments

- D3.js for providing the powerful data visualization capabilities.
- The open-source community for their continuous support and inspiration.
