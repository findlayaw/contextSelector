/**
 * Enhanced code analyzer module for building a code graph
 * Analyzes relationships between code elements using AST
 */
const fs = require('fs');
const path = require('path');
const parser = require('./parser');

// Store the code graph
let codeGraph = {
  nodes: [],
  edges: []
};

/**
 * Initialize the code graph
 */
function initGraph() {
  codeGraph = {
    nodes: [],
    edges: []
  };
}

/**
 * Build a code graph from selected files
 * @param {Array} selectedFiles - Array of selected file objects
 * @returns {Object} - Code graph
 */
function buildCodeGraph(selectedFiles) {
  initGraph();
  
  // First pass: Parse all files and create nodes
  for (const file of selectedFiles) {
    const fileStructure = parser.parseFile(file.path);
    if (fileStructure) {
      // Add file node
      addNode({
        id: fileStructure.path,
        type: 'file',
        label: path.basename(fileStructure.path),
        path: fileStructure.path,
        language: fileStructure.language
      });
      
      // Add function nodes
      for (const func of fileStructure.functions) {
        addNode({
          id: `${fileStructure.path}#${func.name}`,
          type: 'function',
          label: func.name,
          path: fileStructure.path,
          params: func.params || [],
          functionType: func.type, // 'function', 'arrow', or 'method'
          className: func.className, // For methods
          line: func.line,
          column: func.column
        });
        
        // Connect function to file
        addEdge({
          source: `${fileStructure.path}#${func.name}`,
          target: fileStructure.path,
          type: 'defined_in'
        });
        
        // If it's a method, connect it to its class
        if (func.type === 'method' && func.className) {
          addEdge({
            source: `${fileStructure.path}#${func.name}`,
            target: `${fileStructure.path}#${func.className}`,
            type: 'member_of'
          });
        }
      }
      
      // Add class nodes
      for (const cls of fileStructure.classes) {
        addNode({
          id: `${fileStructure.path}#${cls.name}`,
          type: 'class',
          label: cls.name,
          path: fileStructure.path,
          extends: cls.extends,
          methods: cls.methods || [],
          properties: cls.properties || [],
          line: cls.line,
          column: cls.column
        });
        
        // Connect class to file
        addEdge({
          source: `${fileStructure.path}#${cls.name}`,
          target: fileStructure.path,
          type: 'defined_in'
        });
        
        // Connect class to parent class if extends
        if (cls.extends) {
          // Try to find the parent class in the parsed files
          const parentClassNode = findClassByName(cls.extends, selectedFiles);
          if (parentClassNode) {
            addEdge({
              source: `${fileStructure.path}#${cls.name}`,
              target: parentClassNode,
              type: 'extends'
            });
          } else {
            // If parent class not found, create a virtual node
            addEdge({
              source: `${fileStructure.path}#${cls.name}`,
              target: `${fileStructure.path}#${cls.extends}`,
              type: 'extends',
              virtual: true // Mark as virtual since we don't know if the parent exists
            });
          }
        }
      }
      
      // Add variable nodes for important variables
      for (const variable of fileStructure.variables) {
        // Only add variables that are constants or have complex values
        if (variable.kind === 'const' || 
            (variable.valueType && 
             ['object', 'array', 'function', 'arrow_function', 'class'].includes(variable.valueType))) {
          addNode({
            id: `${fileStructure.path}#${variable.name}`,
            type: 'variable',
            label: variable.name,
            path: fileStructure.path,
            kind: variable.kind,
            valueType: variable.valueType,
            line: variable.line,
            column: variable.column
          });
          
          // Connect variable to file
          addEdge({
            source: `${fileStructure.path}#${variable.name}`,
            target: fileStructure.path,
            type: 'defined_in'
          });
        }
      }
    }
  }
  
  // Second pass: Analyze relationships between nodes
  for (const file of selectedFiles) {
    const fileStructure = parser.parseFile(file.path);
    if (fileStructure) {
      // Connect imports
      for (const imp of fileStructure.imports) {
        // Try to resolve the import path to an actual file
        const resolvedPath = resolveImportPath(file.path, imp.path);
        if (resolvedPath && codeGraph.nodes.some(node => node.id === resolvedPath)) {
          addEdge({
            source: fileStructure.path,
            target: resolvedPath,
            type: 'imports',
            importName: imp.name
          });
          
          // If the import is a named import, try to connect to the specific exported symbol
          if (imp.name && imp.name !== '*') {
            const targetNode = codeGraph.nodes.find(node => 
              node.path === resolvedPath && 
              (node.label === imp.name || node.name === imp.name)
            );
            
            if (targetNode) {
              addEdge({
                source: fileStructure.path,
                target: targetNode.id,
                type: 'imports_symbol',
                importName: imp.name
              });
            }
          }
        }
      }
      
      // Analyze method calls
      for (const call of fileStructure.methodCalls) {
        // Find the containing function
        let sourceNodeId = fileStructure.path; // Default to file level
        
        if (call.containingFunction) {
          sourceNodeId = `${fileStructure.path}#${call.containingFunction}`;
        }
        
        // Try to find the target function or method
        let targetNodeId = null;
        
        if (call.objectName) {
          // It's a method call on an object
          // First, check if it's a method call on a class instance
          const classNodes = codeGraph.nodes.filter(node => node.type === 'class');
          
          for (const classNode of classNodes) {
            if (classNode.methods && classNode.methods.includes(call.name)) {
              // Found a class with this method
              // Now check if the object is an instance of this class
              // This is a simplification - in a real implementation, we would need
              // to track variable types and class instances
              targetNodeId = `${classNode.path}#${call.name}`;
              break;
            }
          }
          
          // If not found as a class method, check if it's a call on an imported module
          if (!targetNodeId) {
            const importedModules = fileStructure.imports.filter(imp => 
              imp.name === call.objectName
            );
            
            if (importedModules.length > 0) {
              const importedModule = importedModules[0];
              const resolvedPath = resolveImportPath(file.path, importedModule.path);
              
              if (resolvedPath) {
                // Look for the function in the imported module
                const targetFunc = codeGraph.nodes.find(node => 
                  node.path === resolvedPath && 
                  node.type === 'function' && 
                  node.label === call.name
                );
                
                if (targetFunc) {
                  targetNodeId = targetFunc.id;
                }
              }
            }
          }
        } else {
          // It's a direct function call
          // First, check if it's a call to a function in the same file
          const sameFileFunc = codeGraph.nodes.find(node => 
            node.path === fileStructure.path && 
            node.type === 'function' && 
            node.label === call.name
          );
          
          if (sameFileFunc) {
            targetNodeId = sameFileFunc.id;
          } else {
            // Check if it's a call to an imported function
            const importedFuncs = codeGraph.nodes.filter(node => 
              node.type === 'function' && 
              node.label === call.name
            );
            
            if (importedFuncs.length > 0) {
              // Check if the file imports the module containing this function
              for (const func of importedFuncs) {
                const funcFilePath = func.path;
                
                if (fileStructure.imports.some(imp => {
                  const resolvedPath = resolveImportPath(file.path, imp.path);
                  return resolvedPath === funcFilePath;
                })) {
                  targetNodeId = func.id;
                  break;
                }
              }
            }
          }
        }
        
        // Add the edge if we found a target
        if (targetNodeId) {
          addEdge({
            source: sourceNodeId,
            target: targetNodeId,
            type: 'calls',
            line: call.line,
            column: call.column,
            args: call.args.map(arg => arg.text).join(', ')
          });
        }
      }
    }
  }
  
  return codeGraph;
}

/**
 * Find a class node by name across all files
 * @param {string} className - Class name to find
 * @param {Array} selectedFiles - Array of selected file objects
 * @returns {string|null} - Class node ID or null if not found
 */
function findClassByName(className, selectedFiles) {
  for (const node of codeGraph.nodes) {
    if (node.type === 'class' && node.label === className) {
      return node.id;
    }
  }
  
  return null;
}

/**
 * Add a node to the graph
 * @param {Object} node - Node object
 */
function addNode(node) {
  // Check if node already exists
  if (!codeGraph.nodes.some(n => n.id === node.id)) {
    codeGraph.nodes.push(node);
  }
}

/**
 * Add an edge to the graph
 * @param {Object} edge - Edge object
 */
function addEdge(edge) {
  // Generate a unique ID for the edge
  const edgeId = `${edge.source}=>${edge.target}:${edge.type}`;
  edge.id = edgeId;
  
  // Check if edge already exists
  if (!codeGraph.edges.some(e => e.id === edgeId)) {
    codeGraph.edges.push(edge);
  }
}

/**
 * Resolve an import path to an actual file path
 * @param {string} sourcePath - Source file path
 * @param {string} importPath - Import path
 * @returns {string|null} - Resolved file path or null if not found
 */
function resolveImportPath(sourcePath, importPath) {
  try {
    // Handle relative paths
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const sourceDir = path.dirname(sourcePath);
      let resolvedPath = path.resolve(sourceDir, importPath);
      
      // Check if the path exists as is
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
      
      // Try adding .js extension
      if (fs.existsSync(resolvedPath + '.js')) {
        return resolvedPath + '.js';
      }
      
      // Try adding /index.js
      if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
        return path.join(resolvedPath, 'index.js');
      }
    } else {
      // Handle non-relative paths (node_modules, etc.)
      // This is a simplification - in a real implementation, we would need
      // to resolve node_modules paths properly
      
      // For now, just check if any of the parsed files match the import name
      const fileName = path.basename(importPath);
      
      for (const node of codeGraph.nodes) {
        if (node.type === 'file' && path.basename(node.path) === fileName) {
          return node.path;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error resolving import path ${importPath} from ${sourcePath}:`, error.message);
    return null;
  }
}

/**
 * Get a subgraph centered around a specific node
 * @param {string} nodeId - Center node ID
 * @param {number} depth - Maximum depth to traverse
 * @returns {Object} - Subgraph
 */
function getSubgraph(nodeId, depth = 1) {
  const subgraph = {
    nodes: [],
    edges: []
  };
  
  // Find the center node
  const centerNode = codeGraph.nodes.find(node => node.id === nodeId);
  if (!centerNode) {
    return subgraph;
  }
  
  // Add the center node
  subgraph.nodes.push(centerNode);
  
  // Traverse the graph to the specified depth
  const visited = new Set([nodeId]);
  const queue = [{ id: nodeId, depth: 0 }];
  
  while (queue.length > 0) {
    const { id, depth: currentDepth } = queue.shift();
    
    if (currentDepth >= depth) {
      continue;
    }
    
    // Find all edges connected to this node
    const connectedEdges = codeGraph.edges.filter(edge => 
      edge.source === id || edge.target === id
    );
    
    for (const edge of connectedEdges) {
      // Add the edge to the subgraph
      subgraph.edges.push(edge);
      
      // Add the connected node if not visited
      const connectedId = edge.source === id ? edge.target : edge.source;
      
      if (!visited.has(connectedId)) {
        visited.add(connectedId);
        
        const connectedNode = codeGraph.nodes.find(node => node.id === connectedId);
        if (connectedNode) {
          subgraph.nodes.push(connectedNode);
          queue.push({ id: connectedId, depth: currentDepth + 1 });
        }
      }
    }
  }
  
  return subgraph;
}

/**
 * Get all function calls made by a function
 * @param {string} functionId - Function ID
 * @returns {Array} - Array of function calls
 */
function getFunctionCalls(functionId) {
  return codeGraph.edges
    .filter(edge => edge.source === functionId && edge.type === 'calls')
    .map(edge => {
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);
      return {
        source: functionId,
        target: edge.target,
        targetName: targetNode ? targetNode.label : 'Unknown',
        args: edge.args || '',
        line: edge.line,
        column: edge.column
      };
    });
}

/**
 * Get all functions that call a function
 * @param {string} functionId - Function ID
 * @returns {Array} - Array of function callers
 */
function getFunctionCallers(functionId) {
  return codeGraph.edges
    .filter(edge => edge.target === functionId && edge.type === 'calls')
    .map(edge => {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      return {
        source: edge.source,
        sourceName: sourceNode ? sourceNode.label : 'Unknown',
        target: functionId,
        args: edge.args || '',
        line: edge.line,
        column: edge.column
      };
    });
}

/**
 * Get all dependencies of a file
 * @param {string} filePath - File path
 * @returns {Array} - Array of dependencies
 */
function getFileDependencies(filePath) {
  // Find all outgoing edges of type 'imports'
  return codeGraph.edges
    .filter(edge => edge.source === filePath && edge.type === 'imports')
    .map(edge => {
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);
      return {
        source: filePath,
        target: edge.target,
        targetName: targetNode ? path.basename(targetNode.path) : 'Unknown',
        importName: edge.importName || '*'
      };
    });
}

/**
 * Get all dependents of a file
 * @param {string} filePath - File path
 * @returns {Array} - Array of dependents
 */
function getFileDependents(filePath) {
  // Find all incoming edges of type 'imports'
  return codeGraph.edges
    .filter(edge => edge.target === filePath && edge.type === 'imports')
    .map(edge => {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      return {
        source: edge.source,
        sourceName: sourceNode ? path.basename(sourceNode.path) : 'Unknown',
        target: filePath,
        importName: edge.importName || '*'
      };
    });
}

module.exports = {
  buildCodeGraph,
  getSubgraph,
  getFunctionCalls,
  getFunctionCallers,
  getFileDependencies,
  getFileDependents
};
