/**
 * EDBP Plugin System
 * Obsidian-like plugin management and vanilla plugin support.
 */

export class PluginManager {
    constructor(workspace) {
        this.workspace = workspace;
        this.plugins = new Map();
        // インストール済みプラグインのメタデータ
        this.installedPlugins = JSON.parse(localStorage.getItem('edbb_installed_plugins') || '{}');
        // 有効化されているプラグインのID
        this.enabledPlugins = new Set(JSON.parse(localStorage.getItem('edbb_enabled_plugins') || '[]'));
        
        // 組み込みプラグインレジストリ
        this.builtinRegistry = [
            {
                id: 'vanilla-plugin',
                uuid: 'edbp-builtin-vanilla-001',
                name: 'Vanilla Plugin',
                author: 'EDBP Team',
                version: '1.0.0',
                description: 'EDBPの基本機能を拡張するバニラプラグインです。',
                repo: 'https://github.com/EDBPlugin/easy-bdp',
                updateDate: '2026-02-07',
                affectsStyle: false,
                affectsBlocks: true,
                isCustom: false
            }
        ];
    }

    async init() {
        console.log('PluginManager initializing...');
        // 組み込みプラグインをインストール済みとして扱う
        this.builtinRegistry.forEach(p => {
            if (!this.installedPlugins[p.id]) {
                this.installedPlugins[p.id] = p;
            }
        });

        for (const pluginId of this.enabledPlugins) {
            await this.enablePlugin(pluginId);
        }
    }

    // UUIDの生成 (開発者名 + プラグイン名 + ランダム値)
    generateUUID(author, name) {
        const seed = `${author}-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // 簡易的なハッシュ化
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return `edbp-${hex}-${Math.random().toString(36).substr(2, 4)}`;
    }

    async installFromZip(file) {
        try {
            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file("manifest.json");
            if (!manifestFile) throw new Error("manifest.json が見つかりません。");

            const manifestText = await manifestFile.async("string");
            const manifest = JSON.parse(manifestText);

            // 必須項目のチェック
            if (!manifest.name || !manifest.author) {
                throw new Error("マニフェストに名前または開発者情報が不足しています。");
            }

            // UUIDの付与（既存でない場合のみ）
            if (!manifest.uuid) {
                manifest.uuid = this.generateUUID(manifest.author, manifest.name);
            }

            // IDの生成
            const id = manifest.id || manifest.name.toLowerCase().replace(/\s+/g, '-');
            manifest.id = id;
            manifest.updateDate = new Date().toISOString().split('T')[0];

            // スクリプトの読み込み
            const scriptFile = zip.file("plugin.js");
            if (scriptFile) {
                manifest.script = await scriptFile.async("string");
            }

            this.installedPlugins[id] = manifest;
            this.saveInstalledPlugins();
            
            return manifest;
        } catch (error) {
            console.error("Plugin installation failed:", error);
            throw error;
        }
    }

    async enablePlugin(id) {
        if (this.plugins.has(id)) return;
        
        const pluginMeta = this.installedPlugins[id];
        if (!pluginMeta) return;

        try {
            if (id === 'vanilla-plugin') {
                const plugin = new VanillaPlugin(this.workspace);
                await plugin.onload();
                this.plugins.set(id, plugin);
            } else if (pluginMeta.script) {
                // 動的スクリプトの実行
                // 安全のため、簡単なサンドボックス化を検討すべきですが、現状は eval または Function
                const pluginClass = new Function('workspace', `
                    ${pluginMeta.script}
                    return new Plugin(workspace);
                `)(this.workspace);
                
                if (pluginClass && typeof pluginClass.onload === 'function') {
                    await pluginClass.onload();
                }
                this.plugins.set(id, pluginClass);
            } else if (pluginMeta.affectsStyle) {
                // スタイルのみのプラグイン例
                this.plugins.set(id, { onunload: () => {} });
            }
            
            this.enabledPlugins.add(id);
            this.saveState();
        } catch (e) {
            console.error(`Failed to enable plugin ${id}:`, e);
        }
    }

    async disablePlugin(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            if (typeof plugin.onunload === 'function') {
                await plugin.onunload();
            }
            this.plugins.delete(id);
        }
        this.enabledPlugins.delete(id);
        this.saveState();
    }

    saveState() {
        localStorage.setItem('edbb_enabled_plugins', JSON.stringify(Array.from(this.enabledPlugins)));
    }

    saveInstalledPlugins() {
        localStorage.setItem('edbb_installed_plugins', JSON.stringify(this.installedPlugins));
    }

    getRegistry() {
        return Object.values(this.installedPlugins);
    }

    isPluginEnabled(id) {
        return this.enabledPlugins.has(id);
    }

    // 共有時に必要なプラグインUUIDを取得
    getPluginUUIDsForShare() {
        const uuids = [];
        for (const id of this.enabledPlugins) {
            const meta = this.installedPlugins[id];
            if (meta) {
                // スタイルに干渉するプラグインは除外
                if (meta.affectsStyle) continue;
                
                // ブロックに干渉するプラグインのうち、自作以外を許可
                if (meta.affectsBlocks && !meta.isCustom) {
                    uuids.push(meta.uuid);
                }
            }
        }
        return uuids;
    }

    // 自作プラグイン（ブロック干渉）が使用されているか確認
    hasCustomBlockPlugin() {
        for (const id of this.enabledPlugins) {
            const meta = this.installedPlugins[id];
            if (meta && meta.affectsBlocks && meta.isCustom) {
                return true;
            }
        }
        return false;
    }

    // UUIDからプラグインIDを解決（共有からの復元用）
    getPluginIdByUUID(uuid) {
        for (const [id, meta] of Object.entries(this.installedPlugins)) {
            if (meta.uuid === uuid) return id;
        }
        return null;
    }
}

class VanillaPlugin {
    constructor(workspace) {
        this.workspace = workspace;
    }

    async onload() {
        console.log('Vanilla Plugin loaded');
        this.registerBlocks();
    }

    registerBlocks() {
        if (typeof Blockly === 'undefined') return;

        Blockly.Blocks['vanilla_plugin_test'] = {
            init: function() {
                this.appendDummyInput()
                    .appendField("🍦 バニラプラグイン・テスト");
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setColour(200);
                this.setTooltip("バニラプラグインが正常に動作しているか確認するためのブロックです。");
            }
        };

        Blockly.Python['vanilla_plugin_test'] = function(block) {
            return "# Vanilla Plugin Test\n";
        };

        this.updateToolbox();
    }

    updateToolbox() {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;

        if (toolbox.querySelector('category[name="プラグイン"]')) return;

        const category = document.createElement('category');
        category.setAttribute('name', 'プラグイン');
        category.setAttribute('data-icon', '🔌');
        category.setAttribute('colour', '#200');
        category.innerHTML = '<block type="vanilla_plugin_test"></block>';
        
        toolbox.appendChild(category);
        
        if (this.workspace) {
            this.workspace.updateToolbox(toolbox);
        }
    }

    async onunload() {
        console.log('Vanilla Plugin unloaded');
        this.removeFromToolbox();
    }

    removeFromToolbox() {
        const toolbox = document.getElementById('toolbox');
        if (!toolbox) return;

        const category = toolbox.querySelector('category[name="プラグイン"]');
        if (category) {
            category.remove();
            if (this.workspace) {
                this.workspace.updateToolbox(toolbox);
            }
        }
    }
}
