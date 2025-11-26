import Blocks from './blocks.js';

if (typeof window !== 'undefined') {
  if (window.lucide) {
    window.lucide.createIcons();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }
}

let workspace;
const STORAGE_KEY = 'discord_bot_builder_workspace_v5';
const TOKEN_STORAGE_KEY = 'discord_bot_token_secure_v1';

const createTokenVault = () => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return null;
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const deriveKey = async (passphrase, salt) => {
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  };

  const serialize = (buffer) => Array.from(new Uint8Array(buffer));
  const toUint8 = (arr = []) => Uint8Array.from(arr);

  return {
    async store(token, passphrase) {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(passphrase, salt);
      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(token),
      );
      const payload = {
        salt: serialize(salt),
        iv: serialize(iv),
        cipher: serialize(cipherBuffer),
      };
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
    },
    async load(passphrase) {
      const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return null;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return null;
      }
      const salt = toUint8(payload.salt);
      const iv = toUint8(payload.iv);
      const cipher = toUint8(payload.cipher);
      if (!salt.length || !iv.length || !cipher.length) return null;
      const key = await deriveKey(passphrase, salt);
      const plainBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipher,
      );
      return decoder.decode(plainBuffer);
    },
    hasToken() {
      return Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
    },
    clear() {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    },
  };
};

const tokenVault = createTokenVault();

// --- Custom Block Definition (Pythonコード直接記述) ---
Blockly.Blocks['custom_python_code'] = {
  init: function () {
    this.appendDummyInput().appendField('🐍 eval Python code');
    this.appendDummyInput().appendField(
      new Blockly.FieldMultilineInput("print('Hello World')"),
      'CODE',
    );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(60);
    this.setTooltip('Write and execute arbitrary Python code here.');
  },
};

const setupBlocklyEnvironment = () => {
  // Modern Theme Definition
  const modernLightTheme = Blockly.Theme.defineTheme('modernLight', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#f8fafc', // slate-50
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#475569',
      flyoutBackgroundColour: '#ffffff',
      flyoutForegroundColour: '#475569',
      flyoutOpacity: 0.95,
      scrollbarColour: '#cbd5e1',
      insertionMarkerColour: '#6366f1', // Indigo
      insertionMarkerOpacity: 0.3,
      cursorColour: '#6366f1',
    },
    fontStyle: {
      family: 'Plus Jakarta Sans, sans-serif',
      weight: '600',
      size: 12,
    },
  });

  const modernDarkTheme = Blockly.Theme.defineTheme('modernDark', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#020617', // slate-950
      toolboxBackgroundColour: '#0f172a', // slate-900
      toolboxForegroundColour: '#cbd5e1',
      flyoutBackgroundColour: '#0f172a',
      flyoutForegroundColour: '#cbd5e1',
      flyoutOpacity: 0.95,
      scrollbarColour: '#334155',
      insertionMarkerColour: '#818cf8', // Indigo light
      insertionMarkerOpacity: 0.3,
      cursorColour: '#818cf8',
    },
    fontStyle: {
      family: 'Plus Jakarta Sans, sans-serif',
      weight: '600',
      size: 12,
    },
    blockStyles: {
      hat_blocks: { colourPrimary: '#a55b80' },
    },
  });

  Blockly.Python = Blocks.Python;
  Blockly.Blocks = Blocks.Blocks;
  Blockly.Python.INDENT = '    ';

  return { modernLightTheme, modernDarkTheme };
};

const html = document.documentElement;

// --- Code Generation & UI Sync ---
const generatePythonCode = () => {
  if (!workspace) return '';
  let rawCode = Blockly.Python.workspaceToCode(workspace);

  // --- Optimized Boilerplate ---
  const boilerplate = `
# Easy Discord Bot Builderによって作成されました! 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version

import discord
from discord import app_commands
from discord.ext import commands
import random
import asyncio
import datetime
import math
import json
import os
import logging

# Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 

# Bot creation
bot = commands.Bot(command_prefix='!', intents=intents)

# Global error handler
@bot.event
async def on_command_error(ctx, error):
    # Ignore command not found errors to avoid conflicts with other bots
    if isinstance(error, commands.CommandNotFound):
        return
    # Log other errors
    logging.error(f"Command Error: {error}")
    # You can also send a message for development purposes (comment out in production)
    # await ctx.send(f"⚠️ An error occurred: {error}")

# ---JSON Operations---
def _load_json_data(filename):
    if not os.path.exists(filename):
        return {}
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"JSON Load Error: {e}")
        return {}

def _save_json_data(filename, data):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logging.error(f"JSON Save Error: {e}")
# ----------------------------

# --- User-Created Section ---
${rawCode}
# --------------------------

if __name__ == "__main__":
    # Token check
    # bot.run('TOKEN') # Please enter your token here when running!
    pass
`;
  return boilerplate.trim();
};

const generateJSCode = () => {
  if (!workspace) return '';
  let rawCode = Blockly.JavaScript.workspaceToCode(workspace);

  const boilerplate = `
// Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin, @aiubrew!
// Created with Easy Discord Bot Builder! created by @himais0giiiin, @aiubrew!

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ---JSON Operations---
function _load_json_data(filename) {
    if (!fs.existsSync(filename)) {
        return {};
    }
    try {
        const data = fs.readFileSync(filename, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(\`JSON Load Error: \${e}\`);
        return {};
    }
}

function _save_json_data(filename, data) {
    try {
        fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf-8');
    } catch (e) {
        console.error(\`JSON Save Error: \${e}\`);
    }
}
// ----------------------------

// --- User Operations ---
${rawCode}
// --------------------------

client.login('TOKEN'); // Please enter your token here when running!
`;
  return boilerplate.trim();
};

const updateLivePreview = () => {
  const code = generatePythonCode();
  const preview = document.getElementById('codePreviewContent');
  preview.textContent = code;
  hljs.highlightElement(preview);
};

const toggleTheme = (modernLightTheme, modernDarkTheme) => {
  const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  html.classList.remove(currentTheme);
  html.classList.add(newTheme);
  localStorage.setItem('theme', newTheme);
  if (workspace) {
    workspace.setTheme(newTheme === 'dark' ? modernDarkTheme : modernLightTheme);
  }
};

const initializeApp = () => {
  const { modernLightTheme, modernDarkTheme } = setupBlocklyEnvironment();

  const blocklyDiv = document.getElementById('blocklyDiv');
  const toolbox = document.getElementById('toolbox');
  const themeToggle = document.getElementById('themeToggle');
  // ヘッダーのコード生成ボタン
  const showCodeBtn = document.getElementById('showCodeBtn');
  const showJsCodeBtn = document.getElementById('showJsCodeBtn');
  // ??????
  const codeModal = document.getElementById('codeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const codeOutput = document.getElementById('codeOutput');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const shareTwitterBtn = document.getElementById('shareTwitterBtn');
  const saveFileBtn = document.getElementById('saveFileBtn');
  const modalTitle = codeModal ? codeModal.querySelector('h2') : null;
  const modalSteps = codeModal ? codeModal.querySelector('ol') : null;

  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const workspaceContainer = document.getElementById('workspace-container');
  const layoutBlockBtn = document.getElementById('layoutBlockBtn');
  const layoutSplitBtn = document.getElementById('layoutSplitBtn');
  const runBotBtn = document.getElementById('runBotBtn');
  const stopBotBtn = document.getElementById('stopBotBtn');
  const botTokenInput = document.getElementById('botTokenInput');
  const tokenSaveBtn = document.getElementById('tokenSaveBtn');
  const tokenLoadBtn = document.getElementById('tokenLoadBtn');
  const serverStatus = document.getElementById('serverStatus');
  const consoleOverlay = document.getElementById('consoleOverlay');
  const openConsoleBtn = document.getElementById('openConsoleBtn');
  const closeConsoleBtn = document.getElementById('closeConsoleBtn');
  const consoleOutput = document.getElementById('botConsoleOutput');
  const consoleContainer = document.getElementById('botConsole');
  const consoleStatus = document.getElementById('consoleStatus');
  const toggleConsoleFollow = document.getElementById('toggleConsoleFollow');
  const clearConsoleBtn = document.getElementById('clearConsoleBtn');

  const pythonGuideSteps = `
      <li>下のコードを <code class="px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-mono">bot.py</code> として保存します。</li>
      <li><code class="px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-mono select-all">pip install discord.py</code> を実行します。</li>
      <li><code class="px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-mono select-all">python bot.py</code> で Bot を起動します。</li>
  `;

  const jsGuideSteps = `
      <li>下のコードを <code class="px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-mono">bot.js</code> として保存します。</li>
      <li><code class="px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-mono select-all">npm install discord.js</code> を実行します。</li>
      <li><code class="px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-mono select-all">node bot.js</code> で Bot を起動します。</li>
  `;

  const showModal = () => {
    if (!codeModal) return;
    codeModal.classList.remove('hidden');
    codeModal.classList.add('flex');
    void codeModal.offsetWidth;
    codeModal.classList.add('show-modal');
  };

  const hideModal = () => {
    if (!codeModal) return;
    codeModal.classList.remove('show-modal');
    setTimeout(() => {
      codeModal.classList.remove('flex');
      codeModal.classList.add('hidden');
    }, 300);
  };

  const showConsoleOverlay = (expand = false) => {
    if (!consoleOverlay) return;
    consoleOverlay.classList.remove('console-hidden');
    if (expand) {
      consoleOverlay.classList.remove('console-collapsed');
    }
  };

  const collapseConsoleOverlay = () => {
    if (!consoleOverlay) return;
    consoleOverlay.classList.add('console-collapsed');
  };

  const setConsoleStatus = (text) => {
    if (consoleStatus) consoleStatus.textContent = text;
  };

  let consoleFollow = true;
  let logCursor = 0;
  let logPollTimer = null;

  const appendConsoleLine = (message, timestamp) => {
    if (!consoleOutput) return;
    const line = document.createElement('div');
    const date = new Date(timestamp * 1000);
    const time = date.toLocaleTimeString();
    line.textContent = `[${time}] ${message}`;
    consoleOutput.appendChild(line);
    while (consoleOutput.children.length > 500) {
      consoleOutput.removeChild(consoleOutput.firstChild);
    }
    if (consoleFollow && consoleContainer) {
      consoleContainer.scrollTop = consoleContainer.scrollHeight;
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/logs?after=${logCursor}`);
      if (!res.ok) throw new Error('response not ok');
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        data.logs.forEach((entry) => appendConsoleLine(entry.message, entry.timestamp));
      }
      logCursor = data.cursor || logCursor;
      setConsoleStatus('???');
    } catch (err) {
      setConsoleStatus('???????????');
    }
  };

  const startLogPolling = () => {
    if (!consoleOutput) return;
    if (logPollTimer) clearInterval(logPollTimer);
    fetchLogs();
    logPollTimer = setInterval(fetchLogs, 2000);
  };

  const clearConsoleOutput = () => {
    if (consoleOutput) consoleOutput.innerHTML = '';
    setConsoleStatus('?????');
  };

  const updateFollowToggleLabel = () => {
    if (!toggleConsoleFollow) return;
    toggleConsoleFollow.textContent = consoleFollow ? 'Follow ON' : 'Follow OFF';
    toggleConsoleFollow.classList.toggle('bg-emerald-600', consoleFollow);
    toggleConsoleFollow.classList.toggle('text-white', consoleFollow);
    toggleConsoleFollow.classList.toggle('bg-slate-800', !consoleFollow);
    toggleConsoleFollow.classList.toggle('text-slate-200', !consoleFollow);
  };

  if (toggleConsoleFollow) {
    toggleConsoleFollow.addEventListener('click', () => {
      consoleFollow = !consoleFollow;
      updateFollowToggleLabel();
      if (consoleFollow && consoleContainer) {
        consoleContainer.scrollTop = consoleContainer.scrollHeight;
      }
    });
    updateFollowToggleLabel();
  }

  if (clearConsoleBtn) {
    clearConsoleBtn.addEventListener('click', async () => {
      clearConsoleOutput();
      logCursor = 0;
      try {
        await fetch('/logs', { method: 'DELETE' });
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (openConsoleBtn) {
    openConsoleBtn.addEventListener('click', () => {
      if (!consoleOverlay) return;
      const isCollapsed = consoleOverlay.classList.contains('console-collapsed');
      if (isCollapsed) {
        showConsoleOverlay(true);
      } else {
        collapseConsoleOverlay();
      }
    });
  }

  if (closeConsoleBtn) {
    closeConsoleBtn.addEventListener('click', collapseConsoleOverlay);
  }

  startLogPolling();
  setConsoleStatus('???');


  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') html.classList.add('dark');
  const initialTheme = savedTheme === 'dark' ? modernDarkTheme : modernLightTheme;

  workspace = Blockly.inject(blocklyDiv, {
    toolbox: toolbox,
    horizontalLayout: false,
    trashcan: true,
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2,
    },
    renderer: 'zelos',
    theme: initialTheme,
  });

  // --- Layout Switching Logic ---
  const setLayout = (mode) => {
    if (mode === 'split') {
      workspaceContainer.classList.add('split-view');
      layoutSplitBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
      layoutSplitBtn.classList.add(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );

      layoutBlockBtn.classList.remove(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );
      layoutBlockBtn.classList.add('text-slate-500', 'dark:text-slate-400');
      updateLivePreview();
    } else {
      workspaceContainer.classList.remove('split-view');
      layoutBlockBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
      layoutBlockBtn.classList.add(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );

      layoutSplitBtn.classList.remove(
        'bg-white',
        'dark:bg-slate-800',
        'shadow-sm',
        'text-indigo-600',
        'dark:text-indigo-400',
      );
      layoutSplitBtn.classList.add('text-slate-500', 'dark:text-slate-400');
    }
    setTimeout(() => Blockly.svgResize(workspace), 350);
  };

  layoutBlockBtn.addEventListener('click', () => setLayout('block'));
  layoutSplitBtn.addEventListener('click', () => setLayout('split'));

  // --- Realtime Sync ---
  workspace.addChangeListener((e) => {
    // UIイベント以外で更新
    if (e.type !== Blockly.Events.UI && workspaceContainer.classList.contains('split-view')) {
      updateLivePreview();
    }

    // Auto Save
    if (!e.isUiEvent && e.type !== Blockly.Events.FINISHED_LOADING) {
      const xml = Blockly.Xml.workspaceToDom(workspace);
      localStorage.setItem(STORAGE_KEY, Blockly.Xml.domToText(xml));
      const saveStatus = document.getElementById('saveStatus');
      saveStatus.setAttribute('data-show', 'true');
      setTimeout(() => saveStatus.setAttribute('data-show', 'false'), 2000);
    }
  });

  // --- Toolbox Pin Button (Re-implementation) ---
  const pinBtn = document.createElement('button');
  pinBtn.id = 'toolboxPinBtn';
  pinBtn.className =
    'absolute z-20 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-500 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 transition-all duration-200 shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50';
  pinBtn.style.top = '12px';

  const updatePinState = () => {
    if (!workspace) return;
    const toolbox = workspace.getToolbox();
    if (!toolbox) return;

    let isVisible = true;
    if (typeof toolbox.isVisible === 'function') {
      isVisible = toolbox.isVisible();
    } else if (typeof toolbox.getWidth === 'function') {
      isVisible = toolbox.getWidth() > 0;
    }

    const width = typeof toolbox.getWidth === 'function' ? toolbox.getWidth() : 0;

    if (isVisible) {
      pinBtn.style.left = `${width - 38}px`;
      pinBtn.innerHTML =
        '<i data-lucide="pin" class="w-3.5 h-3.5 fill-indigo-500 text-indigo-600"></i>';
      pinBtn.classList.add('bg-white', 'dark:bg-slate-800');
    } else {
      pinBtn.style.left = '12px';
      pinBtn.innerHTML = '<i data-lucide="pin-off" class="w-3.5 h-3.5"></i>';
      pinBtn.classList.remove('bg-white', 'dark:bg-slate-800');
      pinBtn.classList.add('bg-white/80', 'dark:bg-slate-800/80', 'backdrop-blur-sm');
    }
    lucide.createIcons();
  };

  pinBtn.onclick = () => {
    const toolbox = workspace.getToolbox();
    if (!toolbox) return;
    const isVisible =
      typeof toolbox.isVisible === 'function' ? toolbox.isVisible() : toolbox.getWidth() > 0;
    if (typeof toolbox.setVisible === 'function') toolbox.setVisible(!isVisible);
    Blockly.svgResize(workspace);
    setTimeout(updatePinState, 50);
  };
  document.getElementById('blocklyDiv').appendChild(pinBtn);
  setTimeout(updatePinState, 100);
  window.addEventListener('resize', () => {
    Blockly.svgResize(workspace);
    updatePinState();
  });
  workspace.addChangeListener((e) => {
    if (e.type === Blockly.Events.TOOLBOX_ITEM_SELECT) setTimeout(updatePinState, 50);
  });

  // --- Load Saved Data ---
  const xmlText = localStorage.getItem(STORAGE_KEY);
  if (xmlText) {
    try {
      Blockly.Xml.clearWorkspaceAndLoadFromXml(Blockly.Xml.textToDom(xmlText), workspace);
    } catch (e) {
      console.error(e);
    }
  }

  themeToggle.addEventListener('click', () => toggleTheme(modernLightTheme, modernDarkTheme));

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        Blockly.Xml.clearWorkspaceAndLoadFromXml(Blockly.Xml.textToDom(e.target.result), workspace);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  exportBtn.addEventListener('click', () => {
    const xml = Blockly.Xml.workspaceToDom(workspace);
    const blob = new Blob([Blockly.Xml.domToText(xml)], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-project.xml`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // --- モーダル表示ロジック (アニメーション付き) ---
  if (showCodeBtn && codeModal && codeOutput) {
    showCodeBtn.addEventListener('click', () => {
      showCodeBtn.blur();
      if (workspace) Blockly.hideChaff();
      codeOutput.textContent = generatePythonCode();
      if (modalTitle) modalTitle.textContent = 'Botコード (Python)';
      if (modalSteps) modalSteps.innerHTML = pythonGuideSteps;
      showModal();
    });
  }

  if (showJsCodeBtn && codeModal && codeOutput) {
    showJsCodeBtn.addEventListener('click', () => {
      showJsCodeBtn.blur();
      if (workspace) Blockly.hideChaff();
      codeOutput.textContent = generateJSCode();
      if (modalTitle) modalTitle.textContent = 'Bot Code (JavaScript)';
      if (modalSteps) modalSteps.innerHTML = jsGuideSteps;
      showModal();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideModal);
  }

  if (codeModal) {
    codeModal.addEventListener('click', (e) => {
      if (e.target === codeModal) hideModal();
    });
  }

  if (copyCodeBtn && codeOutput) {
    copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeOutput.textContent);
      const originalHtml = copyCodeBtn.innerHTML;
      copyCodeBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> コピー完了';
      copyCodeBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
      copyCodeBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500', 'border-emerald-400');
      lucide.createIcons();

      setTimeout(() => {
        copyCodeBtn.innerHTML = originalHtml;
        copyCodeBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
        copyCodeBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500', 'border-emerald-400');
        lucide.createIcons();
      }, 2000);
    });
  }

  if (shareTwitterBtn && codeOutput) {
    shareTwitterBtn.addEventListener('click', () => {
      const code = codeOutput.textContent;
      const shortCode = code.length > 200 ? code.substring(0, 200) + '...' : code;
      const tweetText = `EDBB generated Discord Bot code! #EDBB \n\n${shortCode}`;
      const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      window.open(tweetUrl, '_blank');
    });
  }

  if (saveFileBtn && codeOutput) {
    saveFileBtn.addEventListener('click', () => {
      const code = codeOutput.textContent;
      const isJs = (modalTitle?.textContent || '').includes('JavaScript');
      const filename = isJs ? 'bot.js' : 'bot.py';
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (runBotBtn && stopBotBtn && botTokenInput && serverStatus) {
    const statusText = serverStatus.querySelector('span:last-child');
    const ensureVaultAvailable = () => {
      if (!tokenVault) {
        alert('このブラウザでは暗号化保存に対応していません。最新のブラウザをご利用ください。');
        return false;
      }
      return true;
    };

    if (tokenSaveBtn) {
      tokenSaveBtn.addEventListener('click', async () => {
        if (!ensureVaultAvailable()) return;
        const token = botTokenInput.value.trim();
        if (!token) {
          alert('Discord Bot トークンを入力してから保存してください。');
          return;
        }
        const passphrase = prompt('トークンを暗号化して保存します。パスフレーズを入力してください。');
        if (!passphrase) return;
        const confirmPhrase = prompt('確認のため同じパスフレーズをもう一度入力してください。');
        if (passphrase !== confirmPhrase) {
          alert('パスフレーズが一致しません。');
          return;
        }
        try {
          await tokenVault.store(token, passphrase);
          alert('トークンを暗号化して保存しました。');
        } catch (err) {
          console.error(err);
          alert('保存に失敗しました。');
        }
      });
    }

    if (tokenLoadBtn) {
      tokenLoadBtn.addEventListener('click', async () => {
        if (!ensureVaultAvailable()) return;
        if (!tokenVault.hasToken()) {
          alert('暗号化されたトークンはまだ保存されていません。');
          return;
        }
        const passphrase = prompt('保存時に設定したパスフレーズを入力してください。');
        if (!passphrase) return;
        try {
          const decrypted = await tokenVault.load(passphrase);
          if (!decrypted) {
            alert('復号に失敗しました。');
            return;
          }
          botTokenInput.value = decrypted;
          alert('トークンを復号して入力しました。');
        } catch (err) {
          console.error(err);
          alert('復号に失敗しました。パスフレーズが正しいか確認してください。');
        }
      });
    }

    const updateButtons = (isRunning) => {
      if (isRunning) {
        runBotBtn.classList.add('hidden');
        stopBotBtn.classList.remove('hidden');
      } else {
        stopBotBtn.classList.add('hidden');
        runBotBtn.classList.remove('hidden');
      }
    };

    const checkServerStatus = async () => {
      try {
        const res = await fetch('/status');
        if (!res.ok) throw new Error('Status error');
        const data = await res.json();
        serverStatus.classList.remove('hidden');
        if (statusText) statusText.textContent = data.running ? 'Bot ???' : 'Server Connected';
        setConsoleStatus(data.running ? 'Bot ??????' : '???');
        updateButtons(Boolean(data.running));
      } catch (err) {
        serverStatus.classList.add('hidden');
        setConsoleStatus('???????');
        updateButtons(false);
      }
    };

    setInterval(checkServerStatus, 5000);
    checkServerStatus();

    const originalRunLabel = runBotBtn.innerHTML;
    const originalStopLabel = stopBotBtn.innerHTML;

    runBotBtn.addEventListener('click', async () => {
      const token = botTokenInput.value.trim();
      if (!token) {
        alert('??? Discord Bot ??????????????');
        return;
      }

      if (workspace) Blockly.hideChaff();
      const code = generatePythonCode();
      clearConsoleOutput();
      logCursor = 0;
      setConsoleStatus('????????...');
      showConsoleOverlay(true);

      runBotBtn.disabled = true;
      runBotBtn.innerHTML = '???...';

      try {
        const res = await fetch('/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, token }),
        });

        if (!res.ok) {
          alert('Bot ????????????????????????????????????');
        } else {
          updateButtons(true);
          checkServerStatus();
        }
      } catch (err) {
        alert('????????????????????"python server.py" ??????????');
      } finally {
        runBotBtn.disabled = false;
        runBotBtn.innerHTML = originalRunLabel;
      }
    });

    stopBotBtn.addEventListener('click', async () => {
      stopBotBtn.disabled = true;
      stopBotBtn.innerHTML = '???...';

      try {
        const res = await fetch('/stop', { method: 'POST' });
        if (!res.ok) {
          alert('Bot ???????????');
        }
        updateButtons(false);
        setConsoleStatus('???????????');
        checkServerStatus();
      } catch (err) {
        alert('????????????????');
      } finally {
        stopBotBtn.disabled = false;
        stopBotBtn.innerHTML = originalStopLabel;
      }
    });
  }

};

window.onload = initializeApp;
