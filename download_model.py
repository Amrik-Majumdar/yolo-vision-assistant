import requests
import os
import sys

os.makedirs("models", exist_ok=True)

# Working sources for YOLOv8n ONNX
sources = [
    {
        "name": "Hugging Face Mirror",
        "url": "https://huggingface.co/Ultralytics/YOLOv8/resolve/main/yolov8n.onnx"
    },
    {
        "name": "Direct from Ultralytics repo",
        "url": "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx"
    },
    {
        "name": "PINTO Model Zoo",
        "url": "https://github.com/PINTO0309/PINTO_model_zoo/raw/main/307_YOLOv8/yolov8n_post_1x3x640x640.onnx"
    }
]

save_path = "models/yolov8n.onnx"

# If file exists, ask to replace
if os.path.exists(save_path):
    response = input("Model file already exists. Download again? (y/n): ")
    if response.lower() != 'y':
        print("Using existing model file")
        sys.exit(0)
    os.remove(save_path)

for source in sources:
    print(f"\nTrying: {source['name']}")
    print(f"URL: {source['url']}")
    
    try:
        print("Downloading...")
        r = requests.get(source['url'], allow_redirects=True, timeout=120, stream=True)
        r.raise_for_status()
        
        # Save with progress
        total_size = int(r.headers.get('content-length', 0))
        with open(save_path, "wb") as f:
            if total_size > 0:
                downloaded = 0
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    percent = (downloaded / total_size) * 100
                    print(f"\rProgress: {percent:.1f}%", end="")
                print()
            else:
                f.write(r.content)
        
        # Check file size
        file_size = os.path.getsize(save_path) / (1024 * 1024)
        
        if file_size < 1:
            print(f"File too small ({file_size:.2f} MB), probably not valid")
            os.remove(save_path)
            continue
        
        print(f"\n✓ Downloaded successfully!")
        print(f"✓ File: {save_path}")
        print(f"✓ Size: {file_size:.2f} MB")
        
        # Success!
        sys.exit(0)
        
    except Exception as e:
        print(f"\n✗ Failed: {e}")
        if os.path.exists(save_path):
            os.remove(save_path)
        continue

print("\n" + "="*50)
print("All automatic downloads failed")
print("="*50)
print("\nManual download options:")
print("1. Visit: https://huggingface.co/Ultralytics/YOLOv8/tree/main")
print("   Download: yolov8n.onnx")
print("\n2. Or use Ultralytics Python package:")
print("   pip install ultralytics")
print("   python -c 'from ultralytics import YOLO; YOLO(\"yolov8n.pt\").export(format=\"onnx\")'")
print("\nThen move the file to: models/yolov8n.onnx")
sys.exit(1)