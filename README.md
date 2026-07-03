# YOLO Vision Assistant

YOLO Vision Assistant is a browser-based computer vision project for experimenting with object detection and visual analysis. The repository combines a frontend interface, a small Node.js backend, Python model utilities, and local model files for YOLO-style detection workflows.

The project is organized as an experimental assistant rather than a production accessibility or robotics tool.

## What This Project Shows

- Browser interface for visual input and detection output
- JavaScript modules for classification, detection, tracking, and voice support
- Node.js backend route for explanation-style responses
- Python utilities for downloading and exporting model assets
- Local YOLO/ONNX model workflow
- Clear boundaries around model limitations and runtime assumptions

## Repository Structure

```text
.
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── js/                  Detection, tracking, classifier, and voice modules
├── backend/
│   ├── server.js            Express server
│   └── routes/              Backend routes
├── models/                  Local model assets
├── download_model.py        Model download helper
├── export_web_model.py      Model export helper
├── setup.ps1                Windows setup script
├── start.ps1                Windows start script
└── README.md
```

## Technical Approach

The project separates visual interaction from backend support. Frontend modules handle browser-side input, detection display, tracking behavior, and user-facing interaction. The backend provides a lightweight service layer for routes that should not live directly in the browser.

The model utilities support a local workflow for working with YOLO-style assets and ONNX export. This makes the repository useful for studying the path from model file to browser-facing interface.

## Local Setup

From the repository root:

```powershell
.\\setup.ps1
```

Then start the project:

```powershell
.\\start.ps1
```

Backend-only setup:

```powershell
cd backend
npm install
npm start
```

## Model Files

The repository includes model assets for local experimentation. If model files are replaced or regenerated, keep large generated artifacts intentional and documented.

Useful helpers:

```powershell
python download_model.py
python export_web_model.py
```

## Limitations

- Detection quality depends on the model, camera/image quality, lighting, and runtime environment.
- The project is not validated for safety-critical use.
- Browser performance can vary by device and model format.
- The backend route structure is small and should be reviewed before adding external services.

## Future Improvements

- Add screenshots or a short demo flow.
- Add a sample image set for repeatable testing.
- Document expected backend environment variables if external model explanation is enabled.
- Add tests around detection decoding and frontend state behavior.
- Provide a smaller model-download path for lighter clones.
