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
- Manage and include instruction prompts with your code context
- Graph mode for analyzing code relationships
- Code Maps mode for extracting code structure
- Multiple output formats (Markdown and XML)

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
# Basic usage - starts in Standard mode
aw

# Specify a starting directory
aw --directory /path/to/project

# Start with a search query
aw --search "filename"

# Load a saved template
aw --template "my-template"

# Use XML output format instead of Markdown
aw --xml
```

### Mode Selection

You can start the application in different modes:

```bash
# Standard mode (default) - full file contents
aw

# Graph Analysis mode - code relationships with full file contents
aw --graph

# Code Maps mode - API-level structure without implementation details (token efficient)
aw --codemaps

# Code Maps mode with full file contents (less token efficient)
aw --codemaps --include-contents

# Combined mode (Graph + CodeMaps) - both code relationships and API-level structure
aw --combined

# Combined mode with full file contents (less token efficient)
aw --combined --include-contents
```

You can toggle between modes while the application is running by pressing `m`.

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

### Templates, Prompts, and Actions
- **/**: Search for files and folders
- **t**: Load a saved template
- **s**: Save current selection as a template
- **d**: Delete a template (when in template selection view) or prompt (when in prompt selection view)
- **p**: Open prompt selection view
- **a**: Add a new prompt (when in prompt selection view)
- **m**: Toggle between different modes (Standard, Graph Analysis, Code Maps)
- **o**: Toggle output format (Markdown, XML) and file content inclusion for CodeMaps mode
- **c**: Copy selected files to clipboard and exit
- **q**: Quit without copying
- **Escape**: Exit search mode, close template/prompt selection, or quit

## Output Formats

The tool supports multiple output formats:

### Markdown Format (Default)

By default, the tool formats the selected files in Markdown with fenced code blocks, which is optimal for LLM comprehension. Selected prompts are included at the end of the output in an "INSTRUCTIONS" section.

````markdown
# Project Directory Structure

```
project/
  src/
    index.js
  package.json
```

---

# Selected Files

## src/index.js

```javascript
console.log('Hello, world!');
```

---

# INSTRUCTIONS

Please analyze this code and suggest improvements for performance and readability.
Focus on potential bugs and edge cases that might not be handled properly.

When responding, please format your answer with these sections:
1. Code Overview
2. Performance Issues
3. Readability Improvements
4. Potential Bugs

---
````


### XML Format

You can also use XML format by pressing `o` or using the `--xml` command line option. The XML format provides a more structured representation of the code context:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<context>
  <directory_structure>
    <![CDATA[
    project/
      src/
        index.js
        utils/
          helper.js
      package.json
    ]]>
  </directory_structure>

  <files>
    <file>
      <path>src/index.js</path>
      <language>javascript</language>
      <content><![CDATA[
      // Content of index.js
      console.log('Hello, world!');
      ]]></content>
    </file>
    <!-- More files... -->
  </files>

  <instructions>
    <prompt><![CDATA[
    Please analyze this code and suggest improvements for performance and readability.
    Focus on potential bugs and edge cases that might not be handled properly.
    ]]></prompt>
    <prompt><![CDATA[
    When responding, please format your answer with these sections:
    1. Code Overview
    2. Performance Issues
    3. Readability Improvements
    4. Potential Bugs
    ]]></prompt>
  </instructions>
</context>
```

### Output Format Cycling

You can cycle through available output formats by pressing the `o` key:

- In Standard mode: Toggle between Markdown and XML
- In Graph, CodeMaps, and Combined modes: Cycle between "Structure Only" (default), "Markdown with Contents", and "XML with Contents"

## Application Modes

The Context Selector tool offers four different modes, each designed for specific use cases:

| Mode | Description | Best For | Token Usage |
|------|-------------|----------|-------------|
| Standard | Full file contents with directory structure | Detailed code analysis | Baseline |
| Graph Analysis | Code relationships with full file contents | Understanding code interactions | Higher |
| Code Maps | API-level structure without implementation details | Architecture overview | Lower |
| Combined | Both code relationships and API-level structure | Comprehensive code understanding | Varies |

### When to Use Each Mode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Mode Selection Guide                                │
├───────────────────┬───────────────────────┬─────────────────────┬───────────┤
│   Standard Mode   │   Graph Analysis Mode │    Code Maps Mode   │ Combined  │
├───────────────────┼───────────────────────┼─────────────────────┼───────────┤
│ • Implementation  │ • Code relationships  │ • API structure     │ • All of  │
│   details         │ • Function calls      │ • Type definitions  │   these   │
│ • Debugging       │ • Dependencies        │ • Token efficiency  │ • Complete│
│ • Small codebases │ • Class hierarchies   │ • Large codebases   │   view    │
│ • Algorithms      │ • Data flow           │ • Architecture      │           │
└───────────────────┴───────────────────────┴─────────────────────┴───────────┘
                             ▲
                             │
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Selection Factors                                      │
├───────────────────────────┬───────────────────────────────────────────────┬─┤
│ Need implementation       │ Need to understand                            │ │
│ details?           Yes ───┼──► Standard Mode                              │ │
│                           │                                               │ │
│ Need to understand        │ Need to understand                            │ │
│ code relationships? Yes ──┼──► Graph Analysis Mode                        │ │
│                           │                                               │ │
│ Working with large        │ Need to optimize                              │ │
│ codebase?         Yes ───┼──► Code Maps Mode                              │ │
│                           │                                               │ │
│ Need architecture         │ Need high-level                               │ │
│ overview?         Yes ───┼──► Code Maps Mode                              │ │
│                           │                                               │ │
│ Need both relationships   │ Need comprehensive                            │ │
│ and structure?    Yes ───┼──► Combined Mode                              │ │
└───────────────────────────┴───────────────────────────────────────────────┴─┘
```

#### Standard Mode
- When you need to see the complete implementation details
- For debugging specific code issues
- When working with a small number of files
- For understanding algorithms and logic flow within functions
- When comments in the code contain important context

#### Graph Analysis Mode
- When you need to understand relationships between components
- For analyzing function calls and dependencies
- When refactoring code that has many interconnections
- For visualizing class hierarchies and inheritance
- When tracking how data flows through your application

#### Code Maps Mode
- When working with large codebases (can include more files within token limits)
- For architecture and API design questions
- When onboarding to a new codebase to understand structure
- For planning refactoring work at a high level
- When you need to optimize token usage
- For understanding the public interfaces without implementation details

#### Combined Mode
- When you need both relationship information and structural details
- For comprehensive understanding of complex codebases
- When analyzing both the architecture and the interactions between components
- For advanced refactoring that requires understanding both structure and dependencies
- When you want the best of both Graph and CodeMaps modes in a single view

### Standard Mode

Standard mode is the default mode. It provides a straightforward representation of your code, including the directory structure and complete file contents:

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

Graph Analysis mode (enabled with `--graph`) enhances your code context with relationship information. It analyzes imports, function calls, class hierarchies, and other code relationships while still including full file contents:

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

### Code Maps Mode

Code Maps mode (enabled with `--codemaps`) provides a token-efficient structural view of your code. It focuses on API-level details like function signatures, class definitions, and import/export relationships. By default, it excludes full file contents to optimize token usage.

#### Enhanced Features in Code Maps

- **Type Reference Tracking**: Detects when types from one file are used in another
- **Enum Detection**: Extracts and displays enum definitions with their members
- **Public API Surface**: Identifies and highlights the public API of each file
- **Access Level Detection**: Differentiates between public and private APIs
- **Inheritance Tracking**: Builds complete type inheritance chains
- **Cross-File Relationships**: Shows actual type usage relationships, not just imports

#### JavaScript-Specific Features

- **Prototype-Based Classes**: Detects JavaScript's prototype-based inheritance patterns
- **JSDoc Type Information**: Extracts parameter and return types from JSDoc comments
- **CommonJS Module Support**: Enhanced detection of CommonJS exports and imports
- **Object Method Detection**: Identifies methods defined in object literals
- **Export Detection**: Shows which functions and classes are exported

#### React/JSX/TSX Support

- **Component Detection**: Identifies React components (functional, class, pure, memo, forwardRef)
- **Props Type Tracking**: Links components to their props interface/type definitions
- **Hook Detection**: Identifies custom React hooks (functions starting with "use")
- **Component Relationships**: Shows which components use which props types
- **Export Status**: Shows which components are exported/public

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

# Code Maps

This section provides a structural overview of the codebase, focusing on API-level information.

## File Definitions

### src/index.js

**Language:** javascript

**Imports:**
- CommonJS require `helper` from `./utils/helper`

**Definitions:**

**Functions:**
- `main(options: ConfigOptions)` -> `boolean` (exported)
- `processData(data: string, callback: Function)` -> `void` (arrow function, exported)

**Prototype Classes:**
- `DataProcessor` extends `EventEmitter`
  - Method `process(data)` -> `Object`
  - Method `validate(input)` -> `boolean`

### src/utils/helper.js

**Language:** javascript

**Definitions:**

**Functions:**
- `formatOutput(text)` (exported)

**Exports:**
- CommonJS export: `formatOutput`

**Public API:**
- **Exported Functions:** `formatOutput`

### src/utils/types.ts

**Language:** typescript

**Interfaces:**
- `FormatOptions` (exported)

**Enums:**
- `OutputFormat` (exported, const)
  - `TEXT = 'text'`
  - `HTML = 'html'`
  - `JSON = 'json'`

**Type References:**
- From `BaseTypes`: `BaseOptions`

**Public API:**
- **Exported Interfaces:** `FormatOptions`
- **Exported Enums:** `OutputFormat`

### src/components/Button.tsx

**Language:** typescript

**Imports:**
- From `react`: React, { FC, ButtonHTMLAttributes }
- From `../styles/button.module.css`: styles

**Interfaces:**
- `ButtonProps` (exported)

**React Components:**
- `Button` (function) (exported) - Props: `ButtonProps`

**React Hooks:**
- `useButtonState` (exported)

**Type References:**
- From `react`: `FC`, `ButtonHTMLAttributes`

**Public API:**
- **Exported Components:** `Button`
- **Exported Hooks:** `useButtonState`
- **Exported Interfaces:** `ButtonProps`

## File Relationships

### src/index.js

**Import Dependencies:**
- Imports from `./utils/helper`: formatOutput, DataProcessor
- Imports from `events`: EventEmitter

**Type References:**
- References type `FormatOptions` from `./utils/helper`

**Prototype Inheritance:**
- Class `DataProcessor` inherits from `EventEmitter` in `events`

### src/utils/types.ts

**Interface Extensions:**
- Interface `ExtendedOptions` extends `BaseOptions` from `./utils/base-types`

---

# Note on Selected Files

Full file contents have been excluded to optimize token usage. This Code Maps view focuses on structural information and API definitions only.

## Selected Files (Structure Only)
- src/index.js
- src/utils/helper.js

---

If you use the `--include-contents` option, the full file contents will be included at the end, similar to standard mode.

### Combined Mode

Combined mode (enabled with `--combined`) provides the best of both Graph Mode and Code Maps Mode. It includes both the relationship information from Graph Mode and the structural API-level details from Code Maps Mode:

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

# Code Maps

This section provides a structural overview of the codebase, focusing on API-level information.

## File Definitions

### src/index.js

**Language:** javascript

**Imports:**
- CommonJS require `helper` from `./utils/helper`

**Definitions:**

**Functions:**
- `main(options)` (exported)
- `processData(data, callback)` (arrow function, exported)

**Public API:**
- **Exported Functions:** `main`, `processData`

### src/utils/helper.js

**Language:** javascript

**Definitions:**

**Functions:**
- `formatOutput(text)` (exported)

**Exports:**
- CommonJS export: `formatOutput`

## File Relationships

### src/index.js

**Import Dependencies:**
- Imports from `./utils/helper`: formatOutput

---

# Note on Selected Files

Full file contents have been excluded to optimize token usage. This Combined view focuses on structural information, relationships, and API definitions only.

## Selected Files (Structure Only)
- src/index.js
- src/utils/helper.js
- package.json

---
````

Like the other modes, Combined mode also supports the `--include-contents` option to include full file contents, and it works with both Markdown and XML output formats.

### Token Efficiency Comparison

The different modes have varying levels of token efficiency, which can be important when working with LLMs that have token limits:

- **Standard Mode**: Baseline token usage (100%)
- **Graph Analysis Mode**: Typically 5-10% more tokens than Standard Mode due to added relationship information
- **Code Maps Mode**: Typically 50-80% fewer tokens than Standard Mode when excluding file contents
- **Combined Mode**: Typically 10-20% more tokens than Code Maps Mode when excluding file contents, but provides much more comprehensive information

For large codebases, Code Maps mode can allow you to include significantly more files within your token budget, giving the LLM a broader view of your project structure.

## Templates

You can save your file selections as templates for future use. Templates are stored in `~/.context-selector/templates/`.

To manage templates:
- Press `t` to open the template selection view
- Select a template and press Enter to load it
- Press `d` while in the template selection view to delete the selected template

## Prompts

The prompts feature allows you to create, manage, and include instruction prompts with your code context. Prompts are stored in `~/.context-selector/prompts/`.

### Managing Prompts

- Press `p` to open the prompt selection view
- Use `Space` to toggle selection of prompts (multiple can be selected)
- Press `a` to add a new prompt
  - Enter a name for the prompt and press Enter
  - Enter the prompt content in the text area
  - Press `Ctrl+S` to save the prompt
- Press `d` to delete a prompt
- Press `Enter` to confirm your selection and return to the main view

### Using Prompts

Selected prompts are included in the output when you copy the context:

- In Markdown format, prompts appear in an "INSTRUCTIONS" section at the end of the output
- In XML format, prompts are included in an `<instructions>` section with each prompt in a `<prompt>` tag

This feature is particularly useful for:
- Including consistent instructions with your code context
- Saving frequently used prompts for different types of tasks
- Providing specific guidance to the LLM about how to interpret the code

## License

ISC
