/**
 * CodeMaps parser module for extracting code structure
 */
const fs = require('fs');
const path = require('path');

/**
 * Parse a file and extract its structure for CodeMaps
 * @param {string} filePath - Path to the file
 * @returns {Object} - Parsed file structure for CodeMaps
 */
function parseFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();
    const language = getLanguageFromExtension(extension);
    
    // Basic structure for all files
    const fileStructure = {
      path: filePath,
      type: 'file',
      language: language,
      definitions: [],
      imports: [],
      exports: []
    };
    
    // Process based on language
    switch (language) {
      case 'javascript':
      case 'typescript':
        extractJavaScriptStructure(content, fileStructure);
        break;
      case 'python':
        extractPythonStructure(content, fileStructure);
        break;
      case 'java':
        extractJavaStructure(content, fileStructure);
        break;
      case 'csharp':
        extractCSharpStructure(content, fileStructure);
        break;
      // Add more languages as needed
    }
    
    return fileStructure;
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error.message);
    return {
      path: filePath,
      type: 'file',
      language: 'unknown',
      definitions: [],
      imports: [],
      exports: [],
      error: error.message
    };
  }
}

/**
 * Get the language from file extension
 * @param {string} extension - File extension
 * @returns {string} - Language name
 */
function getLanguageFromExtension(extension) {
  const extensionMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cs': 'csharp',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.rs': 'rust',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.dart': 'dart'
  };
  
  return extensionMap[extension] || 'unknown';
}

/**
 * Extract structure from JavaScript/TypeScript files
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJavaScriptStructure(content, fileStructure) {
  // Extract imports
  extractJSImports(content, fileStructure);
  
  // Extract class definitions
  extractJSClasses(content, fileStructure);
  
  // Extract function definitions
  extractJSFunctions(content, fileStructure);
  
  // Extract interface definitions (TypeScript)
  extractJSInterfaces(content, fileStructure);
  
  // Extract exports
  extractJSExports(content, fileStructure);
}

/**
 * Extract imports from JavaScript/TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSImports(content, fileStructure) {
  // Match ES6 imports
  const importPattern = /import\s+(?:{([^}]+)}\s+from\s+['"]([^'"]+)['"]|([^;]+)\s+from\s+['"]([^'"]+)['"])/g;
  let match;
  
  while ((match = importPattern.exec(content)) !== null) {
    if (match[1]) {
      // Named imports: import { a, b } from 'module'
      const namedImports = match[1].split(',').map(name => name.trim());
      fileStructure.imports.push({
        type: 'named',
        names: namedImports,
        source: match[2]
      });
    } else if (match[3] && match[4]) {
      // Default import: import name from 'module'
      fileStructure.imports.push({
        type: 'default',
        name: match[3].trim(),
        source: match[4]
      });
    }
  }
  
  // Match CommonJS requires
  const requirePattern = /(?:const|let|var)\s+(?:{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\)|([^=]+)\s*=\s*require\(['"]([^'"]+)['"]\))/g;
  
  while ((match = requirePattern.exec(content)) !== null) {
    if (match[1] && match[2]) {
      // Destructured require: const { a, b } = require('module')
      const namedImports = match[1].split(',').map(name => name.trim());
      fileStructure.imports.push({
        type: 'commonjs_destructured',
        names: namedImports,
        source: match[2]
      });
    } else if (match[3] && match[4]) {
      // Standard require: const name = require('module')
      fileStructure.imports.push({
        type: 'commonjs',
        name: match[3].trim(),
        source: match[4]
      });
    }
  }
}

/**
 * Extract class definitions from JavaScript/TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSClasses(content, fileStructure) {
  // Match class declarations
  const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{/g;
  let match;
  
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1];
    const extendsClass = match[2] || null;
    
    // Find methods within the class
    const classStart = match.index;
    const classBody = findClassBody(content, classStart);
    const methods = extractJSMethods(classBody, className);
    
    fileStructure.definitions.push({
      type: 'class',
      name: className,
      extends: extendsClass,
      methods: methods
    });
  }
}

/**
 * Find the class body
 * @param {string} content - File content
 * @param {number} startIndex - Start index of the class declaration
 * @returns {string} - Class body content
 */
function findClassBody(content, startIndex) {
  const openBraceIndex = content.indexOf('{', startIndex);
  if (openBraceIndex === -1) return '';
  
  let braceCount = 1;
  let currentIndex = openBraceIndex + 1;
  
  while (braceCount > 0 && currentIndex < content.length) {
    const char = content[currentIndex];
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
    }
    currentIndex++;
  }
  
  return content.substring(openBraceIndex + 1, currentIndex - 1);
}

/**
 * Extract methods from a class body
 * @param {string} classBody - Class body content
 * @param {string} className - Name of the class
 * @returns {Array} - Array of method definitions
 */
function extractJSMethods(classBody, className) {
  const methods = [];
  
  // Match method declarations
  const methodPattern = /(?:async\s+)?(?:static\s+)?(?:get|set|)\s*(\w+)\s*\(([^)]*)\)/g;
  let match;
  
  while ((match = methodPattern.exec(classBody)) !== null) {
    const methodName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);
    
    methods.push({
      type: 'method',
      name: methodName,
      params: params,
      className: className
    });
  }
  
  return methods;
}

/**
 * Extract function definitions from JavaScript/TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSFunctions(content, fileStructure) {
  // Match function declarations
  const functionPattern = /(?:export\s+)?(?:async\s+)?function\s*(\*?)\s*(\w+)\s*\(([^)]*)\)/g;
  let match;
  
  while ((match = functionPattern.exec(content)) !== null) {
    const isGenerator = match[1] === '*';
    const funcName = match[2];
    const params = match[3].split(',').map(p => p.trim()).filter(p => p);
    
    fileStructure.definitions.push({
      type: 'function',
      name: funcName,
      isGenerator: isGenerator,
      params: params
    });
  }
  
  // Match arrow functions assigned to variables
  const arrowFuncPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
  
  while ((match = arrowFuncPattern.exec(content)) !== null) {
    const funcName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);
    
    fileStructure.definitions.push({
      type: 'arrow_function',
      name: funcName,
      params: params
    });
  }
}

/**
 * Extract interface definitions from TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSInterfaces(content, fileStructure) {
  // Match interface declarations (TypeScript only)
  const interfacePattern = /interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*{/g;
  let match;
  
  while ((match = interfacePattern.exec(content)) !== null) {
    const interfaceName = match[1];
    const extendsInterfaces = match[2] ? match[2].split(',').map(i => i.trim()) : [];
    
    fileStructure.definitions.push({
      type: 'interface',
      name: interfaceName,
      extends: extendsInterfaces
    });
  }
}

/**
 * Extract exports from JavaScript/TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSExports(content, fileStructure) {
  // Match named exports
  const namedExportPattern = /export\s+(?:const|let|var|function|class|interface)\s+(\w+)/g;
  let match;
  
  while ((match = namedExportPattern.exec(content)) !== null) {
    fileStructure.exports.push({
      type: 'named',
      name: match[1]
    });
  }
  
  // Match default exports
  const defaultExportPattern = /export\s+default\s+(?:class|function)?\s*(\w+)?/g;
  
  while ((match = defaultExportPattern.exec(content)) !== null) {
    fileStructure.exports.push({
      type: 'default',
      name: match[1] || 'anonymous'
    });
  }
  
  // Match module.exports
  const moduleExportsPattern = /module\.exports\s*=\s*{([^}]+)}/g;
  
  while ((match = moduleExportsPattern.exec(content)) !== null) {
    const exportedItems = match[1].split(',').map(item => {
      const parts = item.split(':').map(part => part.trim());
      return parts.length > 1 ? parts[1] : parts[0];
    });
    
    for (const item of exportedItems) {
      fileStructure.exports.push({
        type: 'commonjs',
        name: item
      });
    }
  }
}

/**
 * Extract structure from Python files
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractPythonStructure(content, fileStructure) {
  // Basic implementation for Python - can be expanded
  
  // Extract imports
  const importPattern = /(?:from\s+(\S+)\s+import\s+([^#\n]+)|import\s+([^#\n]+))/g;
  let match;
  
  while ((match = importPattern.exec(content)) !== null) {
    if (match[1] && match[2]) {
      // from module import items
      const module = match[1];
      const items = match[2].split(',').map(item => item.trim());
      
      fileStructure.imports.push({
        type: 'from',
        module: module,
        items: items
      });
    } else if (match[3]) {
      // import module
      const modules = match[3].split(',').map(mod => mod.trim());
      
      for (const module of modules) {
        fileStructure.imports.push({
          type: 'import',
          module: module
        });
      }
    }
  }
  
  // Extract class definitions
  const classPattern = /class\s+(\w+)(?:\(([^)]+)\))?:/g;
  
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1];
    const inherits = match[2] ? match[2].split(',').map(cls => cls.trim()) : [];
    
    fileStructure.definitions.push({
      type: 'class',
      name: className,
      inherits: inherits
    });
  }
  
  // Extract function definitions
  const functionPattern = /def\s+(\w+)\s*\(([^)]*)\):/g;
  
  while ((match = functionPattern.exec(content)) !== null) {
    const funcName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);
    
    fileStructure.definitions.push({
      type: 'function',
      name: funcName,
      params: params
    });
  }
}

/**
 * Extract structure from Java files
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJavaStructure(content, fileStructure) {
  // Basic implementation for Java - can be expanded
  
  // Extract package
  const packagePattern = /package\s+([^;]+);/;
  const packageMatch = packagePattern.exec(content);
  
  if (packageMatch) {
    fileStructure.package = packageMatch[1].trim();
  }
  
  // Extract imports
  const importPattern = /import\s+([^;]+);/g;
  let match;
  
  while ((match = importPattern.exec(content)) !== null) {
    fileStructure.imports.push({
      type: 'import',
      path: match[1].trim()
    });
  }
  
  // Extract class definitions
  const classPattern = /(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
  
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1];
    const extendsClass = match[2] || null;
    const implementsInterfaces = match[3] ? match[3].split(',').map(i => i.trim()) : [];
    
    fileStructure.definitions.push({
      type: 'class',
      name: className,
      extends: extendsClass,
      implements: implementsInterfaces
    });
  }
  
  // Extract interface definitions
  const interfacePattern = /(?:public|private|protected)?\s*interface\s+(\w+)(?:\s+extends\s+([^{]+))?/g;
  
  while ((match = interfacePattern.exec(content)) !== null) {
    const interfaceName = match[1];
    const extendsInterfaces = match[2] ? match[2].split(',').map(i => i.trim()) : [];
    
    fileStructure.definitions.push({
      type: 'interface',
      name: interfaceName,
      extends: extendsInterfaces
    });
  }
  
  // Extract method definitions
  const methodPattern = /(?:public|private|protected|static|final|abstract|synchronized)\s+(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;
  
  while ((match = methodPattern.exec(content)) !== null) {
    const returnType = match[1];
    const methodName = match[2];
    const params = match[3].split(',').map(p => p.trim()).filter(p => p);
    
    fileStructure.definitions.push({
      type: 'method',
      name: methodName,
      returnType: returnType,
      params: params
    });
  }
}

/**
 * Extract structure from C# files
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractCSharpStructure(content, fileStructure) {
  // Basic implementation for C# - can be expanded
  
  // Extract namespace
  const namespacePattern = /namespace\s+([^{;]+)/;
  const namespaceMatch = namespacePattern.exec(content);
  
  if (namespaceMatch) {
    fileStructure.namespace = namespaceMatch[1].trim();
  }
  
  // Extract using statements
  const usingPattern = /using\s+([^;]+);/g;
  let match;
  
  while ((match = usingPattern.exec(content)) !== null) {
    fileStructure.imports.push({
      type: 'using',
      path: match[1].trim()
    });
  }
  
  // Extract class definitions
  const classPattern = /(?:public|private|protected|internal)?\s*(?:abstract|sealed|static)?\s*class\s+(\w+)(?:\s*:\s*([^{]+))?/g;
  
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1];
    const inheritance = match[2] ? match[2].split(',').map(i => i.trim()) : [];
    
    fileStructure.definitions.push({
      type: 'class',
      name: className,
      inheritance: inheritance
    });
  }
  
  // Extract interface definitions
  const interfacePattern = /(?:public|private|protected|internal)?\s*interface\s+(\w+)(?:\s*:\s*([^{]+))?/g;
  
  while ((match = interfacePattern.exec(content)) !== null) {
    const interfaceName = match[1];
    const inheritance = match[2] ? match[2].split(',').map(i => i.trim()) : [];
    
    fileStructure.definitions.push({
      type: 'interface',
      name: interfaceName,
      inheritance: inheritance
    });
  }
  
  // Extract method definitions
  const methodPattern = /(?:public|private|protected|internal|static|virtual|override|abstract|sealed|async)\s+(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;
  
  while ((match = methodPattern.exec(content)) !== null) {
    const returnType = match[1];
    const methodName = match[2];
    const params = match[3].split(',').map(p => p.trim()).filter(p => p);
    
    fileStructure.definitions.push({
      type: 'method',
      name: methodName,
      returnType: returnType,
      params: params
    });
  }
}

/**
 * Build code maps for a set of files
 * @param {Array} selectedFiles - Array of selected file objects
 * @returns {Object} - Code maps object
 */
function buildCodeMaps(selectedFiles) {
  const codeMaps = {
    files: [],
    relationships: []
  };
  
  // Parse each file
  for (const file of selectedFiles) {
    const fileStructure = parseFile(file.path);
    codeMaps.files.push(fileStructure);
    
    // Extract relationships between files based on imports
    for (const importItem of fileStructure.imports) {
      if (importItem.source) {
        // For JavaScript/TypeScript
        codeMaps.relationships.push({
          type: 'imports',
          source: file.path,
          target: importItem.source,
          items: importItem.names || [importItem.name]
        });
      } else if (importItem.module) {
        // For Python
        codeMaps.relationships.push({
          type: 'imports',
          source: file.path,
          target: importItem.module,
          items: importItem.items || []
        });
      } else if (importItem.path) {
        // For Java/C#
        codeMaps.relationships.push({
          type: 'imports',
          source: file.path,
          target: importItem.path
        });
      }
    }
  }
  
  return codeMaps;
}

module.exports = {
  parseFile,
  buildCodeMaps
};
