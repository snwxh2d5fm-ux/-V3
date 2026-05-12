"""
住港伴 OCR 服务
FastAPI + PaddleOCR，通过 CloudBase AnyService 供小程序安全调用

启动: uvicorn main:app --host 0.0.0.0 --port 8080
"""
import base64
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ocr_engine import recognize, extract_fields, verify_match

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="住港伴 OCR Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class VerifyRequest(BaseModel):
    image: str           # base64 图片
    doc_type: str        # submission_receipt | hk_id_visa | hk_permanent_id
    selected_path: str   # submitted_qmas | submitted_ttps | ...


@app.get("/health")
async def health():
    return {"status": "ok", "service": "zhugangban-ocr"}


@app.post("/ocr/verify")
async def verify(req: VerifyRequest):
    """OCR 识别 + 路径校验"""
    try:
        # 解码 base64
        image_bytes = base64.b64decode(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="图片解码失败")

    # OCR 识别
    try:
        text = recognize(image_bytes)
        logger.info(f"OCR 识别完成, doc_type={req.doc_type}, text_len={len(text)}")
    except Exception as e:
        logger.error(f"OCR 识别异常: {e}")
        raise HTTPException(status_code=500, detail="OCR 识别失败")

    if not text:
        return {
            "code": 0,
            "data": {
                "summary": "未识别到文字",
                "fields": [{"label": "状态", "value": "无法识别，请重新拍照"}],
                "matched": False,
                "ocr_available": True,
                "expected_type": "",
                "extracted_type": "",
                "warning": "未能从图片中识别到文字，请确保拍摄清晰"
            }
        }

    # 提取字段
    fields = extract_fields(req.doc_type, text)

    # 提取申请类别
    type_field = next((f for f in fields if f["label"] in ("申请类别", "签证类型")), None)
    extracted_type = type_field["value"] if type_field else ""

    # 比对
    matched, warning = verify_match(extracted_type, req.selected_path)

    summary_parts = []
    for f in fields:
        summary_parts.append(f"{f['label']}:{f['value']}")
    summary = " · ".join(summary_parts[:3])

    return {
        "code": 0,
        "data": {
            "summary": summary or "识别完成",
            "fields": fields,
            "matched": matched,
            "ocr_available": True,
            "expected_type": PATH_MAP.get(req.selected_path, ""),
            "extracted_type": extracted_type,
            "warning": warning
        }
    }


PATH_MAP = {
    'submitted_qmas': '优才', 'submitted_ttps': '高才通',
    'submitted_asmpt': '专才', 'submitted_iang': 'IANG',
    'submitted_cies': '投资移民', 'submitted_techtas': '科技人才',
    'approved_employed': '在港就业', 'approved_business': '在港创业',
    'approved_studying': '在港学习', 'approved_mainland': '主要在内地',
}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
