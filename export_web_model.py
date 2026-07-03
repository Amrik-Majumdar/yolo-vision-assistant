import os
import sys

print("Installing required packages...")
os.system("pip install ultralytics onnx onnxsim")

print("\nExporting web-compatible YOLOv8n...")

try:
    from ultralytics import YOLO
    
    os.makedirs("models", exist_ok=True)
    
    # Load model
    print("Loading YOLOv8n...")
    model = YOLO("yolov8n.pt")
    
    # Export with web-compatible settings
    print("Exporting to ONNX (web-compatible)...")
    model.export(
        format="onnx",
        imgsz=640,
        simplify=True,
        dynamic=False,
        opset=12  # Use opset 12 for better web compatibility
    )
    
    # Move file
    import shutil
    if os.path.exists("yolov8n.onnx"):
        if os.path.exists("models/yolov8n.onnx"):
            os.remove("models/yolov8n.onnx")
        shutil.move("yolov8n.onnx", "models/yolov8n.onnx")
        
        file_size = os.path.getsize("models/yolov8n.onnx") / (1024 * 1024)
        print(f"\n✓ Success!")
        print(f"✓ File: models/yolov8n.onnx")
        print(f"✓ Size: {file_size:.2f} MB")
        print(f"✓ Opset: 12 (web-compatible)")
        
    else:
        raise Exception("Export file not created")
        
except Exception as e:
    print(f"\n✗ Export failed: {e}")
    print("\nTrying to download pre-built web-compatible model...")
    
    import requests
    
    # Try downloading a known working ONNX model
    urls = [
        "https://github.com/PINTO0309/PINTO_model_zoo/raw/main/307_YOLOv8/yolov8n_1x3x640x640.onnx",
        "https://storage.googleapis.com/ailia-models/yolov8/yolov8n.onnx"
    ]
    
    for url in urls:
        try:
            print(f"\nTrying: {url}")
            r = requests.get(url, timeout=120, stream=True)
            r.raise_for_status()
            
            with open("models/yolov8n.onnx", "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            file_size = os.path.getsize("models/yolov8n.onnx") / (1024 * 1024)
            print(f"\n✓ Downloaded successfully!")
            print(f"✓ Size: {file_size:.2f} MB")
            sys.exit(0)
            
        except Exception as e2:
            print(f"Failed: {e2}")
            continue
    
    print("\n✗ All methods failed")
    print("\nAs a last resort, try using TensorFlow.js YOLOv5 instead:")
    print("It has better web compatibility but slightly lower accuracy")
    sys.exit(1)