
let blockTemplates = {};

const getValue = (block, name, fallback = '""') => {
  const code = Blockly.Python.valueToCode(block, name, Blockly.Python.ORDER_NONE);
  return code && code.trim() ? code : fallback;
};

const getField = (block, name) => block.getFieldValue?.(name);

const getBranch = (block, key = "DO") => {
  const code = Blockly.Python.statementToCode(block, key);
  return code && code.trim() ? code : `${Blockly.Python.INDENT}pass\n`;
};

const resolvePlaceholders = (block, schema) => {
  const out = {};
  for (const key of schema.placeholders || []) {
    if (key === "BRANCH") {
      out[key] = getBranch(block);
      continue;
    }
    out[key] = getValue(block, key, getField(block, key) ?? "");
  }
  return out;
};

const applyTemplate = (template, values) =>
  template.replace(/{{(.*?)}}/g, (_, k) => values[k] ?? "");

const finalize = (code, type) => {
  return type === "expression"
    ? [code.trim(), Blockly.Python.ORDER_ATOMIC]
    : code.endsWith("\n")
      ? code
      : code + "\n";
};

const Python = {};

const registerGenerators = () => {
  Object.keys(Python).forEach(key => delete Python[key]);
  Object.entries(blockTemplates).forEach(([type, schema]) => {
    Python[type] = block => {
      const values = resolvePlaceholders(block, schema);
      const code = applyTemplate(schema.template, values);
      return finalize(code, schema.return);
    };
  });
};

export async function loadTemplates() {
  try {
    const res = await fetch(new URL("./block2code.json", import.meta.url));
    if (!res.ok) throw new Error(`Failed to load block2code.json: ${res.status}`);
    blockTemplates = await res.json();
  } catch (e) {
    console.error("block2code.json を読み込めませんでした", e);
    blockTemplates = {};
  }
  registerGenerators();
}

export { blockTemplates };
export default Python;
