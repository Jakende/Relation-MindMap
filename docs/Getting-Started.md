# Getting Started with Relation-MindMap

## 1. Launch the Application
Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
The application loads D3.js and marked from a CDN, but if the network request
fails it falls back to the bundled files `d3.v7.min.js` and `marked.min.js`.
If your browser blocks direct file access, start a small web server:

```bash
python -m http.server
```
and open `http://localhost:8000` in your browser.

## 2. Explore the Interface
1. **Mind Map Canvas**: Central area for visualization
2. **Markdown Editor**: Left panel for text-based editing
3. **Toolbar**: Top-right buttons for import/export and settings

## 3. Create Your First Mind Map
1. Start typing in the Markdown Editor:
   ```markdown
   - Central Topic
     - Main Idea 1
     - Main Idea 2
   ```
2. Use Tab to indent and create sub-topics
3. Use Shift+Tab to outdent and move up a level
4. Add relationships: `Main Idea 1 -> Main Idea 2 : Connection`

## 4. Save and Export
1. Your map automatically saves to browser storage
2. Export to Markdown or JSON using the export button
3. Import existing maps using the import button

## 5. Customize Your View
1. Toggle between Tree and Graph views
2. Adjust display settings (link distance, node size)
3. Change color schemes or enable dark mode

## Next Steps
- Explore advanced features in the [User Guide](User-Guide.md)
- Learn about import/export formats in [Import Documentation](Import.md)
- See practical examples in [Use Cases](Use-Cases.md)
