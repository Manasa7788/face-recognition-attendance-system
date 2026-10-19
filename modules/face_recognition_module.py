"""
Face Recognition Module - DO NOT MODIFY
This module contains the core face recognition logic that must remain unchanged.
"""
import face_recognition
import cv2
import numpy as np
import pickle
import os
from datetime import datetime

class FaceRecognitionSystem:
    """Face Recognition System - Core functionality"""
    
    def __init__(self, encodings_dir='static/face_encodings'):
        self.encodings_dir = encodings_dir
        self.known_face_encodings = []
        self.known_face_ids = []
        self.known_face_names = []
        self.load_all_encodings()
    
    def load_all_encodings(self):
        """Load all saved face encodings"""
        self.known_face_encodings = []
        self.known_face_ids = []
        self.known_face_names = []
        
        if not os.path.exists(self.encodings_dir):
            return
        
        for filename in os.listdir(self.encodings_dir):
            if filename.endswith('.pkl'):
                filepath = os.path.join(self.encodings_dir, filename)
                try:
                    with open(filepath, 'rb') as f:
                        data = pickle.load(f)
                        self.known_face_encodings.extend(data['encodings'])
                        self.known_face_ids.extend([data['user_id']] * len(data['encodings']))
                        self.known_face_names.extend([data['name']] * len(data['encodings']))
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
    
    def capture_face_from_webcam(self, user_id, name, num_samples=5, provided_frame=None):
        """Capture face samples and save encodings"""
        encodings = []
        
        if provided_frame is not None:
            # Use provided frame (from frontend)
            frame = provided_frame
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            
            if len(face_locations) == 0:
                return False, "No face detected in the image"
            
            if len(face_locations) > 1:
                return False, "Multiple faces detected. Please ensure only one face is visible"
            
            face_encoding = face_recognition.face_encodings(rgb_frame, face_locations)
            if face_encoding:
                encodings.append(face_encoding[0])
        
        if len(encodings) == 0:
            return False, "Failed to capture face encoding"
        
        # Save encodings to file
        filepath = os.path.join(self.encodings_dir, f'user_{user_id}.pkl')
        data = {
            'user_id': user_id,
            'name': name,
            'encodings': encodings,
            'created_at': datetime.now().isoformat()
        }
        
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
        
        # Reload encodings
        self.load_all_encodings()
        
        return True, filepath
    
    def verify_face(self, provided_frame=None):
        """Verify face against known encodings"""
        if len(self.known_face_encodings) == 0:
            return None, "No faces registered in the system", 0
        
        if provided_frame is None:
            return None, "No image provided", 0
        
        # Process frame
        frame = provided_frame
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Find face locations
        face_locations = face_recognition.face_locations(rgb_frame)
        
        if len(face_locations) == 0:
            return None, "No face detected", 0
        
        if len(face_locations) > 1:
            return None, "Multiple faces detected", 0
        
        # Get face encoding
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        if len(face_encodings) == 0:
            return None, "Could not encode face", 0
        
        face_encoding = face_encodings[0]
        
        # Compare with known faces
        matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.6)
        face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
        
        if True in matches:
            best_match_index = np.argmin(face_distances)
            if matches[best_match_index]:
                confidence = (1 - face_distances[best_match_index]) * 100
                return self.known_face_ids[best_match_index], self.known_face_names[best_match_index], confidence
        
        return None, "Face not recognized", 0

# Global instance
face_system = FaceRecognitionSystem()
