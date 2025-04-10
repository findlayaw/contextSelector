/**
 * CodeMaps formatter module for formatting code maps for LLM consumption
 */
const path = require('path');
const fileSystem = require('../simpleFileSystem');

/**
 * Format code maps for LLM consumption
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeMaps - Code maps object
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeFileContents - Whether to include full file contents (default: false)
 * @param {Array} selectedPrompts - Array of selected prompt contents
 * @returns {string} - Formatted content for clipboard
 */
async function formatCodeMapsForLLM(selectedFiles, directoryTree, codeMaps, options = {}, selectedPrompts = []) {
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
        if (importItem.type === 'named' && importItem.names) {
          result += `- From \`${importItem.source}\`: ${importItem.names.join(', ')}\n`;
        } else if (importItem.type === 'default' && importItem.name) {
          result += `- Default import \`${importItem.name}\` from \`${importItem.source}\`\n`;
        } else if (importItem.type === 'commonjs' && importItem.name) {
          result += `- CommonJS require \`${importItem.name}\` from \`${importItem.source}\`\n`;
        } else if (importItem.type === 'commonjs_destructured' && importItem.names) {
          result += `- CommonJS destructured from \`${importItem.source}\`: ${importItem.names.join(', ')}\n`;
        } else if (importItem.type === 'from' && importItem.items) {
          result += `- From \`${importItem.module}\`: ${importItem.items.join(', ')}\n`;
        } else if (importItem.type === 'import' && importItem.module) {
          result += `- Import \`${importItem.module}\`\n`;
        } else if (importItem.type === 'using' || importItem.type === 'import') {
          result += `- Using \`${importItem.path}\`\n`;
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

      // Add classes
      if (definitionsByType.class) {
        result += '**Classes:**\n\n';

        for (const cls of definitionsByType.class) {
          result += `- \`${cls.name}\``;

          // Add export status
          if (cls.isExported) {
            result += ' (exported)';
          }

          if (cls.extends) {
            result += ` extends \`${cls.extends}\``;
          }

          if (cls.implements && cls.implements.length > 0) {
            result += ` implements ${cls.implements.map(i => `\`${i}\``).join(', ')}`;
          }

          if (cls.inherits && cls.inherits.length > 0) {
            result += ` inherits from ${cls.inherits.map(i => `\`${i}\``).join(', ')}`;
          }

          if (cls.inheritance && cls.inheritance.length > 0) {
            result += ` inherits from ${cls.inheritance.map(i => `\`${i}\``).join(', ')}`;
          }

          result += '\n';

          // Add methods if available
          if (cls.methods && cls.methods.length > 0) {
            for (const method of cls.methods) {
              result += `  - Method \`${method.name}(${method.params.join(', ')})\``;

              // Add access level if available
              if (method.accessLevel) {
                result += ` (${method.accessLevel})`;
              }

              result += '\n';
            }
          }
        }

        result += '\n';
      }

      // Add interfaces
      if (definitionsByType.interface) {
        result += '**Interfaces:**\n\n';

        for (const iface of definitionsByType.interface) {
          result += `- \`${iface.name}\``;

          // Add export status
          if (iface.isExported) {
            result += ' (exported)';
          }

          if (iface.extends && iface.extends.length > 0) {
            result += ` extends ${iface.extends.map(i => `\`${i}\``).join(', ')}`;
          }

          if (iface.inheritance && iface.inheritance.length > 0) {
            result += ` inherits from ${iface.inheritance.map(i => `\`${i}\``).join(', ')}`;
          }

          result += '\n';
        }

        result += '\n';
      }

      // Add functions
      if (definitionsByType.function || definitionsByType.arrow_function) {
        result += '**Functions:**\n\n';

        // Regular functions
        if (definitionsByType.function) {
          for (const func of definitionsByType.function) {
            result += `- \`${func.name}(${func.params.join(', ')})\``;

            if (func.isGenerator) {
              result += ' (generator)';
            }

            if (func.returnType) {
              result += ` -> ${func.returnType}`;
            }

            // Add export status
            if (func.isExported) {
              result += ' (exported)';
            }

            result += '\n';
          }
        }

        // Arrow functions
        if (definitionsByType.arrow_function) {
          for (const func of definitionsByType.arrow_function) {
            result += `- \`${func.name}(${func.params.join(', ')})\` (arrow function)`;

            // Add export status
            if (func.isExported) {
              result += ' (exported)';
            }

            result += '\n';
          }
        }

        result += '\n';
      }

      // Add methods not associated with classes
      if (definitionsByType.method) {
        const standaloneMethods = definitionsByType.method.filter(m => !m.className);

        if (standaloneMethods.length > 0) {
          result += '**Methods:**\n\n';

          for (const method of standaloneMethods) {
            result += `- \`${method.name}(${method.params.join(', ')})\``;

            if (method.returnType) {
              result += ` -> ${method.returnType}`;
            }

            // Add access level if available
            if (method.accessLevel) {
              result += ` (${method.accessLevel})`;
            }

            result += '\n';
          }

          result += '\n';
        }
      }
    }

    // Add enums
    if (file.enums && file.enums.length > 0) {
      result += '**Enums:**\n\n';

      for (const enumDef of file.enums) {
        result += `- \`${enumDef.name}\``;

        if (enumDef.isConst) {
          result += ' (const)';
        }

        if (enumDef.isExported) {
          result += ' (exported)';
        }

        result += '\n';

        // Add enum members
        if (enumDef.members && enumDef.members.length > 0) {
          for (const member of enumDef.members) {
            if (member.value) {
              result += `  - \`${member.name} = ${member.value}\`\n`;
            } else {
              result += `  - \`${member.name}\`\n`;
            }
          }
        }
      }

      result += '\n';
    }

    // Add type references
    if (file.typeReferences && file.typeReferences.length > 0) {
      result += '**Type References:**\n\n';

      // Group by module if available
      const refsByModule = {};
      for (const ref of file.typeReferences) {
        const module = ref.module || 'unknown';
        if (!refsByModule[module]) {
          refsByModule[module] = [];
        }
        refsByModule[module].push(ref.name);
      }

      for (const [module, types] of Object.entries(refsByModule)) {
        if (module === 'unknown') {
          result += `- Referenced types: ${types.map(t => `\`${t}\``).join(', ')}\n`;
        } else {
          result += `- From \`${module}\`: ${types.map(t => `\`${t}\``).join(', ')}\n`;
        }
      }

      result += '\n';
    }

    // Add public API surface
    if (file.publicAPI && file.publicAPI.length > 0) {
      result += '**Public API:**\n\n';

      // Group by type
      const apiByType = {};
      for (const api of file.publicAPI) {
        if (!apiByType[api.type]) {
          apiByType[api.type] = [];
        }
        apiByType[api.type].push(api);
      }

      // Classes
      if (apiByType.class) {
        result += '- **Exported Classes:** ';
        result += apiByType.class.map(c => `\`${c.name}\``).join(', ');
        result += '\n';
      }

      // Interfaces
      if (apiByType.interface) {
        result += '- **Exported Interfaces:** ';
        result += apiByType.interface.map(i => `\`${i.name}\``).join(', ');
        result += '\n';
      }

      // Functions
      if (apiByType.function) {
        result += '- **Exported Functions:** ';
        result += apiByType.function.map(f => `\`${f.name}\``).join(', ');
        result += '\n';
      }

      // Type aliases
      if (apiByType.type_alias) {
        result += '- **Exported Type Aliases:** ';
        result += apiByType.type_alias.map(t => `\`${t.name}\``).join(', ');
        result += '\n';
      }

      // Enums
      if (apiByType.enum) {
        result += '- **Exported Enums:** ';
        result += apiByType.enum.map(e => `\`${e.name}\``).join(', ');
        result += '\n';
      }

      // Properties
      if (apiByType.property) {
        result += '- **Public Properties:**\n';
        for (const prop of apiByType.property) {
          result += `  - \`${prop.className}.${prop.name}\``;
          if (prop.dataType) {
            result += `: ${prop.dataType}`;
          }
          result += '\n';
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

  // Add relationships section
  if (codeMaps.relationships && codeMaps.relationships.length > 0) {
    result += '## File Relationships\n\n';

    // Group relationships by source file
    const relationshipsBySource = {};

    for (const rel of codeMaps.relationships) {
      if (!relationshipsBySource[rel.source]) {
        relationshipsBySource[rel.source] = [];
      }
      relationshipsBySource[rel.source].push(rel);
    }

    // Add relationships for each source file
    for (const [source, relationships] of Object.entries(relationshipsBySource)) {
      result += `### ${source}\n\n`;

      // Group relationships by type
      const relsByType = {
        imports: [],
        references_type: [],
        inherits_from: [],
        extends_interface: []
      };

      for (const rel of relationships) {
        if (relsByType[rel.type]) {
          relsByType[rel.type].push(rel);
        } else {
          relsByType.other = relsByType.other || [];
          relsByType.other.push(rel);
        }
      }

      // Import dependencies
      if (relsByType.imports.length > 0) {
        result += '**Import Dependencies:**\n\n';

        for (const rel of relsByType.imports) {
          result += `- Imports from \`${rel.target}\``;

          if (rel.items && rel.items.length > 0) {
            result += `: ${rel.items.join(', ')}`;
          }

          result += '\n';
        }

        result += '\n';
      }

      // Type references
      if (relsByType.references_type.length > 0) {
        result += '**Type References:**\n\n';

        for (const rel of relsByType.references_type) {
          result += `- References type \`${rel.typeName}\` from \`${rel.target}\`\n`;
        }

        result += '\n';
      }

      // Class inheritance
      if (relsByType.inherits_from.length > 0) {
        result += '**Class Inheritance:**\n\n';

        for (const rel of relsByType.inherits_from) {
          result += `- Class \`${rel.sourceType}\` inherits from \`${rel.targetType}\` in \`${rel.target}\`\n`;
        }

        result += '\n';
      }

      // Interface extension
      if (relsByType.extends_interface.length > 0) {
        result += '**Interface Extensions:**\n\n';

        for (const rel of relsByType.extends_interface) {
          result += `- Interface \`${rel.sourceType}\` extends \`${rel.targetType}\` from \`${rel.target}\`\n`;
        }

        result += '\n';
      }

      // Other relationships
      if (relsByType.other && relsByType.other.length > 0) {
        result += '**Other Relationships:**\n\n';

        for (const rel of relsByType.other) {
          result += `- ${rel.type} \`${rel.target}\`\n`;
        }

        result += '\n';
      }
    }

    // Add horizontal rule as separator
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
    result += 'This Code Maps view focuses on structural information and API definitions only.\n\n';

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
  formatCodeMapsForLLM
};
