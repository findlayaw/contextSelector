const fs = require('fs-extra');
const path = require('path');
const ignore = require('ignore');

let gitignoreRules = null;
let rootDir = '';

/**
 * Initialize the file system module
 * @param {string} directory - The root directory to start from
 */
async function init(directory) {
  rootDir = directory;
  gitignoreRules = await loadGitignoreRules(directory);
}

/**
 * Load .gitignore rules from the given directory
 * @param {string} directory - Directory containing .gitignore
 * @returns {Object} - Ignore instance with loaded rules
 */
async function loadGitignoreRules(directory) {
  const ig = ignore();
  
  try {
    // Find the root of the git repository
    let currentDir = directory;
    let gitDir = null;
    
    while (currentDir !== path.parse(currentDir).root) {
      if (await fs.pathExists(path.join(currentDir, '.git'))) {
        gitDir = currentDir;
        break;
      }
      currentDir = path.dirname(currentDir);
    }
    
    if (!gitDir) {
      return ig; // No git repository found, return empty ignore rules
    }
    
    // Load .gitignore from the git root
    const gitignorePath = path.join(gitDir, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf8');
      ig.add(content);
    }
    
    return ig;
  } catch (error) {
    console.error('Error loading .gitignore:', error.message);
    return ig; // Return empty ignore rules on error
  }
}

/**
 * Check if a file or directory should be ignored based on .gitignore
 * @param {string} filePath - Path to check
 * @returns {boolean} - True if the path should be ignored
 */
function shouldIgnore(filePath) {
  if (!gitignoreRules) return false;
  
  // Convert to relative path from the root directory
  const relativePath = path.relative(rootDir, filePath);
  return gitignoreRules.ignores(relativePath);
}

/**
 * Get the directory tree starting from the given path
 * @param {string} startPath - Path to start from
 * @returns {Object} - Directory tree structure
 */
async function getDirectoryTree(startPath = rootDir) {
  try {
    const stats = await fs.stat(startPath);
    const relativePath = path.relative(rootDir, startPath);
    const name = path.basename(startPath);
    
    if (shouldIgnore(startPath)) {
      return null;
    }
    
    if (stats.isFile()) {
      return {
        type: 'file',
        path: startPath,
        relativePath: relativePath || name,
        name,
        size: stats.size
      };
    }
    
    if (stats.isDirectory()) {
      const items = await fs.readdir(startPath);
      const children = [];
      
      for (const item of items) {
        const itemPath = path.join(startPath, item);
        const node = await getDirectoryTree(itemPath);
        if (node) {
          children.push(node);
        }
      }
      
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
async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
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

module.exports = {
  init,
  getDirectoryTree,
  readFileContent,
  formatDirectoryTree,
  shouldIgnore
};
