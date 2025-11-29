import cv2
import torch
import numpy as np
from facenet_pytorch import MTCNN, InceptionResnetV1
from torchvision import transforms
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import io
from PIL import Image

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------- CONFIG -------------------
BEST_THRESHOLD = 0.55
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((160, 160)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
])

# ------------------- LOAD MODEL & DATABASE -------------------
print("Loading MTCNN + FaceNet...")
mtcnn = MTCNN(image_size=160, margin=0, min_face_size=60,
              thresholds=[0.6, 0.7, 0.7], factor=0.709, device=DEVICE)

model = InceptionResnetV1(pretrained='vggface2').eval().to(DEVICE)

print("Loading database...")
try:
    all_train_emb = np.load("all_train_embeddings.npy")
    all_train_labels = np.load("all_train_labels.npy", allow_pickle=True)
    
    # Pre-normalize
    all_train_emb_norm = all_train_emb / np.linalg.norm(all_train_emb, axis=1, keepdims=True)
    print(f"Database loaded: {len(all_train_labels)} embeddings.")
except Exception as e:
    print(f"Error loading database: {e}")
    all_train_emb_norm = None
    all_train_labels = None

# ------------------- RECOGNITION FUNCTION -------------------
def recognize_face(embedding):
    if all_train_emb_norm is None:
        return "DB_ERROR", 0.0
        
    embedding = embedding / np.linalg.norm(embedding)
    similarities = np.dot(all_train_emb_norm, embedding)
    max_sim = similarities.max()
    
    if max_sim > BEST_THRESHOLD:
        name = all_train_labels[similarities.argmax()]
        return name, float(max_sim)
    else:
        return "UNKNOWN", float(max_sim)

@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        return {"error": "Invalid image"}

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Detect faces
    boxes, probs, landmarks = mtcnn.detect(rgb_frame, landmarks=True)
    
    results = []
    status = "CLEAN"
    message = "Session normal"
    
    if boxes is not None:
        # Filter out low probability detections
        valid_detections = [(box, prob, lm) for box, prob, lm in zip(boxes, probs, landmarks) if prob >= 0.95]
        
        if len(valid_detections) == 0:
            status = "NO_FACE"
            message = "No face detected in frame"
        elif len(valid_detections) > 1:
            status = "MULTIPLE_FACES"
            message = "Multiple people detected!"
        
        for box, prob, lm in valid_detections:
            x1, y1, x2, y2 = map(int, box)
            
            # Ensure coordinates are within frame
            h, w, _ = frame.shape
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)
            
            face = rgb_frame[y1:y2, x1:x2]
            
            if face.size == 0: continue
                
            try:
                # Head Pose Estimation using Landmarks
                # Landmarks: [left_eye, right_eye, nose, left_mouth, right_mouth]
                left_eye = lm[0]
                right_eye = lm[1]
                nose = lm[2]
                
                # Horizontal Ratio: (NoseX - LeftEyeX) / (RightEyeX - LeftEyeX)
                # Note: "Left Eye" in array is usually the one on the left side of the image (User's Right Eye)
                # Let's assume index 0 is left-on-image, 1 is right-on-image.
                eye_width = right_eye[0] - left_eye[0]
                if eye_width > 0:
                    ratio = (nose[0] - left_eye[0]) / eye_width
                    
                    pose = "CENTER"
                    if ratio < 0.35:
                        pose = "LOOKING_RIGHT" # User looking to their right (our left)
                    elif ratio > 0.65:
                        pose = "LOOKING_LEFT" # User looking to their left (our right)
                        
                    if status == "CLEAN" and pose != "CENTER":
                        status = "LOOKING_AWAY"
                        message = "User looking away!"
                else:
                    pose = "UNKNOWN"

                tensor = transform(face).unsqueeze(0).to(DEVICE)
                with torch.no_grad():
                    embedding = model(tensor).cpu().numpy()[0]
                
                name, confidence = recognize_face(embedding)
                
                # If we have a single face but it's unknown
                if len(valid_detections) == 1 and name == "UNKNOWN":
                    status = "UNKNOWN_USER"
                    message = "Unregistered user detected"

                results.append({
                    "box": [x1, y1, x2, y2],
                    "name": name,
                    "confidence": confidence,
                    "pose": pose
                })
            except Exception as e:
                print(f"Error processing face: {e}")
                continue
    else:
        status = "NO_FACE"
        message = "No face detected in frame"
                
    return {
        "results": results,
        "status": status,
        "message": message
    }

@app.get("/")
def health_check():
    return {"status": "ok", "model_loaded": all_train_emb_norm is not None}
