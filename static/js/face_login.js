/**
 * SmartAttend - Face Login JavaScript
 * Webcam integration and face verification
 */

const video = document.getElementById('webcam');
const canvas = document.getElementById('capture-canvas');
const captureBtn = document.getElementById('captureBtn');
const scanningOverlay = document.getElementById('scanningOverlay');
const successOverlay = document.getElementById('successOverlay');
const statusMessage = document.getElementById('statusMessage');

let stream = null;
let isProcessing = false;

// Initialize webcam
async function initWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        
        video.srcObject = stream;
        
        // Request location permission early
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                () => console.log('Location access granted'),
                () => console.log('Location access denied or not available')
            );
        }
    } catch (err) {
        showStatus('error', 'Could not access webcam. Please ensure you have granted camera permissions.');
        console.error('Webcam error:', err);
    }
}

// Capture and verify face
async function captureAndVerify() {
    if (isProcessing) return;
    
    isProcessing = true;
    captureBtn.disabled = true;
    
    // Show scanning overlay
    scanningOverlay.style.display = 'flex';
    hideStatus();
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Get base64 image
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Get location if available
    let latitude = null;
    let longitude = null;
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
    } catch (e) {
        console.log('Location not available');
    }
    
    // Send to server
    try {
        const response = await fetch('/api/face/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageData,
                role: role,
                latitude: latitude,
                longitude: longitude
            })
        });
        
        const data = await response.json();
        
        scanningOverlay.style.display = 'none';
        
        if (data.success) {
            // Show success overlay
            successOverlay.style.display = 'flex';
            
            // Play greeting if student
            if (data.user.role === 'student' && data.attendance_marked && data.attendance_marked.marked) {
                playGreeting(data.user.name, data.attendance_marked.subject);
            }
            
            // Redirect after delay
            setTimeout(() => {
                if (data.user.role === 'student') {
                    window.location.href = '/student/dashboard';
                } else {
                    window.location.href = '/teacher/dashboard';
                }
            }, 1500);
        } else {
            showStatus('error', data.message);
            captureBtn.disabled = false;
            isProcessing = false;
        }
    } catch (err) {
        scanningOverlay.style.display = 'none';
        showStatus('error', 'Network error. Please try again.');
        console.error('Verification error:', err);
        captureBtn.disabled = false;
        isProcessing = false;
    }
}

// Show status message
function showStatus(type, message) {
    statusMessage.style.display = 'flex';
    statusMessage.className = `status-message ${type}`;
    statusMessage.querySelector('.status-text').textContent = message;
}

// Hide status message
function hideStatus() {
    statusMessage.style.display = 'none';
}

// Play greeting using Web Speech API
function playGreeting(name, subject) {
    if ('speechSynthesis' in window) {
        const message = `Welcome, ${name}! Your attendance for ${subject} has been marked successfully.`;
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }
}

// Event listeners
captureBtn.addEventListener('click', captureAndVerify);

// Keyboard shortcut (Space)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isProcessing) {
        e.preventDefault();
        captureAndVerify();
    }
});

// Initialize on load
initWebcam();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
