/**
 * Combined formatter module for formatting both code graph and code maps for LLM consumption
 */
const path = require('path');
const fileSystem = require('../simpleFileSystem');
const graphFormatter = require('../graph/formatter');
const codeMapsFormatter = require('../codemaps/formatter');

/**
 * Format combined code graph and code maps for LLM consumption
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeGraph - Code graph object
 * @param {Object} codeMaps - Code maps object
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeFileContents - Whether to include full file contents (default: false)
 * @param {Array} selectedPrompts - Array of selected prompt contents
 * @returns {string} - Formatted content for clipboard
 */
async function formatCombinedForLLM(selectedFiles, directoryTree, codeGraph, codeMaps, options = {}, selectedPrompts = []) {
  // Set default options
  const includeFileContents = options.includeFileContents !== undefined ? options.includeFileContents : false;
  let result = '';

  // Add directory tree
  result += '# Project Directory Structure\n\n';
  result += '```\n';
  result += fileSystem.formatDirectoryTree(directoryTree);
  result += '```\n\n';

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add code graph overview section
  result += '# Code Graph Overview\n\n';
  result += `Total Files: ${selectedFiles.length}\n`;
  result += `Total Nodes: ${codeGraph.nodes.length}\n`;
  result += `Total Relationships: ${codeGraph.edges.length}\n\n`;

  // Add node types breakdown
  const nodeTypes = {};
  for (const node of codeGraph.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }

  result += '## Node Types\n\n';
  for (const [type, count] of Object.entries(nodeTypes)) {
    result += `- ${type}: ${count}\n`;
  }
  result += '\n';

  // Add relationship types breakdown
  const edgeTypes = {};
  for (const edge of codeGraph.edges) {
    edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
  }

  result += '## Relationship Types\n\n';
  for (const [type, count] of Object.entries(edgeTypes)) {
    result += `- ${type}: ${count}\n`;
  }
  result += '\n';

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add file dependencies section
  result += '# File Dependencies\n\n';

  // Group dependencies by file
  const fileDependencies = new Map();

  for (const edge of codeGraph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);

      if (sourceNode && targetNode && sourceNode.type === 'file' && targetNode.type === 'file') {
        if (!fileDependencies.has(sourceNode.path)) {
          fileDependencies.set(sourceNode.path, []);
        }

        fileDependencies.get(sourceNode.path).push({
          path: targetNode.path,
          name: path.basename(targetNode.path)
        });
      }
    }
  }

  // Sort files by path
  const sortedFiles = Array.from(fileDependencies.keys()).sort();

  for (const filePath of sortedFiles) {
    const dependencies = fileDependencies.get(filePath);

    result += `## ${filePath}\n\n`;
    result += 'Dependencies:\n';

    if (dependencies.length > 0) {
      for (const dep of dependencies) {
        result += `- ${dep.name} (${dep.path})\n`;
      }
    } else {
      result += '- No dependencies\n';
    }

    result += '\n';
  }

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add function calls section
  result += '# Function Calls\n\n';

  // Group functions by their calls
  const functionCalls = new Map();

  for (const edge of codeGraph.edges) {
    if (edge.type === 'calls') {
      const sourceNode = codeGraph.nodes.find(node => node.id === edge.source);
      const targetNode = codeGraph.nodes.find(node => node.id === edge.target);

      if (sourceNode && targetNode) {
        if (!functionCalls.has(sourceNode.id)) {
          functionCalls.set(sourceNode.id, []);
        }

        functionCalls.get(sourceNode.id).push({
          id: targetNode.id,
          name: targetNode.label,
          path: targetNode.path,
          args: edge.args || '',
          line: edge.line,
          column: edge.column
        });
      }
    }
  }

  // Sort functions by name
  const sortedFunctions = Array.from(functionCalls.keys()).sort((a, b) => {
    const nodeA = codeGraph.nodes.find(node => node.id === a);
    const nodeB = codeGraph.nodes.find(node => node.id === b);
    return (nodeA?.label || '').localeCompare(nodeB?.label || '');
  });

  for (const functionId of sortedFunctions) {
    const functionNode = codeGraph.nodes.find(node => node.id === functionId);
    const calls = functionCalls.get(functionId);

    if (functionNode) {
      result += `## ${functionNode.label} (${functionNode.path})\n\n`;
      result += 'Calls:\n';

      if (calls.length > 0) {
        for (const call of calls) {
          result += `- ${call.name} (${call.path})`;
          if (call.line) {
            result += ` at line ${call.line}`;
            if (call.column) {
              result += `, column ${call.column}`;
            }
          }
          if (call.args) {
            result += ` with args: ${call.args}`;
          }
          result += '\n';
        }
      } else {
        result += '- No function calls\n';
      }

      result += '\n';
    }
  }

  // Add horizontal rule as separator
  result += '---\n\n';

  // Add code maps section
  result += '# Code Maps\n\n';
  result += 'This section provides a structural overview of the codebase, focusing on API-level information.\n\n';

  // Add file definitions section
  result += '## File Definitions\n\n';

  for (const file of codeMaps.files) {
    result += `### ${file.path}\n\n`;
    result += `**Language:** ${file.language}\n\n`;

    // Add package/namespace if available
    if (file.package) {
      result += `**Package:** ${file.package}\n\n`;
    }

    if (file.namespace) {
      result += `**Namespace:** ${file.namespace}\n\n`;
    }

    // Add imports
    if (file.imports && file.imports.length > 0) {
      result += '**Imports:**\n\n';

      for (const importItem of file.imports) {
        if (importItem.type === 'default') {
          result += `- Default import \`${importItem.name}\` from \`${importItem.source}\`\n`;
        } else if (importItem.type === 'named') {
          result += `- From \`${importItem.source}\`: ${importItem.names.map(name => `\`${name}\``).join(', ')}\n`;
        } else if (importItem.type === 'namespace') {
          result += `- Namespace import \`${importItem.name}\` from \`${importItem.source}\`\n`;
        } else if (importItem.type === 'commonjs') {
          result += `- CommonJS import \`${importItem.name}\` from \`${importItem.source}\`\n`;
        }
      }

      result += '\n';
    }

    // Add definitions
    if (file.definitions && file.definitions.length > 0) {
      result += '**Definitions:**\n\n';

      // Group definitions by type
      const definitionsByType = {};
      for (const def of file.definitions) {
        if (!definitionsByType[def.type]) {
          definitionsByType[def.type] = [];
        }
        definitionsByType[def.type].push(def);
      }

      // Classes
      if (definitionsByType.class) {
        result += '**Classes:**\n\n';
        for (const classDef of definitionsByType.class) {
          result += `- \`${classDef.name}\`${classDef.extends ? ` extends \`${classDef.extends}\`` : ''}\n`;
          
          // Methods
          if (classDef.methods && classDef.methods.length > 0) {
            result += '  **Methods:**\n';
            for (const method of classDef.methods) {
              result += `  - \`${method.name}(${method.params.join(', ')})\`\n`;
            }
          }
        }
        result += '\n';
      }

      // Interfaces
      if (definitionsByType.interface) {
        result += '**Interfaces:**\n\n';
        for (const interfaceDef of definitionsByType.interface) {
          result += `- \`${interfaceDef.name}\`${interfaceDef.extends ? ` extends \`${interfaceDef.extends}\`` : ''}\n`;
          
          // Properties
          if (interfaceDef.properties && interfaceDef.properties.length > 0) {
            result += '  **Properties:**\n';
            for (const prop of interfaceDef.properties) {
              result += `  - \`${prop.name}: ${prop.type || 'any'}\`\n`;
            }
          }
        }
        result += '\n';
      }

      // Functions
      if (definitionsByType.function) {
        result += '**Functions:**\n\n';
        for (const funcDef of definitionsByType.function) {
          result += `- \`${funcDef.name}(${funcDef.params.join(', ')})\`${funcDef.returnType ? `: ${funcDef.returnType}` : ''}\n`;
        }
        result += '\n';
      }

      // React Components
      const componentTypes = [
        'functional_component',
        'class_component',
        'pure_component',
        'memo_component',
        'forwardref_component'
      ];

      const hasComponents = componentTypes.some(type => definitionsByType[type] && definitionsByType[type].length > 0);

      if (hasComponents) {
        result += '**React Components:**\n\n';
        
        for (const type of componentTypes) {
          if (definitionsByType[type]) {
            for (const component of definitionsByType[type]) {
              result += `- \`${component.name}\` (${type.replace('_', ' ')})\n`;
              if (component.propsType) {
                result += `  - Props: \`${component.propsType}\`\n`;
              }
              if (component.exported) {
                result += `  - Exported: ${component.exported}\n`;
              }
            }
          }
        }
        
        result += '\n';
      }

      // React Hooks
      if (definitionsByType.hook) {
        result += '**React Hooks:**\n\n';
        for (const hook of definitionsByType.hook) {
          result += `- \`${hook.name}\`\n`;
          if (hook.exported) {
            result += `  - Exported: ${hook.exported}\n`;
          }
        }
        result += '\n';
      }
    }

    // Add type references
    if (file.typeReferences && file.typeReferences.length > 0) {
      result += '**Type References:**\n\n';

      for (const typeRef of file.typeReferences) {
        if (typeRef.module) {
          result += `- From \`${typeRef.module}\`: \`${typeRef.name}\`\n`;
        } else {
          result += `- Referenced types: \`${typeRef.name}\`\n`;
        }
      }

      result += '\n';
    }

    // Add public API
    if (file.publicAPI && file.publicAPI.length > 0) {
      result += '**Public API:**\n\n';

      // Group API by type
      const apiByType = {};
      for (const api of file.publicAPI) {
        if (!apiByType[api.type]) {
          apiByType[api.type] = [];
        }
        apiByType[api.type].push(api);
      }

      // Classes
      if (apiByType.class) {
        result += '- **Exported Classes:**\n';
        for (const cls of apiByType.class) {
          result += `  - \`${cls.name}\`\n`;
        }
      }

      // Interfaces
      if (apiByType.interface) {
        result += '- **Exported Interfaces:**\n';
        for (const intf of apiByType.interface) {
          result += `  - \`${intf.name}\`\n`;
        }
      }

      // Functions
      if (apiByType.function) {
        result += '- **Exported Functions:**\n';
        for (const func of apiByType.function) {
          result += `  - \`${func.name}\`\n`;
        }
      }

      // Methods
      if (apiByType.method) {
        result += '- **Public Methods:**\n';
        for (const method of apiByType.method) {
          result += `  - \`${method.className}.${method.name}(${method.params.join(', ')})\`\n`;
        }
      }

      result += '\n';
    }

    // Add exports
    if (file.exports && file.exports.length > 0) {
      result += '**Exports:**\n\n';

      for (const exportItem of file.exports) {
        if (exportItem.type === 'named') {
          result += `- Named export: \`${exportItem.name}\`\n`;
        } else if (exportItem.type === 'default') {
          result += `- Default export: \`${exportItem.name}\`\n`;
        } else if (exportItem.type === 'commonjs') {
          result += `- CommonJS export: \`${exportItem.name}\`\n`;
        }
      }

      result += '\n';
    }

    // Add horizontal rule as separator between files
    result += '---\n\n';
  }

  // Add file relationships section
  result += '## File Relationships\n\n';

  for (const file of codeMaps.files) {
    result += `### ${file.path}\n\n`;

    // Add import dependencies
    result += '**Import Dependencies:**\n\n';
    const importDeps = codeMaps.relationships.filter(rel => rel.source === file.path && rel.type === 'imports');
    
    if (importDeps.length > 0) {
      for (const dep of importDeps) {
        result += `- Imports from \`${dep.target}\`: ${dep.items.map(item => `\`${item}\``).join(', ')}\n`;
      }
    } else {
      result += '- No import dependencies\n';
    }
    
    result += '\n';

    // Add type references
    result += '**Type References:**\n\n';
    const typeRefs = codeMaps.relationships.filter(rel => rel.source === file.path && rel.type === 'references_type');
    
    if (typeRefs.length > 0) {
      for (const ref of typeRefs) {
        result += `- References type \`${ref.name}\` from \`${ref.target}\`\n`;
      }
    } else {
      result += '- No type references\n';
    }
    
    result += '\n';

    // Add horizontal rule as separator between files
    result += '---\n\n';
  }

  // Add file contents for selected files if requested
  if (includeFileContents) {
    result += '# Selected Files\n\n';

    for (const file of selectedFiles) {
      const content = await fileSystem.readFileContent(file.path);
      const extension = path.extname(file.path).substring(1); // Remove the dot

      // Add file path as heading
      result += `## ${file.path}\n\n`;

      // Add file content in fenced code block with language
      result += '```' + (extension || '') + '\n';
      result += content;

      // Ensure the code block ends with a newline
      if (!content.endsWith('\n')) {
        result += '\n';
      }

      result += '```\n\n';

      // Add horizontal rule as separator between files
      result += '---\n\n';
    }
  } else {
    // Add a note about file contents being excluded for token efficiency
    result += '# Note on Selected Files\n\n';
    result += 'Full file contents have been excluded to optimize token usage. ';
    result += 'This Combined view focuses on structural information, relationships, and API definitions only.\n\n';

    // List the selected files without their contents
    result += '## Selected Files (Structure Only)\n\n';
    for (const file of selectedFiles) {
      result += `- ${file.path}\n`;
    }

    result += '\n---\n\n';
  }

  // Add selected prompts if any exist
  if (selectedPrompts && selectedPrompts.length > 0) {
    result += '# INSTRUCTIONS\n\n';
    selectedPrompts.forEach(promptContent => {
      result += `${promptContent}\n\n`;
    });
    result += '---\n\n';
  }

  return result;
}

module.exports = {
  formatCombinedForLLM
};
