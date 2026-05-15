#!/usr/bin/env python3
"""
Transform onboarding-tasks.js → JSONL for CloudBase NoSQL import v6.1

Reads the JS source as text, parses it (handling embedded quotes),
applies snake_case transformations, adds v6.1 fields, outputs JSONL.
"""

import json
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(SCRIPT_DIR, '..', 'data', 'onboarding-tasks.js')
OUTPUT = os.path.join(SCRIPT_DIR, 'life_guide_tasks.jsonl')


# ═════════════════════════════════════════════════════════════════════════════
# JS Object Parser (handles known embedded-quote issues inline)
# ═════════════════════════════════════════════════════════════════════════════

def fix_embedded_quotes(text):
    """Replace known ASCII double-quotes inside string content with Chinese curly quotes."""
    fixes = [
        ('content: "地址证明通常要求"近3个月内"，每季度需要新的账单"',
         'content: "地址证明通常要求“近3个月内”，每季度需要新的账单"'),
        ('content: "smartplay.lcsd.gov.hk，需先用"智方便"即时认证"',
         'content: "smartplay.lcsd.gov.hk，需先用“智方便”即时认证"'),
        ('content: "下载"智方便iAM Smart"→"一按升级智方便+"→拍摄身份证→NFC读取→容貌辨识"',
         'content: "下载“智方便iAM Smart”→“一按升级智方便+”→拍摄身份证→NFC读取→容貌辨识"'),
        ('content: "方式一：经"智方便+"网上申请（即时生效，可凭智能身份证借书）；方式二：网上申请电子账户（仅电子资源）；方式三：亲临图书馆"',
         'content: "方式一：经“智方便+”网上申请（即时生效，可凭智能身份证借书）；方式二：网上申请电子账户（仅电子资源）；方式三：亲临图书馆"'),
        ('content: "App Store/Google Play搜索"HA Go"，用香港手机号注册"',
         'content: "App Store/Google Play搜索“HA Go”，用香港手机号注册"'),
        ('content: "HA Go→"预约家庭医学诊所"→选择诊所→接纳预约时间，\U0001f511抢号秘诀：每小时的29分和59分刷新App"',
         'content: "HA Go→“预约家庭医学诊所”→选择诊所→接纳预约时间，\U0001f511抢号秘诀：每小时的29分和59分刷新App"'),
        ('Meetup.com搜索"Hong Kong hiking/board games/language exchange"',
         'Meetup.com搜索“Hong Kong hiking/board games/language exchange”'),
    ]
    for old, new in fixes:
        if old in text:
            text = text.replace(old, new)
    return text


def extract_objects(text):
    """Extract top-level JS object literals from array."""
    objects = []
    depth = 0
    in_string = False
    string_char = None
    current_start = None

    i = 0
    while i < len(text):
        ch = text[i]

        if in_string:
            if ch == '\\':
                i += 2
                continue
            elif ch == string_char:
                in_string = False
            i += 1
            continue

        if ch in '"\'':
            in_string = True
            string_char = ch
            i += 1
            continue

        if ch == '{':
            if depth == 0:
                current_start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and current_start is not None:
                objects.append(text[current_start:i+1])
                current_start = None

        i += 1

    return objects


def parse_js_value(text):
    """Parse a JS value into a Python object."""
    text = text.strip()
    if not text:
        return None
    if text == 'null' or text == 'undefined':
        return None
    if text == 'true':
        return True
    if text == 'false':
        return False

    # Try number
    try:
        if '.' in text and re.match(r'^-?\d+\.?\d*$', text):
            return float(text)
        if text.isdigit() or (text.startswith('-') and text[1:].isdigit()):
            return int(text)
    except ValueError:
        pass

    # String
    if (text.startswith('"') and text.endswith('"')) or \
       (text.startswith("'") and text.endswith("'")):
        inner = text[1:-1]
        inner = inner.replace('\\n', '\n').replace('\\t', '\t')
        # Unescape remaining escapes
        inner = inner.replace('\\"', '"').replace("\\'", "'")
        return inner

    # Array
    if text.startswith('[') and text.endswith(']'):
        return parse_js_array(text)

    # Object
    if text.startswith('{') and text.endswith('}'):
        return simple_parse(text)

    # Fallback (identifier or unknown)
    return text


def parse_js_array(text):
    """Parse a JS array literal."""
    text = text.strip()
    if text.startswith('[') and text.endswith(']'):
        text = text[1:-1]

    items = []
    i = 0
    while i < len(text):
        while i < len(text) and text[i] in ' \t\n\r,':
            i += 1
        if i >= len(text):
            break

        ch = text[i]

        if ch == '{':
            depth = 1
            start = i
            i += 1
            in_str = False
            sc = None
            while i < len(text) and depth > 0:
                c = text[i]
                if in_str:
                    if c == '\\':
                        i += 2
                        continue
                    elif c == sc:
                        in_str = False
                elif c in '"\'':
                    in_str = True
                    sc = c
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                i += 1
            items.append(simple_parse(text[start:i]))

        elif ch == '[':
            depth = 1
            start = i
            i += 1
            in_str = False
            sc = None
            while i < len(text) and depth > 0:
                c = text[i]
                if in_str:
                    if c == '\\':
                        i += 2
                        continue
                    elif c == sc:
                        in_str = False
                elif c in '"\'':
                    in_str = True
                    sc = c
                elif c == '[':
                    depth += 1
                elif c == ']':
                    depth -= 1
                i += 1
            items.append(parse_js_value(text[start:i]))

        elif ch in '"\'':
            quote = ch
            i += 1
            val = ''
            while i < len(text) and text[i] != quote:
                if text[i] == '\\':
                    i += 1
                    if i < len(text):
                        val += text[i]
                else:
                    val += text[i]
                i += 1
            i += 1
            items.append(val)

        else:
            val_start = i
            while i < len(text) and text[i] not in ',]\n':
                i += 1
            val_str = text[val_start:i].strip()
            items.append(parse_js_literal(val_str))

    return items


def parse_js_literal(val_str):
    """Parse a literal value (number, bool, null, or string fallback)."""
    if val_str == 'null':
        return None
    if val_str == 'true':
        return True
    if val_str == 'false':
        return False
    try:
        if '.' in val_str and re.match(r'^-?\d+\.?\d*$', val_str):
            return float(val_str)
        if val_str.isdigit() or (val_str.startswith('-') and val_str[1:].isdigit()):
            return int(val_str)
    except ValueError:
        pass
    return val_str


def read_balanced(text, start, open_ch, close_ch):
    """Read a balanced brace/bracket from position start (at the opening char)."""
    depth = 1
    i = start + 1
    in_str = False
    sc = None
    while i < len(text) and depth > 0:
        c = text[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            elif c == sc:
                in_str = False
        elif c in '"\'':
            in_str = True
            sc = c
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
        i += 1
    return i


def simple_parse(obj_text):
    """Parse a JS object literal into a Python dict."""
    obj_text = obj_text.strip()
    if obj_text.startswith('{') and obj_text.endswith('}'):
        obj_text = obj_text[1:-1]

    result = {}
    i = 0
    while i < len(obj_text):
        # Skip whitespace and commas
        while i < len(obj_text) and obj_text[i] in ' \t\n\r,':
            i += 1
        if i >= len(obj_text):
            break

        # Read key
        if obj_text[i] in '"\'':
            quote = obj_text[i]
            i += 1
            key = ''
            while i < len(obj_text) and obj_text[i] != quote:
                if obj_text[i] == '\\':
                    i += 1
                    if i < len(obj_text):
                        key += obj_text[i]
                else:
                    key += obj_text[i]
                i += 1
            i += 1
        else:
            key_start = i
            while i < len(obj_text) and obj_text[i] not in ' \t\n\r,:{}[]"\'':
                i += 1
            key = obj_text[key_start:i]

        # Skip :
        while i < len(obj_text) and obj_text[i] in ' \t\n\r':
            i += 1
        if i < len(obj_text) and obj_text[i] == ':':
            i += 1
        while i < len(obj_text) and obj_text[i] in ' \t\n\r':
            i += 1

        if i >= len(obj_text):
            break

        # Read value
        ch = obj_text[i]
        if ch == '{':
            end = read_balanced(obj_text, i, '{', '}')
            result[key] = simple_parse(obj_text[i:end])
            i = end
        elif ch == '[':
            end = read_balanced(obj_text, i, '[', ']')
            result[key] = parse_js_value(obj_text[i:end])
            i = end
        elif ch in '"\'':
            quote = ch
            i += 1
            val = ''
            while i < len(obj_text) and obj_text[i] != quote:
                if obj_text[i] == '\\':
                    i += 1
                    if i < len(obj_text):
                        val += obj_text[i]
                else:
                    val += obj_text[i]
                i += 1
            i += 1
            result[key] = val
        else:
            val_start = i
            while i < len(obj_text) and obj_text[i] not in ',}\n':
                i += 1
            val_str = obj_text[val_start:i].strip()
            result[key] = parse_js_literal(val_str)

    return result


# ═════════════════════════════════════════════════════════════════════════════
# Transform rules
# ═════════════════════════════════════════════════════════════════════════════

SCENE_TAGS = {
    'onboard-001': ['证件'], 'onboard-002': ['证件'], 'onboard-003': ['证件'],
    'onboard-004': ['证件'], 'onboard-005': ['证件'],
    'onboard-101': ['交通','支付'], 'onboard-102': ['通讯'], 'onboard-103': ['支付'],
    'onboard-104': ['证件'], 'onboard-105': ['交通'],
    'onboard-201': ['银行','证件'], 'onboard-202': ['住房'], 'onboard-203': ['医疗'],
    'onboard-204': ['运动'], 'onboard-205': ['证件'], 'onboard-206': ['住房'],
    'onboard-207': ['社区'],
    'onboard-300': ['住房'], 'onboard-301': ['住房'], 'onboard-302': ['住房'],
    'onboard-303': ['保险','住房'], 'onboard-304': ['通讯'], 'onboard-305': ['搬家'],
    'onboard-306': ['社区'], 'onboard-307': ['搬家'],
    'onboard-308': ['住房'], 'onboard-309': ['住房'], 'onboard-310': ['住房'],
    'onboard-311': ['住房'], 'onboard-312': ['住房'],
    'onboard-401': ['交通','证件'], 'onboard-402': ['交通'], 'onboard-403': ['运动'],
    'onboard-404': ['医疗'], 'onboard-405': ['社区'], 'onboard-406': ['社区'],
    'onboard-407': ['税务'], 'onboard-408': ['社区'],
    'onboard-501a': ['教育'], 'onboard-502a': ['教育'], 'onboard-503a': ['教育'],
    'onboard-504a': ['教育'], 'onboard-505a': ['教育'],
    'onboard-501b': ['教育'], 'onboard-502b': ['教育'], 'onboard-503b': ['教育'],
    'onboard-504b': ['教育'], 'onboard-505b': ['教育'], 'onboard-506b': ['教育'],
    'onboard-507b': ['教育'],
    'onboard-601': ['税务'], 'onboard-602': ['税务'], 'onboard-603': ['银行'],
    'onboard-604': ['住房'], 'onboard-605': ['银行'], 'onboard-606': ['税务'],
    'onboard-701': ['证件'], 'onboard-702': ['证件'], 'onboard-703': ['住房'],
    'onboard-704': ['住房'], 'onboard-705': ['证件'],
}


def make_quick_answer(task):
    steps = task.get('steps', []) or []
    if not steps:
        return (task.get('title', '') or '')[:50]
    content = (steps[0].get('content', '') or '')
    first_sent = content.split('。')[0].strip()
    cleaned = re.sub(r'^[^：:]*[：:]\s*', '', first_sent)
    return cleaned[:50]


def make_search_keywords(task):
    combined = f"{task.get('title', '')} {task.get('subtitle', '')}"
    skip = {'的', '了', '在', '是', '不', '一', '就', '有', '和', '与', '都', '要',
            '能', '可以', '会', '也', '到', '这', '那', '被', '让', '把', '从',
            '对', '比', '最', '更', '很'}
    words = []
    parts = re.split(r'[———\-—,，。\s/]+', combined)
    for p in parts:
        t = p.strip()
        if len(t) >= 2 and t not in skip and not re.match(r'^[a-zA-Z0-9+@.$%#]+$', t):
            words.append(t)
    if len(words) < 2:
        title_words = [w for w in re.split(r'[——\-—,，。\s/]+', task.get('title', ''))
                       if len(w.strip()) >= 2 and w.strip() not in skip]
        return [w.strip() for w in title_words[:4]]
    seen = []
    for w in words:
        if w not in seen:
            seen.append(w)
    return seen[:4]


def make_reminder_config(task_id):
    if task_id == 'onboard-301':
        return {"trigger_on_complete": True, "auto_reminder_days": 365, "reminder_text": None}
    if task_id == 'onboard-601':
        return {"trigger_on_complete": False, "auto_reminder_days": 365, "reminder_text": None}
    return {"trigger_on_complete": False, "auto_reminder_days": None, "reminder_text": None}


def transform_renewal_evidence(re):
    if not re:
        return None
    out = {}
    if 'produces' in re:
        out['produces'] = re['produces']
    if 'docType' in re:
        out['doc_type'] = re['docType']
    if 'docCategory' in re:
        out['doc_category'] = re['docCategory']
    if 'collectMethod' in re:
        out['collect_method'] = re['collectMethod']
    if 'isRequiredForRenewal' in re:
        out['is_required'] = re['isRequiredForRenewal']
    if 'expiryCheck' in re:
        out['expiry_check'] = re['expiryCheck']
    if 'renewalTip' in re:
        out['renewal_tip'] = re['renewalTip']
    return out


def transform_applicable_to(at):
    if not at:
        return None
    return {
        "visa_types": at.get('visaTypes', 'all'),
        "family_status": at.get('familyStatus', 'all'),
        "arrival_scenario": at.get('arrivalScenario', []),
        "skip_if_existing": at.get('skipIfExisting', []),
    }


def transform_task(t):
    task_id = t.get('id', '') or ''
    scene_tags = SCENE_TAGS.get(task_id, ['证件'])
    reminder_config = make_reminder_config(task_id)
    quick_answer = make_quick_answer(t)
    search_keywords = make_search_keywords(t)
    applicable_to = transform_applicable_to(t.get('applicableTo'))

    official_links = []
    for link in (t.get('officialLinks', []) or []):
        if isinstance(link, dict):
            official_links.append({"label": link.get('label', ''), "url": link.get('url', '')})

    required_items = t.get('requiredItems', []) or []

    steps = []
    for s in (t.get('steps', []) or []):
        if isinstance(s, dict):
            steps.append({
                "seq": s.get('seq', 0),
                "title": s.get('title', ''),
                "content": s.get('content', ''),
                "type": s.get('type', 'info'),
            })

    renewal_evidence = transform_renewal_evidence(t.get('renewalEvidence'))

    return {
        "_id": task_id,
        "id": task_id,
        "phase": t.get('phase', 0),
        "sequence": t.get('sequence', 0),
        "category": t.get('category', ''),
        "title": t.get('title', ''),
        "subtitle": t.get('subtitle', ''),
        "time_estimate": t.get('timeEstimate', ''),
        "urgency": t.get('urgency', ''),
        "icon": t.get('icon', ''),
        "applicable_to": applicable_to,
        "steps": steps,
        "required_items": required_items,
        "official_links": official_links,
        "tips": t.get('tips', []) or [],
        "pitfalls": t.get('pitfalls', []) or [],
        "renewal_evidence": renewal_evidence,
        "scene_tags": scene_tags,
        "reminder_config": reminder_config,
        "ai_context": {
            "search_keywords": search_keywords,
            "k0_domain": True,
            "quick_answer": quick_answer,
        },
        "status": "active",
    }


def main():
    with open(SOURCE, 'r', encoding='utf-8') as f:
        text = f.read()

    # Fix embedded quote issues before parsing
    text = fix_embedded_quotes(text)

    # Parse object literals
    objects = extract_objects(text)

    # Parse each object into a Python dict
    tasks = []
    for obj_text in objects:
        parsed = simple_parse(obj_text)
        if parsed.get('id'):  # Only keep objects with an id field
            tasks.append(parsed)

    print(f"Parsed {len(tasks)} valid tasks")

    # Transform
    transformed = [transform_task(t) for t in tasks]

    # Write JSONL
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        for obj in transformed:
            f.write(json.dumps(obj, ensure_ascii=False) + '\n')

    print(f"Written {len(transformed)} lines to {OUTPUT}")

    # Verify
    ids = [t['id'] for t in transformed]
    expected_ids = [
        'onboard-001','onboard-002','onboard-003','onboard-004','onboard-005',
        'onboard-101','onboard-102','onboard-103','onboard-104','onboard-105',
        'onboard-201','onboard-202','onboard-203','onboard-204','onboard-205','onboard-206','onboard-207',
        'onboard-301','onboard-302','onboard-303','onboard-304','onboard-305','onboard-306','onboard-307',
        'onboard-401','onboard-402','onboard-403','onboard-404','onboard-405','onboard-406','onboard-407','onboard-408',
        'onboard-300','onboard-308','onboard-309','onboard-310','onboard-311','onboard-312',
        'onboard-501a','onboard-502a','onboard-503a','onboard-504a','onboard-505a',
        'onboard-501b','onboard-502b','onboard-503b','onboard-504b','onboard-505b','onboard-506b','onboard-507b',
        'onboard-601','onboard-602','onboard-603','onboard-604','onboard-605','onboard-606',
        'onboard-701','onboard-702','onboard-703','onboard-704','onboard-705',
    ]
    assert len(ids) == len(expected_ids) == 61
    assert ids == expected_ids
    print(f"All {len(ids)} IDs match source order and count = 61 ✓")

    # Build lookup for spot-checks
    by_id = {t['id']: t for t in transformed}

    # Spot-check onboard-301 (租约厘印, has time-sensitive reminder)
    t301 = by_id['onboard-301']
    assert t301['time_estimate'] == '2-3小时'
    assert t301['scene_tags'] == ['住房']
    assert t301['reminder_config'] == {"trigger_on_complete": True, "auto_reminder_days": 365, "reminder_text": None}
    assert t301['required_items'] == ['HK身份证', '现金/支票（按金+首月租金+佣金+印花税）']
    assert t301['renewal_evidence']['is_required'] == True
    assert t301['renewal_evidence']['doc_type'] == '已打厘印租约'
    assert t301['renewal_evidence']['doc_category'] == 'address'
    assert 'status' in t301 and t301['status'] == 'active'
    print("Spot-check onboard-301 ✓")

    # Spot-check onboard-601 (首次报税, yearly reminder)
    t601 = by_id['onboard-601']
    assert t601['time_estimate'] == '20分钟'
    assert t601['scene_tags'] == ['税务']
    assert t601['reminder_config'] == {"trigger_on_complete": False, "auto_reminder_days": 365, "reminder_text": None}
    print("Spot-check onboard-601 ✓")

    # Spot-check onboard-300 (simplified, no steps content but has tips)
    t300 = by_id['onboard-300']
    assert t300['renewal_evidence']['produces'] == False
    assert t300['applicable_to']['visa_types'] == 'all'
    assert t300['applicable_to']['skip_if_existing'] == []
    assert len(t300['steps']) == 2
    print("Spot-check onboard-300 ✓")

    # Check phased tasks
    phased = {t['id']: t['phase'] for t in transformed}
    assert all(phased[id] == 0 for id in ['onboard-001','onboard-002','onboard-003','onboard-004','onboard-005'])
    assert all(phased[id] == 3 for id in ['onboard-300','onboard-301','onboard-302','onboard-303','onboard-304','onboard-305','onboard-306','onboard-307','onboard-308','onboard-309','onboard-310','onboard-311','onboard-312'])
    assert all(phased[id] == 5 for id in ['onboard-501a','onboard-502a','onboard-503a','onboard-504a','onboard-505a','onboard-501b','onboard-502b','onboard-503b','onboard-504b','onboard-505b','onboard-506b','onboard-507b'])
    assert all(phased[id] == 7 for id in ['onboard-701','onboard-702','onboard-703','onboard-704','onboard-705'])
    print("Phase assignments ✓")

    # Verify removed fields do not exist
    for t in transformed:
        assert 'reminderTrigger' not in t
        assert 'documentLink' not in t
        assert 'aiChatContext' not in t
        assert 'timeEstimate' not in t
    print("Removed fields confirmed absent ✓")

    # Verify all have _id
    for t in transformed:
        assert t['_id'] == t['id']
    print("_id == id ✓")

    print("\n\xe2\x9c\x85 All 61 tasks transformed successfully!")


if __name__ == '__main__':
    main()
