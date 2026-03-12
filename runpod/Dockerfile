FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# 시스템 패키지
RUN apt-get update && apt-get install -y \
    git \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python 패키지
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# P3-SAM 소스 클론
RUN git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-Part.git /app/Hunyuan3D-Part
RUN cp -r /app/Hunyuan3D-Part/P3-SAM /app/P3-SAM

# weights 폴더
RUN mkdir -p /app/weights

# 핸들러 복사
COPY handler.py .

CMD ["python", "-u", "handler.py"]
