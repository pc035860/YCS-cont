#!/usr/bin/env python3
"""Smoke-test YCS on a real YouTube page in Chrome or Safari.

Opens a video, checks that YCS mounts, that Load all fetches comments, and that
search renders results. The extension must already be built/installed for the
chosen browser (see chrome.md / safari.md). Prints a JSON summary; exit 0 = PASS, 1 = FAIL,
2 = harness error.

Usage: smoke.py --browser chrome|safari [--video ID] [--query WORD] [--min-comments N]

Backends (both expose open(url) / js(body) / close()):
  chrome  agent-browser driving Chrome for Testing 131 headless with app/dist loaded
  safari  Apple's MCP server (`safaridriver --mcp`) over stdio; fresh logged-out session
"""

import argparse
import glob
import json
import os
import queue
import subprocess
import sys
import threading
import time

REPO = subprocess.run(
    ['git', '-C', os.path.dirname(os.path.abspath(__file__)), 'rev-parse', '--show-toplevel'],
    capture_output=True, text=True, check=True,
).stdout.strip()


def decode_js(text):
    """Both backends return the JS value JSON-encoded, so a returned
    JSON.stringify(...) arrives as a JSON string literal: decode twice."""
    value = json.loads(text)
    return json.loads(value) if isinstance(value, str) else value


class Chrome:
    SESSION = 'ycs-smoke'

    def __init__(self):
        matches = sorted(glob.glob(os.path.expanduser(
            '~/.cache/puppeteer/chrome/mac_arm-131.*/chrome-mac-arm64/'
            'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')))
        if not matches:
            raise RuntimeError('Chrome for Testing 131 not found (npx @puppeteer/browsers install chrome@131)')
        manifest = os.path.join(REPO, 'app/dist/manifest.json')
        if not os.path.exists(manifest) or '"service_worker"' not in open(manifest).read():
            raise RuntimeError('app/dist is not a Chrome build (run ./scripts/build-extension.sh chrome)')
        # A daemon left over from a previous run keeps its old launch flags. Relaunching
        # immediately after `close` fails with "Failed to connect: No such file or
        # directory"; ~1 s later it works.
        self._ab('close', check=False)
        time.sleep(2)
        self._ab('--executable-path', matches[-1], '--extension', os.path.join(REPO, 'app/dist'), 'open', 'about:blank')

    def _ab(self, *args, stdin=None, check=True):
        proc = subprocess.run(['agent-browser', '--session', self.SESSION, *args],
                              input=stdin, capture_output=True, text=True, timeout=120)
        if check and proc.returncode != 0:
            raise RuntimeError(f'agent-browser {args[0]}: {proc.stderr.strip() or proc.stdout.strip()}')
        return proc.stdout.strip()

    def open(self, url):
        # `open` would act on the initial about:blank target that CDP may not track; a new tab is reliable.
        self._ab('tab', 'new', url)

    def js(self, body):
        # agent-browser evaluates an expression, so wrap the function body in an IIFE.
        return decode_js(self._ab('eval', '--stdin', stdin=f'(() => {{ {body} }})()'))

    def screenshot(self, path):
        self._ab('screenshot', path)

    def close(self):
        self._ab('close', check=False)


def automation_safari_pids():
    proc = subprocess.run(['pgrep', '-f', 'MacOS/Safari .*--automation'], capture_output=True, text=True)
    return {int(p) for p in proc.stdout.split()}


class Safari:
    def __init__(self):
        # Each session launches its own `Safari --automation` instance (parent: launchd)
        # that outlives safaridriver; close() terminates the ones that appeared.
        self.preexisting = automation_safari_pids()
        self.proc = subprocess.Popen(
            ['/usr/bin/safaridriver', '--mcp'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, bufsize=1,
        )
        self.next_id = 0
        self.responses: 'queue.Queue[dict]' = queue.Queue()
        threading.Thread(target=self._read, daemon=True).start()
        self.request('initialize', {
            'protocolVersion': '2025-06-18',
            'capabilities': {},
            'clientInfo': {'name': 'ycs-smoke', 'version': '1'},
        })
        self._send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})

    def _read(self):
        for line in self.proc.stdout:
            try:
                self.responses.put(json.loads(line))
            except json.JSONDecodeError:
                pass

    def _send(self, msg):
        self.proc.stdin.write(json.dumps(msg) + '\n')
        self.proc.stdin.flush()

    def request(self, method, params, timeout=90):
        self.next_id += 1
        rid = self.next_id
        self._send({'jsonrpc': '2.0', 'id': rid, 'method': method, 'params': params})
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                msg = self.responses.get(timeout=1)
            except queue.Empty:
                if self.proc.poll() is not None:
                    raise RuntimeError('safaridriver --mcp exited')
                continue
            if msg.get('id') == rid:
                if 'error' in msg:
                    raise RuntimeError(f'{method}: {msg["error"]}')
                return msg['result']
        raise TimeoutError(f'{method} timed out after {timeout}s')

    def call(self, tool, args):
        result = self.request('tools/call', {'name': tool, 'arguments': args})
        text = '\n'.join(c.get('text', '') for c in result.get('content', []) if c.get('type') == 'text')
        if result.get('isError'):
            raise RuntimeError(f'{tool}: {text}')
        return text

    def open(self, url):
        self.call('create_tab', {'url': url})
        self.call('wait_for_navigation', {'timeout_seconds': 30})

    def js(self, body):
        return decode_js(self.call('evaluate_javascript', {'expression': body}))

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.terminate()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()
        for pid in automation_safari_pids() - self.preexisting:
            try:
                os.kill(pid, 15)
            except ProcessLookupError:
                pass


BACKENDS = {'chrome': Chrome, 'safari': Safari}


def wait_for(fn, timeout, interval=1.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = fn()
        if last.get('ok'):
            return last
        time.sleep(interval)
    return last


def run(page, args):
    checks = {}
    page.open(f'https://www.youtube.com/watch?v={args.video}')

    # Autoplay would SPA-navigate the tab to another video mid-test.
    state = wait_for(lambda: page.js("""
        document.querySelector('video')?.pause();
        const n = document.querySelectorAll('.ycs-app').length;
        if (n === 0) window.scrollBy(0, 400);
        return JSON.stringify({ ok: n > 0, apps: n, url: location.href });
    """), timeout=30, interval=2)
    state['ok'] = state.get('apps') == 1  # 2+ = a duplicate install (e.g. leftover Temporary Extension)
    checks['mounted'] = state
    if not state['ok']:
        return checks, False

    page.js("document.getElementById('ycs_load_stop')?.click(); return JSON.stringify({ ok: true });")
    time.sleep(1)
    page.js("""
        document.querySelector('video')?.pause();
        document.getElementById('ycs-load-all')?.click();
        return JSON.stringify({ ok: true });
    """)
    loaded = wait_for(lambda: page.js(f"""
        const n = parseInt((document.getElementById('ycs_cmnts')?.innerText || '').replace(/\\D/g, ''), 10) || 0;
        return JSON.stringify({{ ok: n >= {args.min_comments}, comments: n }});
    """), timeout=60, interval=2)
    page.js("document.getElementById('ycs_load_stop')?.click(); return JSON.stringify({ ok: true });")
    checks['load_comments'] = loaded
    if not loaded.get('ok'):
        return checks, False

    time.sleep(1)
    page.js(f"""
        const input = document.getElementById('ycs-input-search');
        input.value = {json.dumps(args.query)};
        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
        document.getElementById('ycs_btn_search')?.click();
        return JSON.stringify({{ ok: true }});
    """)
    search = wait_for(lambda: page.js("""
        const text = document.getElementById('ycs-search-total-result')?.innerText || '';
        const m = text.match(/Found:\\s*(\\d+)/);
        return JSON.stringify({
            ok: !!m && Number(m[1]) > 0 && document.querySelectorAll('.ycs-render-comment').length > 0,
            text,
            found: m ? Number(m[1]) : null,
            rendered: document.querySelectorAll('.ycs-render-comment').length,
        });
    """), timeout=20, interval=1)
    checks['search'] = search
    return checks, bool(search.get('ok'))


def main():
    # Defaults: a stable, logged-out-playable video with millions of comments, and a
    # common word so the search is sure to hit.
    ap = argparse.ArgumentParser()
    ap.add_argument('--browser', required=True, choices=sorted(BACKENDS))
    ap.add_argument('--video', default='jNQXAC9IVRw')
    ap.add_argument('--query', default='the')
    ap.add_argument('--min-comments', type=int, default=200)
    args = ap.parse_args()

    page = None
    try:
        page = BACKENDS[args.browser]()
        checks, passed = run(page, args)
        print(json.dumps({'browser': args.browser, 'result': 'PASS' if passed else 'FAIL', 'checks': checks},
                         ensure_ascii=False, indent=2))
        return 0 if passed else 1
    except Exception as err:  # harness problem, not a YCS verdict
        print(json.dumps({'browser': args.browser, 'result': 'ERROR', 'error': f'{type(err).__name__}: {err}'},
                         ensure_ascii=False, indent=2))
        return 2
    finally:
        if page:
            page.close()


if __name__ == '__main__':
    sys.exit(main())
