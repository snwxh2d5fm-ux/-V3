"""
住港伴 OCR 服务 — PaddleOCR 引擎
部署在轻量服务器，通过 AnyService 供小程序调用
"""
from paddleocr import PaddleOCR
import re
import logging

logger = logging.getLogger(__name__)

# 初始化（只加载一次）
_ocr = None

def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(
            use_angle_cls=True,
            lang='ch',  # 中英文混合
            use_gpu=False,
            show_log=False
        )
    return _ocr


def recognize(image_bytes: bytes) -> str:
    """识别图片，返回文本"""
    ocr = get_ocr()
    result = ocr.ocr(image_bytes, cls=True)
    if not result or not result[0]:
        return ""
    lines = []
    for line in result[0]:
        text = line[1][0]
        confidence = line[1][1]
        if confidence > 0.5:
            lines.append(text)
    return "\n".join(lines)


def extract_fields(doc_type: str, text: str) -> list[dict]:
    """从 OCR 文本中提取结构化字段"""
    fields = []

    if doc_type == "submission_receipt":
        # 申请编号: GB/RC/RN + 数字
        ref = re.search(r'[A-Z]{2,4}[-\s]?\d{6,10}', text)
        if ref:
            fields.append({"label": "申请编号", "value": ref.group()})
        # 日期
        date = re.search(r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[年-]\d{1,2}[月-]\d{1,2})', text)
        if date:
            fields.append({"label": "递交日期", "value": date.group()})
        # 申请类别
        cat = re.search(r'(優才|高才通|專才|IANG|受養人|投資移民|科技人才|优才|高才|专才)', text)
        if cat:
            # 统一为简体
            cat_map = {"優才": "优才", "專才": "专才", "受養人": "受养人"}
            val = cat_map.get(cat.group(), cat.group())
            fields.append({"label": "申请类别", "value": val})
        if not fields:
            fields.append({"label": "状态", "value": "回执已识别"})

    elif doc_type == "hk_id_visa":
        # 香港身份证号
        hkid = re.search(r'[A-Z]\d{6}\([A-Z0-9]\)', text)
        if hkid:
            fields.append({"label": "身份证号", "value": hkid.group()})
        # 签证类型
        visa = re.search(r'(優才|高才通|專才|IANG|學生|受養人|工作|投資|优才|高才|专才|学生)', text)
        if visa:
            cat_map = {"優才": "优才", "專才": "专才", "受養人": "受养人", "學生": "学生"}
            val = cat_map.get(visa.group(), visa.group())
            fields.append({"label": "签证类型", "value": val})
        # 有效期
        expiry = re.search(r'有效期[至到:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})', text)
        if expiry:
            fields.append({"label": "有效期至", "value": expiry.group(1)})
        if not fields:
            fields.append({"label": "状态", "value": "证件已识别"})

    elif doc_type == "hk_permanent_id":
        hkid = re.search(r'[A-Z]\d{6}\([A-Z0-9]\)', text)
        if hkid:
            fields.append({"label": "身份证号", "value": hkid.group()})
        perm = re.search(r'(永久|PERMANENT|三顆星|\*\*\*)', text, re.I)
        if perm:
            fields.append({"label": "永居标识", "value": "已确认"})
        if not fields:
            fields.append({"label": "状态", "value": "永居身份证已识别"})

    return fields


PATH_MAP = {
    'submitted_qmas': '优才', 'submitted_ttps': '高才通',
    'submitted_asmpt': '专才', 'submitted_iang': 'IANG',
    'submitted_cies': '投资移民', 'submitted_techtas': '科技人才',
    'approved_employed': '在港就业', 'approved_business': '在港创业',
    'approved_studying': '在港学习', 'approved_mainland': '主要在内地',
}


def verify_match(extracted_type: str, selected_path: str) -> tuple[bool, str]:
    """比对识别结果与所选路径"""
    expected = PATH_MAP.get(selected_path, '')
    if not extracted_type or not expected:
        return True, ''
    if extracted_type in expected or expected in extracted_type:
        return True, ''
    return False, f'识别到「{extracted_type}」，你选择的是「{expected}」。请确认资料与所选路径一致。'
