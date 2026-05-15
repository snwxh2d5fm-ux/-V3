#!/usr/bin/env python3
"""
住港伴 V3 — PROGRESS.md → Notion 同步脚本
由 BI天枢(Hermes) 维护
用法: python3 scripts/sync_notion.py
"""

import os
import re
import json
import subprocess
from datetime import datetime

PROGRESS_PATH = "/Users/chillment/Downloads/港动人生/住港伴V3-开发中/PROGRESS.md"
NOTION_DB = "7d9b646a-4d6b-4508-92cf-fc2da7175281"
NOTION_KEY = os.environ.get("NOTION_API_KEY", "")

if not NOTION_KEY:
    print("❌ NOTION_API_KEY not set")
    exit(1)

# ========== Parse PROGRESS.md ==========

def parse_section(text, header):
    """Extract markdown table rows under a given header"""
    pattern = rf'{header}.*?\n(.*?)(?=\n## |$)'
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        return []
    table_text = match.group(1)
    rows = []
    for line in table_text.split('\n'):
        line = line.strip()
        if line.startswith('|') and not line.startswith('|---') and not line.startswith('||'):
            cols = [c.strip() for c in line.split('|')[1:-1]]
            if len(cols) >= 2 and cols[0]:
                rows.append(cols)
    return rows

def parse_progress():
    with open(PROGRESS_PATH) as f:
        text = f.read()
    
    # Extract metadata
    last_update = re.search(r'\*\*最后更新\*\*:\s*(.*)', text)
    status_line = re.search(r'\*\*状态\*\*:\s*(.*)', text)
    
    # Parse phases
    phases = parse_section(text, '当前阶段')
    gates = parse_section(text, '闸门状态')
    blockers = parse_section(text, '阻塞项')
    p0 = parse_section(text, 'P0修复')
    p1 = parse_section(text, 'P1修复进度')
    e2e = parse_section(text, 'E2E测试')
    next_steps = parse_section(text, '下一步')
    
    return {
        "last_update": last_update.group(1).strip() if last_update else "",
        "status": status_line.group(1).strip() if status_line else "",
        "phases": phases,
        "gates": gates,
        "blockers": blockers,
        "p0": p0,
        "p1": p1,
        "e2e": e2e,
        "next_steps": next_steps
    }

# ========== Notion API helpers ==========

def notion_api(method, path, data=None):
    cmd = [
        'curl', '-s', '-X', method,
        f'https://api.notion.com/v1{path}',
        '-H', f'Authorization: Bearer {NOTION_KEY}',
        '-H', 'Notion-Version: 2025-09-03',
        '-H', 'Content-Type: application/json'
    ]
    if data:
        cmd += ['-d', json.dumps(data, ensure_ascii=False)]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        print(f"❌ API error: {result.stderr}")
        return {}
    try:
        return json.loads(result.stdout)
    except:
        return {}

def get_db_pages():
    """Get all pages in the database"""
    data_source_id = "8b9216a1-5f8e-441d-ae3b-7b90667964ab"
    results = notion_api('POST', f'/data_sources/{data_source_id}/query', {"page_size": 50})
    return results.get('results', [])

def update_page(page_id, properties):
    return notion_api('PATCH', f'/pages/{page_id}', {"properties": properties})

def create_page(properties):
    return notion_api('POST', '/pages', {
        "parent": {"type": "database_id", "database_id": NOTION_DB},
        "properties": properties
    })

# ========== Sync Logic ==========

def map_status(emoji_text):
    """Map PROGRESS.md status to Notion select options"""
    if '✅' in emoji_text or '完成' in emoji_text or '闭环' in emoji_text:
        return "✅ 完成"
    if '🔴' in emoji_text or '阻塞' in emoji_text:
        return "🔴 阻塞"
    if '🟡' in emoji_text or '进行中' in emoji_text:
        return "🟡 进行中"
    if '⏳' in emoji_text or '待' in emoji_text:
        return "⏳ 待开始"
    return "⏳ 待开始"

def map_phase(name):
    """Map phase name to select option"""
    phase_map = {
        "Phase 0": "Phase 0 攻略书架构",
        "Phase 1": "Phase 1 攻略书核心功能", 
        "Phase 2": "Phase 2 攻略书+找房向导",
        "Phase 3": "Phase 3 证件夹+预审",
        "P0": "P0缺陷修复批次",
        "P1": "P1缺陷修复批次",
    }
    for k, v in phase_map.items():
        if name.startswith(k):
            return v
    return "P1缺陷修复批次"

def sync():
    data = parse_progress()
    print(f"📖 PROGRESS.md loaded: {data['last_update']}")
    print(f"📊 Status: {data['status']}")
    
    existing_pages = get_db_pages()
    page_map = {}
    for p in existing_pages:
        props = p.get('properties', {})
        title = ''
        if 'Name' in props and props['Name'].get('title'):
            title = ''.join(t.get('plain_text', '') for t in props['Name']['title'])
        page_map[title] = p['id']
    
    print(f"📋 Found {len(page_map)} existing pages in Notion")
    
    # Sync phases
    for row in data['phases']:
        if len(row) >= 2:
            name = row[0]
            status = row[1]
            title = f"{name}"
            
            props = {
                "阶段": {"select": {"name": map_phase(name)}},
                "状态": {"select": {"name": map_status(status)}},
                "进度": {"number": 100 if map_status(status) == "✅ 完成" else 0},
                "说明": {"rich_text": [{"text": {"content": f"最后更新: {data['last_update']}"}}]}
            }
            
            # Find matching page (fuzzy)
            matched = None
            for k, pid in page_map.items():
                if name in k:
                    matched = pid
                    break
            
            if matched:
                update_page(matched, props)
                print(f"  ✅ Updated: {name}")
            else:
                props["Name"] = {"title": [{"text": {"content": title}}]}
                create_page(props)
                print(f"  ✨ Created: {name}")
    
    # Sync gate status
    gate_count = len([g for g in data['gates'] if g])
    gate_status = "⏳ 待开始"
    gate_progress = 0
    for g in data['gates']:
        if len(g) >= 3:
            if '✅' in g[2]:
                gate_progress += 1
    
    if gate_progress > 0:
        gate_status = f"🟡 进行中 ({gate_progress}/{gate_count})"
        gate_progress = int(gate_progress / max(gate_count, 1) * 100)
    
    # Update gate page
    gate_title = "闸门状态"
    for k, pid in page_map.items():
        if gate_title in k:
            update_page(pid, {
                "状态": {"select": {"name": gate_status}},
                "进度": {"number": gate_progress},
                "说明": {"rich_text": [{"text": {"content": f"最后同步: {data['last_update']} | 状态: {data['status']}"}}]}
            })
            break
    
    print(f"\n🎯 Sync complete at {datetime.now().isoformat()}")

if __name__ == '__main__':
    sync()
