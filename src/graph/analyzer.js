/**
 * Code analyzer module for building a code graph
 * Analyzes relationships between code elements
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
          params: func.params || []
        });
        
        // Connect function to file
        addEdge({
          source: `${fileStructure.path}#${func.name}`,
          target: fileStructure.path,
          type: 'defined_in'
        });
      }
      
      // Add class nodes
      for (const cls of fileStructure.classes) {
        addNode({
          id: `${fileStructure.path}#${cls.name}`,
          type: 'class',
          label: cls.name,
          path: fileStructure.path,
          extends: cls.extends
        });
        
        // Connect class to file
        addEdge({
          source: `${fileStructure.path}#${cls.name}`,
          target: fileStructure.path,
          type: 'defined_in'
        });
        
        // Connect class to parent class if extends
        if (cls.extends) {
          // Note: This is a simplification. In a real implementation,
          // we would need to resolve the parent class across files.
          addEdge({
            source: `${fileStructure.path}#${cls.name}`,
            target: `${fileStructure.path}#${cls.extends}`,
            type: 'extends',
            virtual: true // Mark as virtual since we don't know if the parent exists
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
            type: 'imports'
          });
        }
      }
      
      // Analyze function calls (simplified)
      // In a real implementation, we would parse the function bodies
      // and detect calls to other functions
      
      // For demonstration, we'll add some random connections
      // between functions in different files
      if (fileStructure.functions.length > 0 && codeGraph.nodes.length > 5) {
        const functionNodes = codeGraph.nodes.filter(node => node.type === 'function');
        if (functionNodes.length > 1) {
          for (const func of fileStructure.functions) {
            // Randomly connect to another function
            const targetFunc = functionNodes[Math.floor(Math.random() * functionNodes.length)];
            if (targetFunc.id !== `${fileStructure.path}#${func.name}`) {
              addEdge({
                source: `${fileStructure.path}#${func.name}`,
                target: targetFunc.id,
                type: 'calls',
                virtual: true // Mark as virtual since this is just for demonstration
              });
            }
          }
        }
      }
    }
  }
  
  return codeGraph;
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
  const edgeId = `${edge.source}->${edge.target}:${edge.type}`;
  
  // Check if edge already exists
  if (!codeGraph.edges.some(e => e.id === edgeId)) {
    edge.id = edgeId;
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
      
      // Check if the file exists
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
      
      // Try adding .js extension
      if (fs.existsSync(`${resolvedPath}.js`)) {
        return `${resolvedPath}.js`;
      }
      
      // Try adding index.js
      if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
        return path.join(resolvedPath, 'index.js');
      }
    }
    
    // For non-relative paths, we would need to check node_modules
    // This is a simplified implementation
    return null;
  } catch (error) {
    console.error(`Error resolving import path ${importPath}:`, error.message);
    return null;
  }
}

/**
 * Get a subgraph centered around a specific node
 * @param {string} nodeId - Center node ID
 * @param {number} depth - Maximum depth of the subgraph
 * @returns {Object} - Subgraph
 */
function getSubgraph(nodeId, depth = 2) {
  const subgraph = {
    nodes: [],
    edges: []
  };
  
  // Add the center node
  const centerNode = codeGraph.nodes.find(node => node.id === nodeId);
  if (!centerNode) {
    return subgraph;
  }
  
  subgraph.nodes.push(centerNode);
  
  // BFS to add nodes and edges up to the specified depth
  const visited = new Set([nodeId]);
  const queue = [{ id: nodeId, depth: 0 }];
  
  while (queue.length > 0) {
    const { id, depth: currentDepth } = queue.shift();
    
    if (currentDepth >= depth) {
      continue;
    }
    
    // Find all edges connected to this node
    const connectedEdges = codeGraph.edges.filter(
      edge => edge.source === id || edge.target === id
    );
    
    for (const edge of connectedEdges) {
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
 * Get all function calls for a specific function
 * @param {string} functionId - Function node ID
 * @returns {Array} - Array of function calls
 */
function getFunctionCalls(functionId) {
  // Find all outgoing edges of type 'calls'
  return codeGraph.edges
    .filter(edge => edge.source === functionId && edge.type === 'calls')
    .map(edge => {
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);
      return {
        source: functionId,
        target: edge.target,
        targetName: targetNode ? targetNode.label : 'Unknown',
        targetPath: targetNode ? targetNode.path : 'Unknown'
      };
    });
}

/**
 * Get all callers of a specific function
 * @param {string} functionId - Function node ID
 * @returns {Array} - Array of function callers
 */
function getFunctionCallers(functionId) {
  // Find all incoming edges of type 'calls'
  return codeGraph.edges
    .filter(edge => edge.target === functionId && edge.type === 'calls')
    .map(edge => {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      return {
        source: edge.source,
        sourceName: sourceNode ? sourceNode.label : 'Unknown',
        sourcePath: sourceNode ? sourceNode.path : 'Unknown',
        target: functionId
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
        targetName: targetNode ? path.basename(targetNode.path) : 'Unknown'
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
        target: filePath
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
