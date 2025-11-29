# How to Run Exam Detection System

This guide explains how to set up and run both the frontend and backend of the Exam Detection project.

## Prerequisites

Ensure you have the following installed on your system:
- **Node.js** (v18 or higher recommended) & **npm**
- **Python** (v3.8 or higher) & **pip**

---

## 1. Backend Setup (FastAPI)

The backend handles face recognition and proctoring logic.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment (Recommended):**
    ```bash
    # macOS/Linux
    python3 -m venv venv
    source venv/bin/activate

    # Windows
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *Note: This installs packages like `fastapi`, `uvicorn`, `torch`, `facenet-pytorch`, etc.*

4.  **Run the Backend Server:**
    ```bash
    uvicorn main:app --reload
    ```
    - The server will start at: `http://127.0.0.1:8000`
    - API Documentation is available at: `http://127.0.0.1:8000/docs`

---

## 2. Frontend Setup (Next.js)

The frontend provides the user interface for the exam dashboard.

1.  **Navigate to the project root (if you are in `backend`, go back one level):**
    ```bash
    cd ..
    ```
    *(Or simply open a new terminal in the root `exam-detection` folder)*

2.  **Install Node dependencies:**
    ```bash
    npm install
    ```

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

4.  **Access the Application:**
    - Open your browser and go to: `http://localhost:3000`

---

## Troubleshooting

- **Backend Port Conflict**: If port 8000 is busy, `uvicorn` might fail. You can specify a different port:
  ```bash
  uvicorn main:app --reload --port 8001
  ```
- **Frontend Port Conflict**: Next.js usually defaults to 3000. If it's busy, it will ask to use a different port (e.g., 3001).
- **CORS Issues**: If the frontend cannot talk to the backend, ensure the backend is running and the CORS settings in `backend/main.py` allow requests from your frontend URL.
