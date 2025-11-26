import os
import sys
import subprocess
import signal
import threading
import time
import re
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

# Global variable to store the bot process and logs
bot_process = None
log_lock = threading.Lock()
bot_logs = []
log_sequence = 0
LOG_LIMIT = 500

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/run', methods=['POST'])
def run_bot():
    global bot_process
    
    data = request.json or {}
    code = data.get('code')
    token = data.get('token')

    if not code or not token:
        return jsonify({'error': 'Code and Token are required'}), 400

    # Stop existing bot if running
    stop_bot_internal()
    clear_logs()
    append_log('🔄 Bot の起動準備をしています...')

    # Inject token into the code
    # We look for the line "bot.run('TOKEN')" or similar and replace it
    # Or simpler: just append the run command if it's not there, or replace the placeholder
    
    # The generator produces: # bot.run('TOKEN')
    # We will uncomment it and replace 'TOKEN' with the actual token
    
    pattern = re.compile(r"^(\s*)#?\s*bot\.run\((['\"])TOKEN\2\)", re.MULTILINE)

    def _replace(match):
        indent = match.group(1) or ''
        quote = match.group(2)
        return f"{indent}bot.run({quote}{token}{quote})"

    code, replaced = pattern.subn(_replace, code)
    if replaced == 0:
        # Fallback: append it if not found (though the generator should have it)
        code += f"\n\nbot.run('{token}')"

    # Save to a temporary file
    try:
        with open('bot_run.py', 'w', encoding='utf-8') as f:
            f.write(code)
    except Exception as exc:
        append_log(f'❌ bot_run.py の書き込みに失敗しました: {exc}')
        return jsonify({'error': 'Failed to write bot file'}), 500

    # Start the bot in a separate process
    try:
        bot_process = subprocess.Popen(
            [sys.executable, 'bot_run.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1  # Line buffered
        )
        append_log(f'✅ Bot プロセスを起動しました (PID: {bot_process.pid})')
    except Exception as exc:
        bot_process = None
        append_log(f'❌ Bot の起動に失敗しました: {exc}')
        return jsonify({'error': 'Failed to start bot'}), 500

    threading.Thread(target=stream_bot_output, daemon=True).start()

    return jsonify({'status': 'started'})

@app.route('/stop', methods=['POST'])
def stop_bot():
    stop_bot_internal()
    return jsonify({'status': 'stopped'})

@app.route('/status', methods=['GET'])
def get_status():
    global bot_process
    is_running = bot_process is not None and bot_process.poll() is None
    return jsonify({'running': is_running})

@app.route('/logs', methods=['GET', 'DELETE'])
def handle_logs():
    if request.method == 'DELETE':
        clear_logs()
        append_log('🧹 クライアントからログがクリアされました')
        return jsonify({'status': 'cleared'})

    after = request.args.get('after')
    try:
        after = int(after) if after is not None else 0
    except ValueError:
        after = 0

    with log_lock:
        logs = [entry for entry in bot_logs if entry['seq'] > after]
        cursor = bot_logs[-1]['seq'] if bot_logs else after

    return jsonify({'logs': logs, 'cursor': cursor})

def stop_bot_internal():
    global bot_process
    if bot_process:
        append_log('⏹ Bot を停止しています...')
        # Try to terminate gracefully first
        bot_process.terminate()
        try:
            bot_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            bot_process.kill() # Force kill if it doesn't stop
        bot_process = None
        append_log('✅ Bot を停止しました')

def stream_bot_output():
    global bot_process
    if not bot_process or not bot_process.stdout:
        return

    for line in bot_process.stdout:
        append_log(line.rstrip())

    return_code = bot_process.poll()
    append_log(f'🏁 Bot が終了しました (コード: {return_code})')
    bot_process = None

def append_log(message):
    global bot_logs, log_sequence
    timestamp = time.time()
    with log_lock:
        log_sequence += 1
        bot_logs.append({'seq': log_sequence, 'timestamp': timestamp, 'message': message})
        if len(bot_logs) > LOG_LIMIT:
            bot_logs = bot_logs[-LOG_LIMIT:]

def clear_logs():
    global bot_logs, log_sequence
    with log_lock:
        bot_logs = []
        log_sequence = 0

if __name__ == '__main__':
    print("Starting Easy Discord Bot Builder Server...")
    print("Open http://localhost:5000/editor/index.html to start building!")
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
