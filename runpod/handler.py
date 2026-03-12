import runpod
import base64
import tempfile
import os
import json
import torch
import numpy as np

def load_model():
    """P3-SAM 모델 로드 (콜드 스타트 시 1회만 실행)"""
    from huggingface_hub import hf_hub_download
    import sys
    sys.path.append("/app/P3-SAM")
    
    checkpoint = hf_hub_download(
        repo_id="tencent/Hunyuan3D-Part",
        filename="p3sam.safetensors",
        local_dir="/app/weights"
    )
    
    from p3sam.models import P3SAM
    model = P3SAM()
    model.load_state_dict(torch.load(checkpoint, map_location="cuda"))
    model.eval().cuda()
    return model

# 서버 시작 시 모델 로드 (워커 유지되면 재사용됨)
print("모델 로딩 중...")
model = load_model()
print("모델 로딩 완료!")

def handler(job):
    """
    RunPod Serverless 핸들러
    
    Input:
        job["input"]["glb"] — base64 인코딩된 GLB 파일
        job["input"]["filename"] — 파일명 (옵션)
    
    Output:
        {"parts": [...], "count": N}
    """
    try:
        job_input = job["input"]
        
        # base64 GLB 디코딩
        glb_b64 = job_input.get("glb")
        if not glb_b64:
            return {"error": "GLB 파일이 없습니다"}
        
        glb_bytes = base64.b64decode(glb_b64)
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
            f.write(glb_bytes)
            tmp_path = f.name
        
        try:
            # P3-SAM 추론
            parts = run_p3sam(tmp_path)
            return {
                "success": True,
                "parts": parts,
                "count": len(parts)
            }
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        return {"error": str(e)}


def run_p3sam(glb_path: str):
    """P3-SAM으로 GLB 파트 세그멘테이션"""
    import trimesh
    
    # GLB 로드 → 포인트클라우드 변환
    mesh = trimesh.load(glb_path, force="mesh")
    points, face_idx = trimesh.sample.sample_surface(mesh, count=10000)
    points_tensor = torch.FloatTensor(points).unsqueeze(0).cuda()
    
    with torch.no_grad():
        # FPS로 프롬프트 포인트 샘플링 후 추론
        masks = model.segment_auto(points_tensor)
    
    # 마스크 → 파트 정보 변환
    parts = []
    colors = [
        "#7b61ff", "#c8f542", "#ff6b6b", "#ffd166",
        "#06d6a0", "#a8dadc", "#ff9f1c", "#e9c46a"
    ]
    
    part_names = ["body", "top", "base", "detail", "joint", "cover", "frame", "panel"]
    
    for i, mask in enumerate(masks):
        parts.append({
            "id": i,
            "name": part_names[i % len(part_names)],
            "color": colors[i % len(colors)],
            "point_count": int(mask.sum().item())
        })
    
    return parts


runpod.serverless.start({"handler": handler})
