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

    // Enhanced structure for all files
    const fileStructure = {
      path: filePath,
      type: 'file',
      language: language,
      definitions: [],
      imports: [],
      exports: [],
      typeReferences: [],  // Track references to types from other files
      publicAPI: [],      // Track public API surface
      enums: []           // Track enums
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

  // Extract prototype-based inheritance (JavaScript)
  extractJSPrototypes(content, fileStructure);

  // Extract interface definitions (TypeScript)
  extractJSInterfaces(content, fileStructure);

  // Extract enum definitions (TypeScript)
  extractJSEnums(content, fileStructure);

  // Extract React components (JSX/TSX)
  extractReactComponents(content, fileStructure);

  // Extract type references
  extractJSTypeReferences(content, fileStructure);

  // Extract public API surface
  extractJSPublicAPI(content, fileStructure);

  // Extract exports
  extractJSExports(content, fileStructure);
}

/**
 * Extract prototype-based inheritance from JavaScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSPrototypes(content, fileStructure) {
  // Match prototype assignments for methods
  const protoMethodPattern = /(\w+)\.prototype\.(\w+)\s*=\s*function\s*\(([^)]*)\)/g;
  let match;

  // Track classes created via prototype pattern
  const protoClasses = new Map();

  while ((match = protoMethodPattern.exec(content)) !== null) {
    const className = match[1];
    const methodName = match[2];
    const params = match[3].split(',').map(p => p.trim()).filter(p => p);

    // Check if we already have this prototype class
    if (!protoClasses.has(className)) {
      // Create a new prototype class
      protoClasses.set(className, {
        type: 'prototype_class',
        name: className,
        methods: []
      });
    }

    // Add method to the prototype class
    protoClasses.get(className).methods.push({
      type: 'method',
      name: methodName,
      params: params,
      className: className
    });
  }

  // Match prototype inheritance
  const protoInheritPattern = /(\w+)\.prototype\s*=\s*(?:new\s+|Object\.create\s*\()\s*(\w+)(?:\(|\))/g;

  while ((match = protoInheritPattern.exec(content)) !== null) {
    const childClass = match[1];
    const parentClass = match[2];

    // If we have the child class, add inheritance info
    if (protoClasses.has(childClass)) {
      protoClasses.get(childClass).extends = parentClass;
    } else {
      // Create a new prototype class with inheritance
      protoClasses.set(childClass, {
        type: 'prototype_class',
        name: childClass,
        extends: parentClass,
        methods: []
      });
    }
  }

  // Add all prototype classes to definitions
  for (const protoClass of protoClasses.values()) {
    fileStructure.definitions.push(protoClass);
  }
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

    // Check if function is exported
    const isExported = match[0].includes('export');

    const funcDef = {
      type: 'function',
      name: funcName,
      isGenerator: isGenerator,
      params: params,
      isExported: isExported
    };

    fileStructure.definitions.push(funcDef);

    // Add to public API if exported
    if (isExported) {
      fileStructure.publicAPI.push({
        type: 'function',
        name: funcName
      });
    }
  }

  // Match arrow functions assigned to variables
  const arrowFuncPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;

  while ((match = arrowFuncPattern.exec(content)) !== null) {
    const funcName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);
    const isExported = match[0].includes('export');

    const funcDef = {
      type: 'arrow_function',
      name: funcName,
      params: params,
      isExported: isExported
    };

    fileStructure.definitions.push(funcDef);

    // Add to public API if exported
    if (isExported) {
      fileStructure.publicAPI.push({
        type: 'function',
        name: funcName
      });
    }
  }

  // Match object method definitions
  const objectMethodPattern = /(\w+)\s*:\s*function\s*\(([^)]*)\)/g;

  while ((match = objectMethodPattern.exec(content)) !== null) {
    const methodName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);

    fileStructure.definitions.push({
      type: 'object_method',
      name: methodName,
      params: params
    });
  }

  // Match shorthand object methods
  const shorthandMethodPattern = /(\w+)\s*\(([^)]*)\)\s*{/g;

  while ((match = shorthandMethodPattern.exec(content)) !== null) {
    // Skip if this is a standard function declaration (already captured)
    if (content.substring(Math.max(0, match.index - 10), match.index).includes('function')) {
      continue;
    }

    const methodName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);

    fileStructure.definitions.push({
      type: 'object_method',
      name: methodName,
      params: params
    });
  }

  // Extract JSDoc comments for functions to get return types and parameter types
  extractJSDocComments(content, fileStructure);
}

/**
 * Extract JSDoc comments from JavaScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSDocComments(content, fileStructure) {
  // Match JSDoc comment blocks
  const jsdocPattern = /\/\*\*\s*([\s\S]*?)\*\/\s*(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>))/g;
  let match;

  while ((match = jsdocPattern.exec(content)) !== null) {
    const jsdocContent = match[1];
    const functionName = match[2] || match[3];

    if (!functionName) continue;

    // Find the corresponding function definition
    const funcDef = fileStructure.definitions.find(def =>
      (def.type === 'function' || def.type === 'arrow_function') && def.name === functionName
    );

    if (!funcDef) continue;

    // Extract return type from JSDoc
    const returnTypeMatch = jsdocContent.match(/@returns?\s+{([^}]+)}/i);
    if (returnTypeMatch) {
      funcDef.returnType = returnTypeMatch[1].trim();
    }

    // Extract parameter types from JSDoc
    const paramMatches = jsdocContent.matchAll(/@param\s+{([^}]+)}\s+(\w+)/g);
    if (paramMatches) {
      const paramTypes = {};
      for (const paramMatch of paramMatches) {
        const paramType = paramMatch[1].trim();
        const paramName = paramMatch[2].trim();
        paramTypes[paramName] = paramType;
      }

      // Add parameter types to function definition
      if (Object.keys(paramTypes).length > 0) {
        funcDef.paramTypes = paramTypes;
      }
    }
  }
}

/**
 * Extract interface definitions from TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSInterfaces(content, fileStructure) {
  // Match interface declarations (TypeScript only)
  const interfacePattern = /(?:export\s+)?(?:declare\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*{/g;
  let match;

  while ((match = interfacePattern.exec(content)) !== null) {
    const interfaceName = match[1];
    const extendsInterfaces = match[2] ? match[2].split(',').map(i => i.trim()) : [];
    const isExported = match[0].includes('export');

    const interfaceDef = {
      type: 'interface',
      name: interfaceName,
      extends: extendsInterfaces,
      isExported: isExported
    };

    fileStructure.definitions.push(interfaceDef);

    // Add to public API if exported
    if (isExported) {
      fileStructure.publicAPI.push({
        type: 'interface',
        name: interfaceName,
        extends: extendsInterfaces
      });
    }
  }
}

/**
 * Extract React components from JSX/TSX files
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractReactComponents(content, fileStructure) {
  // Check if the file imports React
  const hasReactImport = /import\s+(?:\*\s+as\s+)?React|import\s+{[^}]*React[^}]*}\s+from\s+['"]react['"]|require\(['"]react['"]\)/.test(content);

  if (!hasReactImport) {
    // Not a React component file
    return;
  }

  // Track components found in this file
  const components = [];

  // 1. Functional components (arrow functions)
  const arrowComponentPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:\(\s*(?:props|\{[^}]*\})\s*\)|props|\{[^}]*\})\s*=>\s*(?:\(|{|<)/g;
  let match;

  while ((match = arrowComponentPattern.exec(content)) !== null) {
    const componentName = match[1];
    const isExported = match[0].includes('export');

    // Check if it returns JSX (contains a tag)
    const componentBody = content.substring(match.index, match.index + 500); // Look at a reasonable chunk
    if (/<[A-Z][\w.]*[\s>]/.test(componentBody)) {
      components.push({
        type: 'functional_component',
        name: componentName,
        isExported: isExported,
        style: 'arrow'
      });
    }
  }

  // 2. Functional components (function declarations)
  const funcComponentPattern = /(?:export\s+)?function\s+(\w+)\s*\(\s*(?:props|\{[^}]*\})\s*\)/g;

  while ((match = funcComponentPattern.exec(content)) !== null) {
    const componentName = match[1];
    const isExported = match[0].includes('export');

    // Check if it returns JSX
    const componentBody = content.substring(match.index, match.index + 500);
    if (/<[A-Z][\w.]*[\s>]/.test(componentBody)) {
      components.push({
        type: 'functional_component',
        name: componentName,
        isExported: isExported,
        style: 'function'
      });
    }
  }

  // 3. Class components
  const classComponentPattern = /(?:export\s+)?class\s+(\w+)\s+extends\s+(?:React\.)?Component/g;

  while ((match = classComponentPattern.exec(content)) !== null) {
    const componentName = match[1];
    const isExported = match[0].includes('export');

    components.push({
      type: 'class_component',
      name: componentName,
      isExported: isExported
    });
  }

  // 4. Pure components
  const pureComponentPattern = /(?:export\s+)?class\s+(\w+)\s+extends\s+(?:React\.)?PureComponent/g;

  while ((match = pureComponentPattern.exec(content)) !== null) {
    const componentName = match[1];
    const isExported = match[0].includes('export');

    components.push({
      type: 'pure_component',
      name: componentName,
      isExported: isExported
    });
  }

  // 5. Memo components
  const memoComponentPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*React\.memo\(/g;

  while ((match = memoComponentPattern.exec(content)) !== null) {
    const componentName = match[1];
    const isExported = match[0].includes('export');

    components.push({
      type: 'memo_component',
      name: componentName,
      isExported: isExported
    });
  }

  // 6. Forward ref components
  const forwardRefPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*React\.forwardRef\(/g;

  while ((match = forwardRefPattern.exec(content)) !== null) {
    const componentName = match[1];
    const isExported = match[0].includes('export');

    components.push({
      type: 'forwardref_component',
      name: componentName,
      isExported: isExported
    });
  }

  // Extract props interfaces/types for components
  for (const component of components) {
    // Look for Props type definition
    const propsTypePattern = new RegExp(`(?:interface|type)\\s+(${component.name}Props|${component.name}Properties)\\s*(?:<[^>]*>)?\\s*(?:=\\s*)?{`, 'g');
    let propsMatch;

    while ((propsMatch = propsTypePattern.exec(content)) !== null) {
      component.propsType = propsMatch[1];
    }

    // Add component to definitions
    fileStructure.definitions.push(component);

    // Add to public API if exported
    if (component.isExported) {
      fileStructure.publicAPI.push({
        type: 'component',
        name: component.name,
        componentType: component.type
      });
    }
  }

  // Extract custom hooks
  const hookPattern = /(?:export\s+)?(?:function|const|let|var)\s+(use[A-Z]\w*)\s*(?:\(|=)/g;

  while ((match = hookPattern.exec(content)) !== null) {
    const hookName = match[1];
    const isExported = match[0].includes('export');

    const hook = {
      type: 'hook',
      name: hookName,
      isExported: isExported
    };

    fileStructure.definitions.push(hook);

    // Add to public API if exported
    if (isExported) {
      fileStructure.publicAPI.push({
        type: 'hook',
        name: hookName
      });
    }
  }
}

/**
 * Extract enum definitions from TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSEnums(content, fileStructure) {
  // Match enum declarations (TypeScript only)
  const enumPattern = /(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*{([^}]*)}/g;
  let match;

  while ((match = enumPattern.exec(content)) !== null) {
    const enumName = match[1];
    const enumBody = match[2];
    const isExported = match[0].includes('export');
    const isConst = match[0].includes('const enum');

    // Extract enum members
    const memberPattern = /(\w+)(?:\s*=\s*([^,]+))?/g;
    const members = [];
    let memberMatch;

    while ((memberMatch = memberPattern.exec(enumBody)) !== null) {
      members.push({
        name: memberMatch[1],
        value: memberMatch[2] ? memberMatch[2].trim() : undefined
      });
    }

    const enumDef = {
      type: 'enum',
      name: enumName,
      members: members,
      isConst: isConst,
      isExported: isExported
    };

    fileStructure.enums.push(enumDef);

    // Add to public API if exported
    if (isExported) {
      fileStructure.publicAPI.push({
        type: 'enum',
        name: enumName,
        members: members.map(m => m.name)
      });
    }
  }
}

/**
 * Extract type references from JavaScript/TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSTypeReferences(content, fileStructure) {
  // Match type annotations in variable declarations, function parameters, and return types
  const typeRefPatterns = [
    // Variable and parameter type annotations
    /:\s*([A-Z]\w*(?:\.[A-Z]\w*)?(?:<[^>]+>)?)/g,
    // Generic type parameters
    /<([A-Z]\w*(?:\.[A-Z]\w*)?(?:<[^>]+>)?)>/g,
    // extends clause in interfaces and classes
    /extends\s+([A-Z]\w*(?:\.[A-Z]\w*)?(?:<[^>]+>)?)/g,
    // implements clause in classes
    /implements\s+([A-Z]\w*(?:\.[A-Z]\w*)?(?:<[^>]+>)?)/g,
    // Type assertions
    /as\s+([A-Z]\w*(?:\.[A-Z]\w*)?(?:<[^>]+>)?)/g,
    // instanceof checks
    /instanceof\s+([A-Z]\w*(?:\.[A-Z]\w*)?)/g
  ];

  // Track unique type references
  const typeRefs = new Set();

  // Process each pattern
  for (const pattern of typeRefPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const typeName = match[1].trim();

      // Skip primitive types and common built-ins
      if (!isPrimitiveOrBuiltIn(typeName)) {
        typeRefs.add(typeName);
      }
    }
  }

  // Add unique type references to the file structure
  for (const typeName of typeRefs) {
    fileStructure.typeReferences.push({
      name: typeName,
      // Extract the source module if it's a qualified name (e.g., Module.Type)
      module: typeName.includes('.') ? typeName.split('.')[0] : null
    });
  }
}

/**
 * Check if a type name is a primitive or built-in type
 * @param {string} typeName - Name of the type
 * @returns {boolean} - Whether it's a primitive or built-in type
 */
function isPrimitiveOrBuiltIn(typeName) {
  const primitives = [
    'string', 'number', 'boolean', 'any', 'void', 'null', 'undefined',
    'never', 'unknown', 'object', 'symbol', 'bigint', 'Function',
    'Object', 'Array', 'Map', 'Set', 'Promise', 'Date', 'RegExp',
    'Error', 'String', 'Number', 'Boolean'
  ];

  return primitives.includes(typeName) ||
         typeName.startsWith('Array<') ||
         typeName.startsWith('Promise<') ||
         typeName.startsWith('Map<') ||
         typeName.startsWith('Set<');
}

/**
 * Extract public API surface from JavaScript/TypeScript
 * @param {string} content - File content
 * @param {Object} fileStructure - File structure to populate
 */
function extractJSPublicAPI(content, fileStructure) {
  // Classes, functions, and variables with export keyword are already handled in their respective extractors

  // Extract exported type aliases
  const typeAliasPattern = /export\s+type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/g;
  let match;

  while ((match = typeAliasPattern.exec(content)) !== null) {
    const typeName = match[1];
    const typeValue = match[2].trim();

    fileStructure.publicAPI.push({
      type: 'type_alias',
      name: typeName,
      value: typeValue
    });
  }

  // Extract public class members (properties and methods)
  for (const def of fileStructure.definitions) {
    if (def.type === 'class') {
      // Find the class in the content
      const classStart = content.indexOf(`class ${def.name}`);
      if (classStart !== -1) {
        const classBody = findClassBody(content, classStart);

        // Extract public properties
        const publicPropPattern = /public\s+(\w+)(?:\s*:\s*([^;=]+))?(?:\s*=\s*([^;]+))?;/g;
        let propMatch;

        while ((propMatch = publicPropPattern.exec(classBody)) !== null) {
          const propName = propMatch[1];
          const propType = propMatch[2] ? propMatch[2].trim() : null;

          fileStructure.publicAPI.push({
            type: 'property',
            name: propName,
            dataType: propType,
            className: def.name
          });
        }

        // Public methods are already captured in the class definition
        if (def.methods) {
          for (const method of def.methods) {
            // In TypeScript, methods are public by default unless marked private or protected
            const methodText = classBody.substring(
              classBody.indexOf(method.name),
              classBody.indexOf(method.name) + 100 // Look at a reasonable chunk of text
            );

            if (!methodText.includes('private') && !methodText.includes('protected')) {
              fileStructure.publicAPI.push({
                type: 'method',
                name: method.name,
                params: method.params,
                className: def.name
              });
            }
          }
        }
      }
    }
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
    const exportName = match[1];
    fileStructure.exports.push({
      type: 'named',
      name: exportName
    });

    // Add to public API
    fileStructure.publicAPI.push({
      type: 'export',
      name: exportName
    });
  }

  // Match default exports
  const defaultExportPattern = /export\s+default\s+(?:class|function)?\s*(\w+)?/g;

  while ((match = defaultExportPattern.exec(content)) !== null) {
    const exportName = match[1] || 'anonymous';
    fileStructure.exports.push({
      type: 'default',
      name: exportName
    });

    // Add to public API
    if (exportName !== 'anonymous') {
      fileStructure.publicAPI.push({
        type: 'export',
        name: exportName,
        isDefault: true
      });
    }
  }

  // Match module.exports = {...}
  const moduleExportsPattern = /module\.exports\s*=\s*{([^}]+)}/g;

  while ((match = moduleExportsPattern.exec(content)) !== null) {
    const exportedItems = match[1].split(',').map(item => {
      const parts = item.split(':').map(part => part.trim());
      return {
        key: parts[0].trim(),
        value: parts.length > 1 ? parts[1].trim() : parts[0].trim()
      };
    });

    for (const item of exportedItems) {
      fileStructure.exports.push({
        type: 'commonjs',
        name: item.value
      });

      // Add to public API
      fileStructure.publicAPI.push({
        type: 'export',
        name: item.value,
        exportName: item.key
      });
    }
  }

  // Match module.exports = function/class/variable
  const moduleExportsSinglePattern = /module\.exports\s*=\s*(\w+)/g;

  while ((match = moduleExportsSinglePattern.exec(content)) !== null) {
    const exportName = match[1];
    fileStructure.exports.push({
      type: 'commonjs',
      name: exportName
    });

    // Add to public API
    fileStructure.publicAPI.push({
      type: 'export',
      name: exportName,
      isDefault: true
    });
  }

  // Match exports.name = value
  const exportsPropertyPattern = /exports\.(\w+)\s*=\s*(\w+)/g;

  while ((match = exportsPropertyPattern.exec(content)) !== null) {
    const exportKey = match[1];
    const exportValue = match[2];

    fileStructure.exports.push({
      type: 'commonjs_property',
      name: exportValue,
      exportName: exportKey
    });

    // Add to public API
    fileStructure.publicAPI.push({
      type: 'export',
      name: exportValue,
      exportName: exportKey
    });
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

  // First pass: Parse each file to build the file structures
  const fileStructures = {};
  for (const file of selectedFiles) {
    const fileStructure = parseFile(file.path);
    codeMaps.files.push(fileStructure);
    fileStructures[file.path] = fileStructure;
  }

  // Second pass: Build a map of exported types by file
  const exportedTypesByFile = {};
  for (const [filePath, fileStructure] of Object.entries(fileStructures)) {
    exportedTypesByFile[filePath] = new Set();

    // Add exported classes
    for (const def of fileStructure.definitions) {
      if ((def.type === 'class' || def.type === 'interface') && def.isExported) {
        exportedTypesByFile[filePath].add(def.name);
      }
    }

    // Add exported enums
    for (const enumDef of fileStructure.enums) {
      if (enumDef.isExported) {
        exportedTypesByFile[filePath].add(enumDef.name);
      }
    }

    // Add exported type aliases
    for (const api of fileStructure.publicAPI) {
      if (api.type === 'type_alias') {
        exportedTypesByFile[filePath].add(api.name);
      }
    }
  }

  // Third pass: Extract relationships between files
  for (const [filePath, fileStructure] of Object.entries(fileStructures)) {
    // Extract relationships based on imports
    for (const importItem of fileStructure.imports) {
      if (importItem.source) {
        // For JavaScript/TypeScript
        codeMaps.relationships.push({
          type: 'imports',
          source: filePath,
          target: importItem.source,
          items: importItem.names || [importItem.name]
        });
      } else if (importItem.module) {
        // For Python
        codeMaps.relationships.push({
          type: 'imports',
          source: filePath,
          target: importItem.module,
          items: importItem.items || []
        });
      } else if (importItem.path) {
        // For Java/C#
        codeMaps.relationships.push({
          type: 'imports',
          source: filePath,
          target: importItem.path
        });
      }
    }

    // Extract relationships based on type references
    for (const typeRef of fileStructure.typeReferences) {
      // Find which file exports this type
      for (const [targetFile, exportedTypes] of Object.entries(exportedTypesByFile)) {
        if (targetFile !== filePath && exportedTypes.has(typeRef.name)) {
          codeMaps.relationships.push({
            type: 'references_type',
            source: filePath,
            target: targetFile,
            typeName: typeRef.name
          });
          break; // Found the source file for this type
        }
      }
    }
  }

  // Fourth pass: Build inheritance relationships
  for (const fileStructure of codeMaps.files) {
    for (const def of fileStructure.definitions) {
      // Handle class inheritance
      if (def.type === 'class' && def.extends) {
        // Find which file exports the parent class
        for (const [targetFile, exportedTypes] of Object.entries(exportedTypesByFile)) {
          if (targetFile !== fileStructure.path && exportedTypes.has(def.extends)) {
            codeMaps.relationships.push({
              type: 'inherits_from',
              source: fileStructure.path,
              target: targetFile,
              sourceType: def.name,
              targetType: def.extends
            });
            break;
          }
        }
      }

      // Handle interface extension
      if (def.type === 'interface' && def.extends && def.extends.length > 0) {
        for (const extendedInterface of def.extends) {
          // Find which file exports the extended interface
          for (const [targetFile, exportedTypes] of Object.entries(exportedTypesByFile)) {
            if (targetFile !== fileStructure.path && exportedTypes.has(extendedInterface)) {
              codeMaps.relationships.push({
                type: 'extends_interface',
                source: fileStructure.path,
                target: targetFile,
                sourceType: def.name,
                targetType: extendedInterface
              });
              break;
            }
          }
        }
      }
    }
  }

  return codeMaps;
}

module.exports = {
  parseFile,
  buildCodeMaps
};
