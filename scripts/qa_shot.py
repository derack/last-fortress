"""qa_shot.py — اسکرین‌شات assets-preview با playwright (بدون agent-browser)."""
import sys, time
from playwright.sync_api import sync_playwright

shots = sys.argv[1:] or ['arman']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1150, 'height': 900})
    pg.goto('http://localhost:3000/assets-preview', wait_until='networkidle', timeout=90000)
    time.sleep(6)
    for cid in shots:
        pg.select_option('select >> nth=0', cid)
        time.sleep(7)
        pg.screenshot(path=f'scripts/qa_web_{cid}.png')
        print('saved', f'scripts/qa_web_{cid}.png')
    b.close()
