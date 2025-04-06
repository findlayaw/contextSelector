# Context Selector

A terminal-based tool for selecting files from your codebase to provide context to LLM code assistants.

## Features

- Browse your codebase in a terminal UI
- Respect `.gitignore` files to exclude irrelevant files
- Select multiple files from different directories
- Copy selected files to clipboard in LLM-friendly format
- Real-time token counting of the entire formatted output
- Search for files and folders
- Save and load selection templates
- Graph mode for analyzing code relationships

## Installation

```bash
# Clone the repository
git clone https://github.com/findlayaw/context-selector.git
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

# Start with graph mode enabled for code relationship analysis
aw --graph

# You can also toggle between modes while the application is running by pressing 'm'
```

## Keyboard Controls

### Navigation
- **↑/↓**: Navigate through files and directories
- **Enter**: Expand/collapse directory
- **h**: Move to parent directory (like vim's left)
- **l**: Enter directory or expand it (like vim's right)
- **g**: Jump to top of list
- **G**: Jump to bottom of list
- **Tab**: Toggle focus between file explorer and selected files display

### Selection
- **Space**: Select/deselect file or directory (in file explorer)
- **Space**: Unselect file (in selected files display when focused)
- **a**: Toggle selection of all visible files (includes folders as well)
- **Shift + ↑/↓**: Highlight multiple files at once (press Space to select highlighted files)

### Templates and Actions
- **/**: Search for files and folders
- **t**: Load a saved template
- **s**: Save current selection as a template
- **d**: Delete a template (when in template selection view)
- **m**: Toggle between different modes (Standard, Graph Analysis)
- **c**: Copy selected files to clipboard and exit
- **q**: Quit without copying
- **Escape**: Exit search mode, close template selection, or quit

## Output Format

The tool formats the selected files in Markdown with fenced code blocks, which is optimal for LLM comprehension.

### Standard Mode

In standard mode, the output includes the directory structure and file contents:

````markdown
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
````

### Graph Mode

In graph mode (enabled with `--graph`), the output includes code relationship information in addition to file contents:

````markdown
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

# Code Graph Overview

Total Files: 3
Total Nodes: 8
Total Relationships: 5

## Node Types
- file: 3
- function: 4
- class: 1

## Relationship Types
- imports: 2
- defined_in: 3

---

# File Dependencies

## src/index.js

Dependencies:
- helper.js (src/utils/helper.js)

---

# Function Calls

## main (src/index.js)

Calls:
- formatOutput (src/utils/helper.js)

---

# Selected Files

[File contents as in standard mode...]

---
````

## Templates

You can save your file selections as templates for future use. Templates are stored in `~/.context-selector/templates/`.

To manage templates:
- Press `t` to open the template selection view
- Select a template and press Enter to load it
- Press `d` while in the template selection view to delete the selected template

## License

ISC
