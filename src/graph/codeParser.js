/**
 * Enhanced code parser module for extracting code structure
 * Uses advanced regex patterns for better code analysis
 */
const fs = require('fs');
const path = require('path');

/**
 * CodeParser class for parsing code files
 */
class CodeParser {
  /**
   * Parse a file and extract its structure
   * @param {string} filePath - Path to the file
   * @returns {Object} - Parsed file structure
   */
  parseFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const extension = path.extname(filePath).toLowerCase();
      const language = this.getLanguageFromExtension(extension);
      
      // Basic structure for all files
      const fileStructure = {
        path: filePath,
        type: 'file',
        language: language,
        symbols: [],
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        variables: [],
        methodCalls: []
      };
      
      // Only process JavaScript/TypeScript files for now
      if (language === 'javascript' || language === 'typescript') {
        this.extractImports(content, fileStructure);
        this.extractFunctions(content, fileStructure);
        this.extractClasses(content, fileStructure);
        this.extractVariables(content, fileStructure);
        this.extractExports(content, fileStructure);
        this.extractMethodCalls(content, fileStructure);
      }
      
      return fileStructure;
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Extract imports from the content
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   */
  extractImports(content, fileStructure) {
    // Match require statements
    const requirePattern = /(?:const|let|var)\s+(\w+|\{[^}]+\})\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    let match;
    
    while ((match = requirePattern.exec(content)) !== null) {
      const importName = match[1].trim();
      const importPath = match[2];
      const position = match.index;
      const line = this.getLineNumber(content, position);
      
      fileStructure.imports.push({
        type: 'require',
        name: importName,
        path: importPath,
        position: position,
        line: line,
        column: this.getColumnNumber(content, position)
      });
    }
    
    // Match ES6 imports
    // This pattern handles various import formats:
    // - import defaultExport from 'module';
    // - import { export1, export2 } from 'module';
    // - import * as name from 'module';
    // - import 'module';
    const importPattern = /import\s+(?:((?:\w+|\*\s+as\s+\w+)(?:\s*,\s*)?)?(?:\{\s*([^}]+)\s*\})?\s+from\s+)?['"]([^'"]+)['"]/g;
    
    while ((match = importPattern.exec(content)) !== null) {
      const defaultImport = match[1] ? match[1].trim() : null;
      const namedImports = match[2] ? match[2].split(',').map(name => name.trim()) : [];
      const importPath = match[3];
      const position = match.index;
      const line = this.getLineNumber(content, position);
      
      if (defaultImport) {
        fileStructure.imports.push({
          type: 'import',
          name: defaultImport,
          path: importPath,
          position: position,
          line: line,
          column: this.getColumnNumber(content, position)
        });
      }
      
      for (const namedImport of namedImports) {
        // Handle aliased imports (e.g., { originalName as alias })
        const importParts = namedImport.split(/\s+as\s+/);
        const importName = importParts.length > 1 ? importParts[1] : importParts[0];
        
        fileStructure.imports.push({
          type: 'import',
          name: importName,
          originalName: importParts.length > 1 ? importParts[0] : null,
          path: importPath,
          position: position,
          line: line,
          column: this.getColumnNumber(content, position)
        });
      }
      
      // If no imports were specified, it's a bare import
      if (!defaultImport && namedImports.length === 0) {
        fileStructure.imports.push({
          type: 'import',
          name: '*',
          path: importPath,
          position: position,
          line: line,
          column: this.getColumnNumber(content, position)
        });
      }
    }
  }

  /**
   * Extract functions from the content
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   */
  extractFunctions(content, fileStructure) {
    // Match function declarations
    // This pattern captures:
    // - Regular function declarations: function name(params) { ... }
    // - Async function declarations: async function name(params) { ... }
    // - Generator function declarations: function* name(params) { ... }
    const functionPattern = /(?:async\s+)?function\s*(\*?)\s*(\w+)\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
      const isGenerator = match[1] === '*';
      const funcName = match[2];
      const params = match[3].split(',').map(p => p.trim()).filter(p => p);
      const position = match.index;
      const line = this.getLineNumber(content, position);
      
      // Find the function body
      const bodyStart = content.indexOf('{', match.index + match[0].length);
      if (bodyStart !== -1) {
        const bodyEnd = this.findMatchingBracket(content, bodyStart);
        
        fileStructure.functions.push({
          name: funcName,
          type: 'function',
          isGenerator: isGenerator,
          params: params,
          position: position,
          line: line,
          column: this.getColumnNumber(content, position),
          bodyRange: {
            start: { 
              position: bodyStart,
              line: this.getLineNumber(content, bodyStart),
              column: this.getColumnNumber(content, bodyStart)
            },
            end: { 
              position: bodyEnd,
              line: this.getLineNumber(content, bodyEnd),
              column: this.getColumnNumber(content, bodyEnd)
            }
          }
        });
        
        // Extract method calls within this function
        this.extractMethodCallsInRange(content, fileStructure, bodyStart, bodyEnd, funcName);
      }
    }
    
    // Match arrow functions with variable assignments
    // This pattern captures:
    // - Arrow functions: const name = (params) => { ... }
    // - Arrow functions with single param: const name = param => { ... }
    // - Async arrow functions: const name = async (params) => { ... }
    const arrowFunctionPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(([^)]*)\)|\s*(\w+)\s*)\s*=>/g;
    
    while ((match = arrowFunctionPattern.exec(content)) !== null) {
      const funcName = match[1];
      const params = match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p) : 
                    match[3] ? [match[3]] : [];
      const position = match.index;
      const line = this.getLineNumber(content, position);
      
      // Find the function body
      const arrowPos = content.indexOf('=>', match.index);
      if (arrowPos !== -1) {
        let bodyStart, bodyEnd;
        
        // Check if it's a block body or expression body
        const afterArrow = content.substring(arrowPos + 2).trim();
        
        if (afterArrow.startsWith('{')) {
          bodyStart = content.indexOf('{', arrowPos);
          bodyEnd = this.findMatchingBracket(content, bodyStart);
        } else {
          // Expression body (e.g., param => param + 1)
          bodyStart = arrowPos + 2;
          // Find the end of the expression (semicolon or newline)
          const semicolonPos = content.indexOf(';', bodyStart);
          const newlinePos = content.indexOf('\n', bodyStart);
          
          if (semicolonPos !== -1 && (newlinePos === -1 || semicolonPos < newlinePos)) {
            bodyEnd = semicolonPos;
          } else if (newlinePos !== -1) {
            bodyEnd = newlinePos;
          } else {
            bodyEnd = content.length;
          }
        }
        
        fileStructure.functions.push({
          name: funcName,
          type: 'arrow',
          params: params,
          position: position,
          line: line,
          column: this.getColumnNumber(content, position),
          bodyRange: {
            start: { 
              position: bodyStart,
              line: this.getLineNumber(content, bodyStart),
              column: this.getColumnNumber(content, bodyStart)
            },
            end: { 
              position: bodyEnd,
              line: this.getLineNumber(content, bodyEnd),
              column: this.getColumnNumber(content, bodyEnd)
            }
          }
        });
        
        // Extract method calls within this function
        this.extractMethodCallsInRange(content, fileStructure, bodyStart, bodyEnd, funcName);
      }
    }
    
    // Match method definitions in classes
    // We'll handle this in the extractClasses method
  }

  /**
   * Extract classes from the content
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   */
  extractClasses(content, fileStructure) {
    // Match class declarations
    // This pattern captures:
    // - Regular class declarations: class Name { ... }
    // - Class declarations with extends: class Name extends Parent { ... }
    const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    let match;
    
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const extendsName = match[2] || null;
      const position = match.index;
      const line = this.getLineNumber(content, position);
      
      // Find the class body
      const bodyStart = content.indexOf('{', match.index);
      if (bodyStart !== -1) {
        const bodyEnd = this.findMatchingBracket(content, bodyStart);
        const classBody = content.substring(bodyStart, bodyEnd + 1);
        
        // Extract methods and properties
        const methods = [];
        const properties = [];
        
        // Match method definitions
        // This pattern captures:
        // - Regular methods: methodName(params) { ... }
        // - Async methods: async methodName(params) { ... }
        // - Generator methods: *methodName(params) { ... }
        // - Static methods: static methodName(params) { ... }
        // - Getters and setters: get propertyName() { ... }
        const methodPattern = /(?:async\s+|static\s+|get\s+|set\s+|static\s+(?:async\s+|get\s+|set\s+))?(?:\*\s*)?(\w+)\s*\(([^)]*)\)\s*\{/g;
        let methodMatch;
        
        while ((methodMatch = methodPattern.exec(classBody)) !== null) {
          const methodName = methodMatch[1];
          const params = methodMatch[2].split(',').map(p => p.trim()).filter(p => p);
          const methodPosition = bodyStart + methodMatch.index;
          const methodLine = this.getLineNumber(content, methodPosition);
          
          // Find the method body
          const methodBodyStart = classBody.indexOf('{', methodMatch.index + methodMatch[0].length - 1);
          if (methodBodyStart !== -1) {
            const absoluteMethodBodyStart = bodyStart + methodBodyStart;
            const methodBodyEnd = this.findMatchingBracket(content, absoluteMethodBodyStart);
            
            methods.push(methodName);
            
            fileStructure.functions.push({
              name: methodName,
              type: 'method',
              className: className,
              params: params,
              position: methodPosition,
              line: methodLine,
              column: this.getColumnNumber(content, methodPosition),
              bodyRange: {
                start: { 
                  position: absoluteMethodBodyStart,
                  line: this.getLineNumber(content, absoluteMethodBodyStart),
                  column: this.getColumnNumber(content, absoluteMethodBodyStart)
                },
                end: { 
                  position: methodBodyEnd,
                  line: this.getLineNumber(content, methodBodyEnd),
                  column: this.getColumnNumber(content, methodBodyEnd)
                }
              }
            });
            
            // Extract method calls within this method
            this.extractMethodCallsInRange(content, fileStructure, absoluteMethodBodyStart, methodBodyEnd, methodName);
          }
        }
        
        // Match class properties
        // This pattern captures:
        // - Regular properties: propertyName = value;
        // - Static properties: static propertyName = value;
        const propertyPattern = /(?:static\s+)?(\w+)\s*=\s*(?:[^;]+);/g;
        let propertyMatch;
        
        while ((propertyMatch = propertyPattern.exec(classBody)) !== null) {
          const propertyName = propertyMatch[1];
          properties.push(propertyName);
        }
        
        fileStructure.classes.push({
          name: className,
          extends: extendsName,
          methods: methods,
          properties: properties,
          position: position,
          line: line,
          column: this.getColumnNumber(content, position),
          bodyRange: {
            start: { 
              position: bodyStart,
              line: this.getLineNumber(content, bodyStart),
              column: this.getColumnNumber(content, bodyStart)
            },
            end: { 
              position: bodyEnd,
              line: this.getLineNumber(content, bodyEnd),
              column: this.getColumnNumber(content, bodyEnd)
            }
          }
        });
      }
    }
  }

  /**
   * Extract variables from the content
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   */
  extractVariables(content, fileStructure) {
    // Match variable declarations
    // This pattern captures:
    // - const declarations: const name = value;
    // - let declarations: let name = value;
    // - var declarations: var name = value;
    const variablePattern = /(const|let|var)\s+(\w+)\s*=\s*([^;]+);/g;
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      const kind = match[1];
      const varName = match[2];
      const value = match[3].trim();
      const position = match.index;
      const line = this.getLineNumber(content, position);
      
      // Determine the value type
      let valueType = 'unknown';
      
      if (value.startsWith('{') && value.endsWith('}')) {
        valueType = 'object';
      } else if (value.startsWith('[') && value.endsWith(']')) {
        valueType = 'array';
      } else if (value.startsWith('function')) {
        valueType = 'function';
      } else if (value.includes('=>')) {
        valueType = 'arrow_function';
      } else if (value.startsWith('new ')) {
        valueType = 'instance';
      } else if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
        valueType = 'string';
      } else if (!isNaN(Number(value))) {
        valueType = 'number';
      } else if (value === 'true' || value === 'false') {
        valueType = 'boolean';
      } else if (value === 'null') {
        valueType = 'null';
      } else if (value === 'undefined') {
        valueType = 'undefined';
      }
      
      fileStructure.variables.push({
        name: varName,
        kind: kind,
        value: value,
        valueType: valueType,
        position: position,
        line: line,
        column: this.getColumnNumber(content, position)
      });
    }
  }

  /**
   * Extract exports from the content
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   */
  extractExports(content, fileStructure) {
    // Match module.exports assignments
    // This pattern captures:
    // - Object exports: module.exports = { name1, name2 };
    // - Single exports: module.exports = name;
    const moduleExportsPattern = /module\.exports\s*=\s*(?:{([^}]+)}|(\w+))/g;
    let match;
    
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
    
    // Match ES6 export statements
    // This pattern captures:
    // - Named exports: export { name1, name2 };
    // - Default exports: export default name;
    // - Direct exports: export const name = value;
    const exportPattern = /export\s+(?:(default)\s+(\w+)|{([^}]+)}|(?:const|let|var|function|class)\s+(\w+))/g;
    
    while ((match = exportPattern.exec(content)) !== null) {
      if (match[1] && match[2]) {
        // Default export
        fileStructure.exports.push(`default: ${match[2]}`);
      } else if (match[3]) {
        // Named exports
        const exports = match[3].split(',').map(e => {
          const parts = e.split(/\s+as\s+/).map(p => p.trim());
          return parts.length > 1 ? parts[1] : parts[0];
        });
        
        fileStructure.exports = fileStructure.exports.concat(exports);
      } else if (match[4]) {
        // Direct export
        fileStructure.exports.push(match[4]);
      }
    }
  }

  /**
   * Extract method calls from the content
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   */
  extractMethodCalls(content, fileStructure) {
    // We'll extract method calls within function bodies in the extractFunctions method
    // This method is for extracting top-level method calls
    
    // Find all top-level function and class declarations to exclude their bodies
    const excludedRanges = [];
    
    // Add function bodies
    for (const func of fileStructure.functions) {
      if (func.bodyRange) {
        excludedRanges.push([func.bodyRange.start.position, func.bodyRange.end.position]);
      }
    }
    
    // Add class bodies
    for (const cls of fileStructure.classes) {
      if (cls.bodyRange) {
        excludedRanges.push([cls.bodyRange.start.position, cls.bodyRange.end.position]);
      }
    }
    
    // Sort excluded ranges by start position
    excludedRanges.sort((a, b) => a[0] - b[0]);
    
    // Find positions that are not in any excluded range
    let currentPos = 0;
    const includedRanges = [];
    
    for (const [start, end] of excludedRanges) {
      if (currentPos < start) {
        includedRanges.push([currentPos, start]);
      }
      currentPos = end + 1;
    }
    
    if (currentPos < content.length) {
      includedRanges.push([currentPos, content.length]);
    }
    
    // Extract method calls in included ranges
    for (const [start, end] of includedRanges) {
      this.extractMethodCallsInRange(content, fileStructure, start, end, null);
    }
  }

  /**
   * Extract method calls within a specific range
   * @param {string} content - File content
   * @param {Object} fileStructure - The file structure to populate
   * @param {number} start - Start position
   * @param {number} end - End position
   * @param {string|null} containingFunction - Name of the containing function
   */
  extractMethodCallsInRange(content, fileStructure, start, end, containingFunction) {
    const rangeContent = content.substring(start, end);
    
    // Match method calls
    // This pattern captures:
    // - Object method calls: object.method(args)
    // - Direct function calls: function(args)
    const methodCallPattern = /(?:(\w+)\.)?(\w+)\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = methodCallPattern.exec(rangeContent)) !== null) {
      const objectName = match[1] || null;
      const methodName = match[2];
      const args = match[3].split(',').map(arg => arg.trim());
      const position = start + match.index;
      const line = this.getLineNumber(content, position);
      
      // Skip if it's a common JavaScript keyword
      if (['if', 'for', 'while', 'switch', 'catch'].includes(methodName)) {
        continue;
      }
      
      fileStructure.methodCalls.push({
        name: methodName,
        objectName: objectName,
        args: args.map(arg => ({ text: arg, type: this.getArgType(arg) })),
        containingFunction: containingFunction,
        position: position,
        line: line,
        column: this.getColumnNumber(content, position)
      });
    }
  }

  /**
   * Get the type of an argument
   * @param {string} arg - Argument string
   * @returns {string} - Argument type
   */
  getArgType(arg) {
    if (arg === '') return 'empty';
    if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) return 'string';
    if (!isNaN(Number(arg))) return 'number';
    if (arg === 'true' || arg === 'false') return 'boolean';
    if (arg === 'null') return 'null';
    if (arg === 'undefined') return 'undefined';
    if (arg.startsWith('{') && arg.endsWith('}')) return 'object';
    if (arg.startsWith('[') && arg.endsWith(']')) return 'array';
    if (arg.includes('=>')) return 'arrow_function';
    if (arg.startsWith('function')) return 'function';
    return 'identifier';
  }

  /**
   * Find the matching closing bracket for an opening bracket
   * @param {string} content - File content
   * @param {number} openPos - Position of the opening bracket
   * @returns {number} - Position of the matching closing bracket
   */
  findMatchingBracket(content, openPos) {
    if (content[openPos] !== '{') {
      return -1;
    }
    
    let depth = 1;
    let pos = openPos + 1;
    
    while (pos < content.length && depth > 0) {
      const char = content[pos];
      
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      }
      
      pos++;
    }
    
    return depth === 0 ? pos - 1 : -1;
  }

  /**
   * Get the line number for a position in the content
   * @param {string} content - File content
   * @param {number} position - Position in the content
   * @returns {number} - Line number (1-based)
   */
  getLineNumber(content, position) {
    const lines = content.substring(0, position).split('\n');
    return lines.length;
  }

  /**
   * Get the column number for a position in the content
   * @param {string} content - File content
   * @param {number} position - Position in the content
   * @returns {number} - Column number (1-based)
   */
  getColumnNumber(content, position) {
    const lines = content.substring(0, position).split('\n');
    return lines[lines.length - 1].length + 1;
  }

  /**
   * Get language from file extension
   * @param {string} extension - File extension
   * @returns {string} - Language name
   */
  getLanguageFromExtension(extension) {
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
}

// Create and export a singleton instance
const codeParser = new CodeParser();

module.exports = codeParser;
