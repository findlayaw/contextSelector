/**
 * Code parser module for extracting AST and code structure
 * Uses tree-sitter to parse code into AST
 */
const fs = require('fs');
const path = require('path');

// We'll use a simplified approach initially without tree-sitter
// to avoid complex dependencies, focusing on the concept first

/**
 * Parse a file and extract its structure
 * @param {string} filePath - Path to the file
 * @returns {Object} - Parsed file structure
 */
function parseFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();
    
    // Basic structure for all files
    const fileStructure = {
      path: filePath,
      type: 'file',
      language: getLanguageFromExtension(extension),
      symbols: [],
      imports: [],
      exports: [],
      functions: [],
      classes: []
    };
    
    // Simple regex-based parsing for demonstration
    // In a production environment, use proper AST parsing with tree-sitter
    
    // Extract imports
    if (fileStructure.language === 'javascript' || fileStructure.language === 'typescript') {
      // Match require statements
      const requirePattern = /(?:const|let|var)\s+(\w+|\{[^}]+\})\s*=\s*require\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = requirePattern.exec(content)) !== null) {
        fileStructure.imports.push({
          type: 'require',
          name: match[1].trim(),
          path: match[2],
          position: match.index
        });
      }
      
      // Match ES6 imports
      const importPattern = /import\s+(?:(\w+|\{[^}]+\})\s+from\s+)?['"]([^'"]+)['"]/g;
      while ((match = importPattern.exec(content)) !== null) {
        fileStructure.imports.push({
          type: 'import',
          name: match[1] ? match[1].trim() : '*',
          path: match[2],
          position: match.index
        });
      }
      
      // Extract functions
      const functionPattern = /function\s+(\w+)\s*\(([^)]*)\)/g;
      while ((match = functionPattern.exec(content)) !== null) {
        fileStructure.functions.push({
          name: match[1],
          params: match[2].split(',').map(p => p.trim()).filter(p => p),
          position: match.index
        });
      }
      
      // Extract arrow functions with names (from assignments)
      const arrowFunctionPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/g;
      while ((match = arrowFunctionPattern.exec(content)) !== null) {
        fileStructure.functions.push({
          name: match[1],
          type: 'arrow',
          position: match.index
        });
      }
      
      // Extract classes
      const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
      while ((match = classPattern.exec(content)) !== null) {
        fileStructure.classes.push({
          name: match[1],
          extends: match[2] || null,
          position: match.index
        });
      }
      
      // Extract exports
      const moduleExportsPattern = /module\.exports\s*=\s*(?:{([^}]+)}|(\w+))/g;
      while ((match = moduleExportsPattern.exec(content)) !== null) {
        if (match[1]) {
          // Object export
          const exports = match[1].split(',').map(e => {
            const parts = e.split(':').map(p => p.trim());
            return parts.length > 1 ? parts[1] : parts[0];
          });
          fileStructure.exports = fileStructure.exports.concat(exports);
        } else if (match[2]) {
          // Single export
          fileStructure.exports.push(match[2].trim());
        }
      }
    }
    
    return fileStructure;
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get language from file extension
 * @param {string} extension - File extension
 * @returns {string} - Language name
 */
function getLanguageFromExtension(extension) {
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.php': 'php',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.md': 'markdown'
  };
  
  return languageMap[extension] || 'text';
}

module.exports = {
  parseFile
};
