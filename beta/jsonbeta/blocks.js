let blockTemplates = {};

export async function loadTemplates() {
  try {
    const res = await fetch(new URL("./block2ui.json", import.meta.url));
    if (res.ok) {
      blockTemplates = await res.json();
      return;
    }
  } catch (e) {
    console.error("block2ui.json を読み込めませんでした", e);
  }
  blockTemplates = {};
}

export function generateBlocks() {
  const Blocks = {};

  Object.entries(blockTemplates).forEach(([type, schema]) => {
    Blocks[type] = {
      type,
      init: function () {
        if (schema.title) {
          this.appendDummyInput().appendField(schema.title);
        }

        (schema.fields || []).forEach(f => {
          const input = this.appendDummyInput();

          if (f.inputType === "dropdown") {
            input.appendField(new Blockly.FieldDropdown(f.options), f.name);
          } else if (f.inputType === "checkbox") {
            input.appendField(f.label || "");
            input.appendField(new Blockly.FieldCheckbox(f.default === "TRUE" ? "TRUE" : "FALSE"), f.name);
          } else if (f.inputType === "text") {
            input.appendField(new Blockly.FieldTextInput(f.default || ""), f.name);
          } else if (f.inputType === "multiline_text") {
            input.appendField(new Blockly.FieldMultilineInput(f.default || ""), f.name);
          }
        });

        (schema.inputs || []).forEach(inp => {
          const i = this.appendValueInput(inp.name).setCheck(inp.check || null);
          if (inp.label) i.appendField(inp.label);
        });

        (schema.statements || []).forEach(name => {
          this.appendStatementInput(name)
            .setCheck(null)
            .appendField(schema.statementLabels?.[name] || "");
        });

        if (schema.dynamicItems) {
          this.itemCount_ = 3;
          for (let i = 0; i < this.itemCount_; i++) {
            this.appendValueInput("ADD" + i)
              .setCheck(null)
              .appendField(i === 0 ? "項目" : "");
          }
        }

        if (schema.type === "output") {
          this.setOutput(true, schema.output || null);
        }

        if (schema.type === "statement") {
          if (schema.previous !== false) this.setPreviousStatement(true, null);
          if (schema.next !== false) this.setNextStatement(true, null);
        }

        this.setColour(schema.color || 200);
        if (schema.tooltip) this.setTooltip(schema.tooltip);
      }
    };
  });

  return Blocks;
}
