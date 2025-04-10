const path = require('path');
const fileSystem = require('../simpleFileSystem');

/**
 * Format code maps for LLM consumption in XML format
 * @param {Array} selectedFiles - Array of selected file objects
 * @param {Object} directoryTree - Directory tree object
 * @param {Object} codeMaps - Code maps object
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeFileContents - Whether to include full file contents (default: false)
 * @param {Array} selectedPrompts - Array of selected prompt contents
 * @returns {string} - Formatted content for clipboard in XML format
 */
async function formatCodeMapsForLLM(selectedFiles, directoryTree, codeMaps, options = {}, selectedPrompts = []) {
  // Set default options
  const includeFileContents = options.includeFileContents !== undefined ? options.includeFileContents : false;
  let result = '';

  // Add XML header
  result += '<?xml version="1.0" encoding="UTF-8"?>\n';
  result += '<context>\n';

  // Add directory tree
  result += '  <directory_structure>\n';
  result += '    <![CDATA[\n';
  result += fileSystem.formatDirectoryTree(directoryTree);
  result += '    ]]>\n';
  result += '  </directory_structure>\n\n';

  // Add code maps section
  result += '  <code_maps>\n';

  // Add file definitions
  result += '    <file_definitions>\n';
  for (const file of codeMaps.files) {
    result += '      <file>\n';
    result += `        <path>${escapeXml(file.path)}</path>\n`;
    result += `        <language>${escapeXml(file.language)}</language>\n`;

    // Add package/namespace if available
    if (file.package) {
      result += `        <package>${escapeXml(file.package)}</package>\n`;
    }

    if (file.namespace) {
      result += `        <namespace>${escapeXml(file.namespace)}</namespace>\n`;
    }

    // Add imports
    if (file.imports && file.imports.length > 0) {
      result += '        <imports>\n';
      for (const imp of file.imports) {
        result += '          <import>\n';
        if (imp.path) {
          result += `            <path>${escapeXml(imp.path)}</path>\n`;
        } else if (imp.source) {
          result += `            <source>${escapeXml(imp.source)}</source>\n`;
        } else if (imp.module) {
          result += `            <module>${escapeXml(imp.module)}</module>\n`;
        }

        if (imp.type) {
          result += `            <type>${escapeXml(imp.type)}</type>\n`;
        }

        if (imp.name) {
          result += `            <name>${escapeXml(imp.name)}</name>\n`;
        }

        if (imp.names && imp.names.length > 0) {
          result += '            <names>\n';
          for (const name of imp.names) {
            result += `              <name>${escapeXml(name)}</name>\n`;
          }
          result += '            </names>\n';
        }

        if (imp.items && imp.items.length > 0) {
          result += '            <items>\n';
          for (const item of imp.items) {
            result += `              <item>${escapeXml(item)}</item>\n`;
          }
          result += '            </items>\n';
        }
        result += '          </import>\n';
      }
      result += '        </imports>\n';
    }

    // Add enums
    if (file.enums && file.enums.length > 0) {
      result += '        <enums>\n';
      for (const enumDef of file.enums) {
        result += '          <enum>\n';
        result += `            <name>${escapeXml(enumDef.name)}</name>\n`;

        if (enumDef.isConst) {
          result += '            <is_const>true</is_const>\n';
        }

        if (enumDef.isExported) {
          result += '            <is_exported>true</is_exported>\n';
        }

        if (enumDef.members && enumDef.members.length > 0) {
          result += '            <members>\n';
          for (const member of enumDef.members) {
            result += '              <member>\n';
            result += `                <name>${escapeXml(member.name)}</name>\n`;
            if (member.value) {
              result += `                <value>${escapeXml(member.value)}</value>\n`;
            }
            result += '              </member>\n';
          }
          result += '            </members>\n';
        }

        result += '          </enum>\n';
      }
      result += '        </enums>\n';
    }

    // Add React components
    const componentTypes = [
      'functional_component',
      'class_component',
      'pure_component',
      'memo_component',
      'forwardref_component'
    ];

    // Check if file has any React components
    let hasComponents = false;
    if (!file.definitions) {
      // Create an empty definitions array to prevent errors
      file.definitions = [];
    }

    for (const type of componentTypes) {
      if (file.definitions.some(def => def.type === type)) {
        hasComponents = true;
        break;
      }
    }

    if (hasComponents) {
      result += '        <react_components>\n';

      // Group components by type
      const componentsByType = {};
      for (const def of file.definitions) {
        if (componentTypes.includes(def.type)) {
          if (!componentsByType[def.type]) {
            componentsByType[def.type] = [];
          }
          componentsByType[def.type].push(def);
        }
      }

      // Functional components
      if (componentsByType.functional_component) {
        result += '          <functional_components>\n';
        for (const comp of componentsByType.functional_component) {
          result += '            <component>\n';
          result += `              <name>${escapeXml(comp.name)}</name>\n`;
          result += `              <style>${escapeXml(comp.style || 'function')}</style>\n`;

          if (comp.isExported) {
            result += '              <is_exported>true</is_exported>\n';
          }

          if (comp.propsType) {
            result += `              <props_type>${escapeXml(comp.propsType)}</props_type>\n`;
          }

          result += '            </component>\n';
        }
        result += '          </functional_components>\n';
      }

      // Class components
      if (componentsByType.class_component) {
        result += '          <class_components>\n';
        for (const comp of componentsByType.class_component) {
          result += '            <component>\n';
          result += `              <name>${escapeXml(comp.name)}</name>\n`;

          if (comp.isExported) {
            result += '              <is_exported>true</is_exported>\n';
          }

          if (comp.propsType) {
            result += `              <props_type>${escapeXml(comp.propsType)}</props_type>\n`;
          }

          result += '            </component>\n';
        }
        result += '          </class_components>\n';
      }

      // Pure components
      if (componentsByType.pure_component) {
        result += '          <pure_components>\n';
        for (const comp of componentsByType.pure_component) {
          result += '            <component>\n';
          result += `              <name>${escapeXml(comp.name)}</name>\n`;

          if (comp.isExported) {
            result += '              <is_exported>true</is_exported>\n';
          }

          if (comp.propsType) {
            result += `              <props_type>${escapeXml(comp.propsType)}</props_type>\n`;
          }

          result += '            </component>\n';
        }
        result += '          </pure_components>\n';
      }

      // Memo components
      if (componentsByType.memo_component) {
        result += '          <memo_components>\n';
        for (const comp of componentsByType.memo_component) {
          result += '            <component>\n';
          result += `              <name>${escapeXml(comp.name)}</name>\n`;

          if (comp.isExported) {
            result += '              <is_exported>true</is_exported>\n';
          }

          if (comp.propsType) {
            result += `              <props_type>${escapeXml(comp.propsType)}</props_type>\n`;
          }

          result += '            </component>\n';
        }
        result += '          </memo_components>\n';
      }

      // ForwardRef components
      if (componentsByType.forwardref_component) {
        result += '          <forwardref_components>\n';
        for (const comp of componentsByType.forwardref_component) {
          result += '            <component>\n';
          result += `              <name>${escapeXml(comp.name)}</name>\n`;

          if (comp.isExported) {
            result += '              <is_exported>true</is_exported>\n';
          }

          if (comp.propsType) {
            result += `              <props_type>${escapeXml(comp.propsType)}</props_type>\n`;
          }

          result += '            </component>\n';
        }
        result += '          </forwardref_components>\n';
      }

      result += '        </react_components>\n';
    }

    // Add React hooks
    const hooks = file.definitions ? file.definitions.filter(def => def.type === 'hook') : [];
    if (hooks.length > 0) {
      result += '        <react_hooks>\n';
      for (const hook of hooks) {
        result += '          <hook>\n';
        result += `            <name>${escapeXml(hook.name)}</name>\n`;

        if (hook.isExported) {
          result += '            <is_exported>true</is_exported>\n';
        }

        result += '          </hook>\n';
      }
      result += '        </react_hooks>\n';
    }

    // Add type references
    if (file.typeReferences && file.typeReferences.length > 0) {
      result += '        <type_references>\n';
      for (const typeRef of file.typeReferences) {
        result += '          <type_reference>\n';
        result += `            <name>${escapeXml(typeRef.name)}</name>\n`;
        if (typeRef.module) {
          result += `            <module>${escapeXml(typeRef.module)}</module>\n`;
        }
        result += '          </type_reference>\n';
      }
      result += '        </type_references>\n';
    }

    // Add public API
    if (file.publicAPI && file.publicAPI.length > 0) {
      result += '        <public_api>\n';

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
        result += '          <classes>\n';
        for (const cls of apiByType.class) {
          result += `            <class>${escapeXml(cls.name)}</class>\n`;
        }
        result += '          </classes>\n';
      }

      // Interfaces
      if (apiByType.interface) {
        result += '          <interfaces>\n';
        for (const iface of apiByType.interface) {
          result += `            <interface>${escapeXml(iface.name)}</interface>\n`;
        }
        result += '          </interfaces>\n';
      }

      // Functions
      if (apiByType.function) {
        result += '          <functions>\n';
        for (const func of apiByType.function) {
          result += `            <function>${escapeXml(func.name)}</function>\n`;
        }
        result += '          </functions>\n';
      }

      // Type aliases
      if (apiByType.type_alias) {
        result += '          <type_aliases>\n';
        for (const typeAlias of apiByType.type_alias) {
          result += '            <type_alias>\n';
          result += `              <name>${escapeXml(typeAlias.name)}</name>\n`;
          result += `              <value>${escapeXml(typeAlias.value)}</value>\n`;
          result += '            </type_alias>\n';
        }
        result += '          </type_aliases>\n';
      }

      // Enums
      if (apiByType.enum) {
        result += '          <enums>\n';
        for (const enumDef of apiByType.enum) {
          result += '            <enum>\n';
          result += `              <name>${escapeXml(enumDef.name)}</name>\n`;
          if (enumDef.members && enumDef.members.length > 0) {
            result += '              <members>\n';
            for (const member of enumDef.members) {
              result += `                <member>${escapeXml(member)}</member>\n`;
            }
            result += '              </members>\n';
          }
          result += '            </enum>\n';
        }
        result += '          </enums>\n';
      }

      // Properties
      if (apiByType.property) {
        result += '          <properties>\n';
        for (const prop of apiByType.property) {
          result += '            <property>\n';
          result += `              <name>${escapeXml(prop.name)}</name>\n`;
          result += `              <class_name>${escapeXml(prop.className)}</class_name>\n`;
          if (prop.dataType) {
            result += `              <data_type>${escapeXml(prop.dataType)}</data_type>\n`;
          }
          result += '            </property>\n';
        }
        result += '          </properties>\n';
      }

      // Methods
      if (apiByType.method) {
        result += '          <methods>\n';
        for (const method of apiByType.method) {
          result += '            <method>\n';
          result += `              <name>${escapeXml(method.name)}</name>\n`;
          result += `              <class_name>${escapeXml(method.className)}</class_name>\n`;
          if (method.params && method.params.length > 0) {
            result += '              <params>\n';
            for (const param of method.params) {
              result += `                <param>${escapeXml(param)}</param>\n`;
            }
            result += '              </params>\n';
          }
          result += '            </method>\n';
        }
        result += '          </methods>\n';
      }

      result += '        </public_api>\n';
    }

    // Add classes
    if (file.classes && file.classes.length > 0) {
      result += '        <classes>\n';
      for (const cls of file.classes) {
        result += '          <class>\n';
        result += `            <name>${escapeXml(cls.name)}</name>\n`;

        // Add extends
        if (cls.extends) {
          result += `            <extends>${escapeXml(cls.extends)}</extends>\n`;
        }

        // Add implements
        if (cls.implements && cls.implements.length > 0) {
          result += '            <implements>\n';
          for (const impl of cls.implements) {
            result += `              <interface>${escapeXml(impl)}</interface>\n`;
          }
          result += '            </implements>\n';
        }

        // Add properties
        if (cls.properties && cls.properties.length > 0) {
          result += '            <properties>\n';
          for (const prop of cls.properties) {
            result += '              <property>\n';
            result += `                <name>${escapeXml(prop.name)}</name>\n`;
            if (prop.type) {
              result += `                <type>${escapeXml(prop.type)}</type>\n`;
            }
            if (prop.visibility) {
              result += `                <visibility>${escapeXml(prop.visibility)}</visibility>\n`;
            }
            if (prop.static) {
              result += '                <static>true</static>\n';
            }
            result += '              </property>\n';
          }
          result += '            </properties>\n';
        }

        // Add methods
        if (cls.methods && cls.methods.length > 0) {
          result += '            <methods>\n';
          for (const method of cls.methods) {
            result += '              <method>\n';
            result += `                <name>${escapeXml(method.name)}</name>\n`;
            if (method.returnType) {
              result += `                <return_type>${escapeXml(method.returnType)}</return_type>\n`;
            }
            if (method.visibility) {
              result += `                <visibility>${escapeXml(method.visibility)}</visibility>\n`;
            }
            if (method.static) {
              result += '                <static>true</static>\n';
            }

            // Add parameters
            if (method.parameters && method.parameters.length > 0) {
              result += '                <parameters>\n';
              for (const param of method.parameters) {
                result += '                  <parameter>\n';
                result += `                    <name>${escapeXml(param.name)}</name>\n`;
                if (param.type) {
                  result += `                    <type>${escapeXml(param.type)}</type>\n`;
                }
                result += '                  </parameter>\n';
              }
              result += '                </parameters>\n';
            }

            result += '              </method>\n';
          }
          result += '            </methods>\n';
        }

        result += '          </class>\n';
      }
      result += '        </classes>\n';
    }

    // Add functions
    if (file.functions && file.functions.length > 0) {
      result += '        <functions>\n';
      for (const func of file.functions) {
        result += '          <function>\n';
        result += `            <name>${escapeXml(func.name)}</name>\n`;
        if (func.returnType) {
          result += `            <return_type>${escapeXml(func.returnType)}</return_type>\n`;
        }

        // Add parameters
        if (func.parameters && func.parameters.length > 0) {
          result += '            <parameters>\n';
          for (const param of func.parameters) {
            result += '              <parameter>\n';
            result += `                <name>${escapeXml(param.name)}</name>\n`;
            if (param.type) {
              result += `                <type>${escapeXml(param.type)}</type>\n`;
            }
            result += '              </parameter>\n';
          }
          result += '            </parameters>\n';
        }

        result += '          </function>\n';
      }
      result += '        </functions>\n';
    }

    result += '      </file>\n';
  }
  result += '    </file_definitions>\n';

  // Add relationships section
  if (codeMaps.relationships && codeMaps.relationships.length > 0) {
    result += '    <relationships>\n';

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
      result += `      <source_file path="${escapeXml(source)}">\n`;

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
        result += '        <import_dependencies>\n';

        for (const rel of relsByType.imports) {
          result += `          <dependency target="${escapeXml(rel.target)}">\n`;

          if (rel.items && rel.items.length > 0) {
            result += '            <items>\n';
            for (const item of rel.items) {
              result += `              <item>${escapeXml(item)}</item>\n`;
            }
            result += '            </items>\n';
          }

          result += '          </dependency>\n';
        }

        result += '        </import_dependencies>\n';
      }

      // Type references
      if (relsByType.references_type.length > 0) {
        result += '        <type_references>\n';

        for (const rel of relsByType.references_type) {
          result += `          <reference target="${escapeXml(rel.target)}" type_name="${escapeXml(rel.typeName)}" />\n`;
        }

        result += '        </type_references>\n';
      }

      // Class inheritance
      if (relsByType.inherits_from.length > 0) {
        result += '        <class_inheritance>\n';

        for (const rel of relsByType.inherits_from) {
          result += `          <inheritance source_type="${escapeXml(rel.sourceType)}" target_type="${escapeXml(rel.targetType)}" target_file="${escapeXml(rel.target)}" />\n`;
        }

        result += '        </class_inheritance>\n';
      }

      // Interface extension
      if (relsByType.extends_interface.length > 0) {
        result += '        <interface_extensions>\n';

        for (const rel of relsByType.extends_interface) {
          result += `          <extension source_type="${escapeXml(rel.sourceType)}" target_type="${escapeXml(rel.targetType)}" target_file="${escapeXml(rel.target)}" />\n`;
        }

        result += '        </interface_extensions>\n';
      }

      // Other relationships
      if (relsByType.other && relsByType.other.length > 0) {
        result += '        <other_relationships>\n';

        for (const rel of relsByType.other) {
          result += `          <relationship type="${escapeXml(rel.type)}" target="${escapeXml(rel.target)}" />\n`;
        }

        result += '        </other_relationships>\n';
      }

      result += '      </source_file>\n';
    }

    result += '    </relationships>\n';
  }

  result += '  </code_maps>\n\n';

  // Add file contents for selected files if requested
  if (includeFileContents) {
    result += '  <files>\n';

    for (const file of selectedFiles) {
      const content = await fileSystem.readFileContent(file.path);
      const extension = path.extname(file.path).substring(1); // Remove the dot

      // Add file element
      result += '    <file>\n';
      result += `      <path>${file.path}</path>\n`;
      result += `      <language>${extension || 'txt'}</language>\n`;
      result += '      <content><![CDATA[\n';
      result += content;
      result += '      ]]></content>\n';
      result += '    </file>\n\n';
    }

    result += '  </files>\n';
  } else {
    // Add a note about file contents being excluded for token efficiency
    result += '  <note>\n';
    result += '    <title>Note on Selected Files</title>\n';
    result += '    <message>Full file contents have been excluded to optimize token usage. This Code Maps view focuses on structural information and API definitions only.</message>\n';
    result += '    <selected_files>\n';

    for (const file of selectedFiles) {
      result += `      <file_path>${file.path}</file_path>\n`;
    }

    result += '    </selected_files>\n';
    result += '  </note>\n';
  }

  // Add instructions section if prompts are selected
  if (selectedPrompts && selectedPrompts.length > 0) {
    result += '\n  <instructions>\n';
    selectedPrompts.forEach(promptContent => {
      result += '    <prompt><![CDATA[\n';
      result += promptContent;
      // Ensure prompt ends with a newline for CDATA correctness
      if (!promptContent.endsWith('\n')) {
        result += '\n';
      }
      result += '    ]]></prompt>\n';
    });
    result += '  </instructions>';
  }

  result += '\n</context>';

  return result;
}

/**
 * Escape XML special characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeXml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  formatCodeMapsForLLM
};
