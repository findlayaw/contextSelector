const blessed = require('blessed');
const fileSystem = require('../fileSystem');
const search = require('../utils/search');
const tokenCounter = require('../utils/tokenCounter');
const templateManager = require('../templates/manager');

// Store the currently selected files
let selectedFiles = [];
let directoryTree = null;
let tokenCount = 0;

/**
 * Start the terminal UI
 * @param {Object} options - UI options
 * @returns {Promise<Object>} - Result with selected files and other data
 */
async function start(options) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a screen object
      const screen = blessed.screen({
        smartCSR: true,
        title: 'Context Selector'
      });
      
      // Create the file tree box
      const treeBox = blessed.box({
        top: 0,
        left: 0,
        width: '70%',
        height: '80%',
        border: {
          type: 'line'
        },
        label: ' File Explorer ',
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: ' ',
          track: {
            bg: 'cyan'
          },
          style: {
            inverse: true
          }
        },
        keys: true,
        vi: true,
        mouse: false
      });
      
      // Create the info box
      const infoBox = blessed.box({
        top: 0,
        right: 0,
        width: '30%',
        height: '80%',
        border: {
          type: 'line'
        },
        label: ' Selected Files ',
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: ' ',
          style: {
            inverse: true
          }
        },
        keys: true,
        vi: true,
        mouse: false
      });
      
      // Create the status box
      const statusBox = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: '20%',
        border: {
          type: 'line'
        },
        label: ' Status ',
        content: 'Loading...'
      });
      
      // Create the search box
      const searchBox = blessed.textbox({
        bottom: 3,
        left: 'center',
        width: '80%',
        height: 3,
        border: {
          type: 'line'
        },
        label: ' Search ',
        hidden: true,
        keys: true,
        inputOnFocus: true
      });
      
      // Create the template name input box
      const templateNameBox = blessed.textbox({
        bottom: 3,
        left: 'center',
        width: '80%',
        height: 3,
        border: {
          type: 'line'
        },
        label: ' Save Template As ',
        hidden: true,
        keys: true,
        inputOnFocus: true
      });
      
      // Create the template selection box
      const templateSelectBox = blessed.list({
        bottom: 3,
        left: 'center',
        width: '80%',
        height: '50%',
        border: {
          type: 'line'
        },
        label: ' Select Template ',
        hidden: true,
        keys: true,
        vi: true,
        items: [],
        style: {
          selected: {
            bg: 'blue',
            fg: 'white'
          }
        }
      });
      
      // Add all elements to the screen
      screen.append(treeBox);
      screen.append(infoBox);
      screen.append(statusBox);
      screen.append(searchBox);
      screen.append(templateNameBox);
      screen.append(templateSelectBox);
      
      // Load the directory tree
      directoryTree = await fileSystem.getDirectoryTree(options.startDir);
      
      // Render the tree
      renderTree(treeBox, directoryTree);
      
      // Update status
      updateStatus(statusBox);
      
      // If a template was specified, load it
      if (options.template) {
        const template = await templateManager.loadTemplate(options.template);
        if (template && template.files) {
          selectedFiles = template.files;
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox);
        }
      }
      
      // If a search query was specified, perform search
      if (options.searchQuery) {
        const results = search.searchFiles(directoryTree, options.searchQuery);
        highlightSearchResults(treeBox, results);
      }
      
      // Handle key events
      screen.key(['escape', 'q', 'C-c'], () => {
        screen.destroy();
        resolve({ selectedFiles: [], directoryTree: null, tokenCount: 0 });
      });
      
      screen.key('enter', () => {
        const node = getCurrentNode(treeBox);
        if (node && node.type === 'directory') {
          toggleDirectory(treeBox, node);
          screen.render();
        }
      });
      
      screen.key('space', () => {
        const node = getCurrentNode(treeBox);
        if (node && node.type === 'file') {
          toggleFileSelection(node);
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox);
          screen.render();
        }
      });
      
      screen.key('/', () => {
        searchBox.hidden = false;
        searchBox.focus();
        screen.render();
      });
      
      screen.key('t', () => {
        showTemplateSelection(templateSelectBox);
        screen.render();
      });
      
      screen.key('s', () => {
        if (selectedFiles.length > 0) {
          templateNameBox.hidden = false;
          templateNameBox.focus();
          screen.render();
        }
      });
      
      screen.key('c', () => {
        if (selectedFiles.length > 0) {
          screen.destroy();
          resolve({
            selectedFiles,
            directoryTree,
            tokenCount,
            saveTemplate: null
          });
        }
      });
      
      // Handle search box events
      searchBox.key(['escape', 'C-c'], () => {
        searchBox.hidden = true;
        treeBox.focus();
        screen.render();
      });
      
      searchBox.key('enter', () => {
        const query = searchBox.getValue();
        searchBox.hidden = true;
        treeBox.focus();
        
        if (query) {
          const results = search.searchFiles(directoryTree, query);
          highlightSearchResults(treeBox, results);
        }
        
        screen.render();
      });
      
      // Handle template name box events
      templateNameBox.key(['escape', 'C-c'], () => {
        templateNameBox.hidden = true;
        treeBox.focus();
        screen.render();
      });
      
      templateNameBox.key('enter', () => {
        const templateName = templateNameBox.getValue();
        templateNameBox.hidden = true;
        treeBox.focus();
        
        if (templateName) {
          screen.destroy();
          resolve({
            selectedFiles,
            directoryTree,
            tokenCount,
            saveTemplate: templateName
          });
        } else {
          screen.render();
        }
      });
      
      // Handle template selection box events
      templateSelectBox.key(['escape', 'C-c'], () => {
        templateSelectBox.hidden = true;
        treeBox.focus();
        screen.render();
      });
      
      templateSelectBox.on('select', async (item) => {
        const templateName = item.content;
        templateSelectBox.hidden = true;
        treeBox.focus();
        
        const template = await templateManager.loadTemplate(templateName);
        if (template && template.files) {
          selectedFiles = template.files;
          updateSelectedFiles(infoBox);
          updateTokenCount();
          updateStatus(statusBox);
        }
        
        screen.render();
      });
      
      // Set focus to the tree box
      treeBox.focus();
      
      // Render the screen
      screen.render();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render the directory tree in the tree box
 * @param {Object} box - Blessed box to render in
 * @param {Object} tree - Directory tree to render
 * @param {number} level - Current indentation level
 */
function renderTree(box, tree, level = 0) {
  if (!tree) return;
  
  box.setContent('');
  renderNode(box, tree, 0, true);
  box.scrollTo(0);
}

/**
 * Render a single node in the tree
 * @param {Object} box - Blessed box to render in
 * @param {Object} node - Node to render
 * @param {number} level - Current indentation level
 * @param {boolean} isExpanded - Whether the node is expanded
 */
function renderNode(box, node, level = 0, isExpanded = false) {
  if (!node) return;
  
  const indent = '  '.repeat(level);
  const prefix = node.type === 'directory' ? (isExpanded ? '▼ ' : '▶ ') : '  ';
  const selected = isFileSelected(node) ? '{green-fg}✓{/green-fg} ' : '  ';
  const name = node.name + (node.type === 'directory' ? '/' : '');
  
  box.pushLine(`${indent}${prefix}${selected}${name}`);
  
  if (node.type === 'directory' && isExpanded && node.children) {
    for (const child of node.children) {
      renderNode(box, child, level + 1, isNodeExpanded(child));
    }
  }
}

/**
 * Check if a node is expanded
 * @param {Object} node - Node to check
 * @returns {boolean} - True if the node is expanded
 */
function isNodeExpanded(node) {
  // This would normally use a state management system
  // For simplicity, we'll assume all directories are collapsed by default
  return false;
}

/**
 * Toggle a directory's expanded state
 * @param {Object} box - Blessed box containing the tree
 * @param {Object} node - Directory node to toggle
 */
function toggleDirectory(box, node) {
  // This would normally update a state management system
  // For simplicity, we'll just re-render the tree
  renderTree(box, directoryTree);
}

/**
 * Get the node at the current cursor position
 * @param {Object} box - Blessed box containing the tree
 * @returns {Object} - The node at the cursor position
 */
function getCurrentNode(box) {
  // This would normally parse the content and find the node
  // For simplicity, we'll return a dummy node
  return {
    type: 'file',
    path: '/path/to/file.js',
    name: 'file.js'
  };
}

/**
 * Toggle selection of a file
 * @param {Object} node - File node to toggle
 */
function toggleFileSelection(node) {
  const index = selectedFiles.findIndex(f => f.path === node.path);
  
  if (index === -1) {
    selectedFiles.push(node);
  } else {
    selectedFiles.splice(index, 1);
  }
}

/**
 * Check if a file is selected
 * @param {Object} node - Node to check
 * @returns {boolean} - True if the file is selected
 */
function isFileSelected(node) {
  if (node.type !== 'file') return false;
  return selectedFiles.some(f => f.path === node.path);
}

/**
 * Update the selected files display
 * @param {Object} box - Blessed box to update
 */
function updateSelectedFiles(box) {
  let content = '';
  
  if (selectedFiles.length === 0) {
    content = 'No files selected';
  } else {
    content = selectedFiles.map(file => file.relativePath).join('\n');
  }
  
  box.setContent(content);
}

/**
 * Update the token count
 */
async function updateTokenCount() {
  tokenCount = 0;
  
  for (const file of selectedFiles) {
    const content = await fileSystem.readFileContent(file.path);
    tokenCount += tokenCounter.countTokens(content);
  }
}

/**
 * Update the status display
 * @param {Object} box - Blessed box to update
 */
function updateStatus(box) {
  const content = [
    `Selected: ${selectedFiles.length} files`,
    `Tokens: ${tokenCount}`,
    '',
    'Controls:',
    '  ↑/↓: Navigate',
    '  Enter: Expand/collapse directory',
    '  Space: Select/deselect file',
    '  /: Search',
    '  t: Load template',
    '  s: Save template',
    '  c: Copy to clipboard and exit',
    '  q: Quit without copying'
  ].join('\n');
  
  box.setContent(content);
}

/**
 * Highlight search results in the tree
 * @param {Object} box - Blessed box containing the tree
 * @param {Array} results - Search results to highlight
 */
function highlightSearchResults(box, results) {
  // This would normally update the tree display to highlight matches
  // For simplicity, we'll just re-render the tree
  renderTree(box, directoryTree);
}

/**
 * Show the template selection dialog
 * @param {Object} box - Blessed list box for template selection
 */
async function showTemplateSelection(box) {
  const templates = await templateManager.listTemplates();
  
  if (templates.length === 0) {
    box.setItems(['No templates available']);
  } else {
    box.setItems(templates);
  }
  
  box.hidden = false;
  box.focus();
}

module.exports = { start };
