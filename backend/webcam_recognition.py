# =============================================================================
# WEBCAM REAL-TIME FACE RECOGNITION - SUPER CEPAT & AKURAT
# Pakai database dari train_face_final.py
# =============================================================================
import cv2
import torch
import numpy as np
from facenet_pytorch import MTCNN, InceptionResnetV1
from torchvision import transforms

# ------------------- CONFIG -------------------
BEST_THRESHOLD = 0.55                    # GANTI dengan threshold terbaik dari training
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

print("Loading database (ini cepat banget pakai .npy)...")
all_train_emb    = np.load("all_train_embeddings.npy")
all_train_labels = np.load("all_train_labels.npy", allow_pickle=True)

# Pre-normalize semua embedding training (biar inference 2x lebih cepat)
all_train_emb_norm = all_train_emb / np.linalg.norm(all_train_emb, axis=1, keepdims=True)

print(f"Database siap: {len(all_train_labels)} embeddings dari {len(set(all_train_labels))} orang")

# ------------------- RECOGNITION FUNCTION -------------------
def recognize(embedding):
    embedding = embedding / np.linalg.norm(embedding)
    similarities = np.dot(all_train_emb_norm, embedding)
    max_sim = similarities.max()
    if max_sim > BEST_THRESHOLD:
        name = all_train_labels[similarities.argmax()]
        return name, max_sim
    else:
        return "UNKNOWN", max_sim

# ------------------- WEBCAM LOOP -------------------
cap = cv2.VideoCapture(0)
cap.set(3, 640)
cap.set(4, 480)

print("\nWEBCAM AKTIF! Tekan 'q' untuk keluar.\n")

while True:
    ret, frame = cap.read()
    if not ret: break
    
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Deteksi wajah
    boxes, probs = mtcnn.detect(rgb_frame)
    
    if boxes is not None:
        for box, prob in zip(boxes, probs):
            if prob < 0.95: continue
            
            x1, y1, x2, y2 = map(int, box)
            face = rgb_frame[y1:y2, x1:x2]
            
            if face.size == 0: continue
                
            try:
                tensor = transform(face).unsqueeze(0).to(DEVICE)
                with torch.no_grad():
                    embedding = model(tensor).cpu().numpy()[0]
                
                name, confidence = recognize(embedding)
                label = f"{name} ({confidence:.3f})"
                color = (0, 255, 0) if name != "UNKNOWN" else (0, 0, 255)
                
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, label, (x1, y1-10), cv2.FONT_HERSHEY_DUPLEX, 0.8, color, 2)
            except: pass
    
    cv2.putText(frame, f"Threshold: {BEST_THRESHOLD:.3f}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
    cv2.imshow("Face Recognition - Tekan Q untuk keluar", frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Webcam ditutup.")