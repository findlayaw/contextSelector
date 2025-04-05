# Context Selector

A terminal-based tool for selecting files from your codebase to provide context to LLM code assistants.

## Features

- Browse your codebase in a terminal UI
- Respect `.gitignore` files to exclude irrelevant files
- Select multiple files from different directories
- Copy selected files to clipboard in LLM-friendly format
- Real-time token counting
- Search for files and folders
- Save and load selection templates

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/context-selector.git
cd context-selector

# Install dependencies
npm install

# Link the command globally
npm link
```

## Usage

Run the `aw` command in your terminal:

```bash
# Run in the current directory
aw

# Run in a specific directory
aw --directory /path/to/project

# Start with a search query
aw --search "filename"

# Load a saved template
aw --template "my-template"
```

## Keyboard Controls

- **↑/↓**: Navigate through files and directories
- **Enter**: Expand/collapse directory
- **Space**: Select/deselect file
- **/**: Search for files and folders
- **t**: Load a saved template
- **s**: Save current selection as a template
- **c**: Copy selected files to clipboard and exit
- **q**: Quit without copying

## Output Format

The tool formats the selected files in Markdown with fenced code blocks, which is optimal for LLM comprehension:

```markdown
# Project Directory Structure

```
project/
  src/
    index.js
    utils/
      helper.js
  package.json
```

---

# Selected Files

## src/index.js

```javascript
// Content of index.js
console.log('Hello, world!');
```

---

## package.json

```json
{
  "name": "project",
  "version": "1.0.0"
}
```

---
```

## Templates

You can save your file selections as templates for future use. Templates are stored in `~/.context-selector/templates/`.

## License

ISC
