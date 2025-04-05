const fs = require('fs');
const path = require('path');
const ignore = require('ignore');

// Store gitignore rules for each directory
const gitignoreRules = new Map();

let rootDir = '';

/**
 * Initialize the file system module
 * @param {string} directory - The root directory to start from
 */
function init(directory) {
  rootDir = directory;

  // Clear any existing gitignore rules
  gitignoreRules.clear();

  // Load gitignore rules for the root directory
  loadGitignoreRules(directory);
}

/**
 * Get the directory tree starting from the given path
 * @param {string} startPath - Path to start from
 * @returns {Object} - Directory tree structure
 */
function getDirectoryTree(startPath = rootDir) {
  try {
    // Ensure the path is valid
    if (!startPath || startPath === '') {
      console.error('Start path is empty');
      return null;
    }

    // Get file/directory stats
    const stats = fs.statSync(startPath);
    const relativePath = path.relative(rootDir, startPath);
    const name = path.basename(startPath);

    // Handle file
    if (stats.isFile()) {
      return {
        type: 'file',
        path: startPath,
        relativePath: relativePath || name,
        name,
        size: stats.size
      };
    }

    // Handle directory
    if (stats.isDirectory()) {
      // Read directory contents
      let items;
      try {
        items = fs.readdirSync(startPath);
      } catch (dirError) {
        console.error(`Error reading directory ${startPath}:`, dirError.message);
        items = [];
      }

      // Load gitignore rules for this directory
      loadGitignoreRules(startPath);

      // Process children
      const children = [];
      for (const item of items) {
        try {
          const itemPath = path.join(startPath, item);

          // Check if this item should be ignored
          if (shouldIgnore(itemPath, rootDir)) {
            continue;
          }

          const node = getDirectoryTree(itemPath);
          if (node) {
            children.push(node);
          }
        } catch (itemError) {
          console.error(`Error processing ${item}:`, itemError.message);
        }
      }

      // Return directory node
      return {
        type: 'directory',
        path: startPath,
        relativePath: relativePath || '.',
        name: name || path.basename(startPath),
        children: children.sort((a, b) => {
          // Sort directories first, then files
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          // Then sort alphabetically
          return a.name.localeCompare(b.name);
        })
      };
    }

    return null;
  } catch (error) {
    console.error(`Error reading ${startPath}:`, error.message);
    return null;
  }
}

/**
 * Read the content of a file
 * @param {string} filePath - Path to the file
 * @returns {string} - Content of the file
 */
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Format the directory tree as a string
 * @param {Object} tree - Directory tree object
 * @param {string} prefix - Prefix for indentation
 * @returns {string} - Formatted directory tree
 */
function formatDirectoryTree(tree, prefix = '') {
  if (!tree) return '';

  let result = '';

  if (tree.type === 'directory') {
    result += `${prefix}${tree.name}/\n`;

    if (tree.children && tree.children.length > 0) {
      const childPrefix = prefix + '  ';
      for (let i = 0; i < tree.children.length; i++) {
        const isLast = i === tree.children.length - 1;
        const childTree = tree.children[i];
        result += formatDirectoryTree(childTree, childPrefix);
      }
    }
  } else if (tree.type === 'file') {
    result += `${prefix}${tree.name}\n`;
  }

  return result;
}

/**
 * Load gitignore rules for a directory
 * @param {string} directory - Directory to load rules for
 */
function loadGitignoreRules(directory) {
  try {
    const gitignorePath = path.join(directory, '.gitignore');

    // Check if .gitignore exists
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const ig = ignore().add(content);

      // Add default ignores
      ig.add(['node_modules', '.git', 'dist', 'build']);

      // Store the rules for this directory
      gitignoreRules.set(directory, ig);
    } else {
      // Create a default ignore rule set
      const ig = ignore().add(['node_modules', '.git', 'dist', 'build']);
      gitignoreRules.set(directory, ig);
    }
  } catch (error) {
    console.error(`Error loading gitignore for ${directory}:`, error.message);
    // Create a default ignore rule set on error
    const ig = ignore().add(['node_modules', '.git', 'dist', 'build']);
    gitignoreRules.set(directory, ig);
  }
}

/**
 * Check if a path should be ignored based on gitignore rules
 * @param {string} filePath - Path to check
 * @param {string} baseDir - Base directory for relative path calculation
 * @returns {boolean} - True if the path should be ignored
 */
function shouldIgnore(filePath, baseDir) {
  // Get the closest parent directory with gitignore rules
  let currentDir = path.dirname(filePath);
  let relativePath = path.relative(baseDir, filePath);

  // Replace backslashes with forward slashes for consistency
  relativePath = relativePath.replace(/\\/g, '/');

  // Check if we have rules for this directory or any parent
  while (currentDir.startsWith(rootDir)) {
    if (gitignoreRules.has(currentDir)) {
      const ig = gitignoreRules.get(currentDir);
      return ig.ignores(relativePath);
    }

    // Move up to parent directory
    currentDir = path.dirname(currentDir);
  }

  // If we reach the root without finding rules, use root rules
  if (gitignoreRules.has(rootDir)) {
    const ig = gitignoreRules.get(rootDir);
    return ig.ignores(relativePath);
  }

  // Default to not ignoring if no rules found
  return false;
}

module.exports = {
  init,
  getDirectoryTree,
  readFileContent,
  formatDirectoryTree,
  loadGitignoreRules,
  shouldIgnore
};
