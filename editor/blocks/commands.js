import { getBranchCode } from './core.js';

export function initCommands() {
    Blockly.Blocks['on_command_executed'] = {
        init: function () {
            this.appendDummyInput()
                .appendField('⚡ スラッシュコマンド /')
                .appendField(new Blockly.FieldTextInput('hello'), 'COMMAND_NAME')
                .appendField('を使われたとき');
            this.appendStatementInput('DO').setCheck(null).appendField('実行する処理');
            this.setColour(230);
        },
    };
    Blockly.Python.forBlock['on_command_executed'] = function (block) {
        const rawName = block.getFieldValue('COMMAND_NAME') || 'hello';
        const commandName = rawName.toLowerCase();
        const safeCommandName = commandName.replace(/[^a-z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
        const branch = getBranchCode(block, 'DO');
        return `\n@bot.tree.command(name="${commandName}", description="${commandName} command")\nasync def ${safeCommandName}_cmd(interaction: discord.Interaction):\n    ctx = interaction\n    user = interaction.user\n${branch.trimEnd()}\n`;
    };

    Blockly.Blocks['prefix_command'] = {
        init: function () {
            this.appendDummyInput()
                .appendField('🗣️ プレフィックスコマンド')
                .appendField(new Blockly.FieldTextInput('!ping'), 'COMMAND_NAME')
                .appendField('を実行したとき');
            this.appendStatementInput('DO').setCheck(null).appendField('実行する処理');
            this.setColour(230);
        },
    };
    Blockly.Python.forBlock['prefix_command'] = function (block) {
        const rawName = block.getFieldValue('COMMAND_NAME') || 'ping';
        const commandName = rawName.replace(/^[!~#&?]/, '');
        const safeCommandName = commandName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
        const branch = getBranchCode(block, 'DO');
        return `\n@bot.command(name='${commandName}')\nasync def ${safeCommandName}_cmd(ctx):\n    user = ctx.author\n${branch.trimEnd()}\n`;
    };

    Blockly.Blocks['get_command_arg'] = {
        init: function () {
            this.appendDummyInput()
                .appendField('コマンド引数')
                .appendField(new Blockly.FieldTextInput('name'), 'ARG_NAME')
                .appendField('の値');
            this.setOutput(true, ['String', 'Number']);
            this.setColour(230);
        },
    };
    Blockly.Python.forBlock['get_command_arg'] = function (block) {
        const argName = block.getFieldValue('ARG_NAME') || 'name';
        return [`"${argName}"`, Blockly.Python.ORDER_ATOMIC];
    };
}
