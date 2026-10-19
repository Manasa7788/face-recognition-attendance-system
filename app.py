"""
Face Recognition Attendance System - Flask Backend
AI/ML College Project - Main Application
Enhanced with AI Assistant, Network/Location Restrictions, and Modern UI
"""
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, Response, send_from_directory
from functools import wraps
from datetime import datetime, date, time, timedelta
import os
import json
import pickle
import pandas as pd
from io import BytesIO
from database import (db, User, ClassSchedule, Attendance, Homework, Quiz, 
                      Reminder, Submission, QuizQuestion, QuizAnswer, 
                      RestrictionSettings, AIConversation, init_db)
from modules.face_recognition_module import face_system
from modules.nlp_greeting import nlp_greeting
from modules.ai_assistant import ai_assistant
import cv2
import numpy as np
import threading
import requests

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///attendance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize database
init_db(app)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Ensure face encodings folder exists
os.makedirs('static/face_encodings', exist_ok=True)

# ============== AUTHENTICATION DECORATORS ==============

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def student_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        user = User.query.get(session['user_id'])
        if not user or user.role != 'student':
            flash('Student access required', 'error')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def teacher_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        user = User.query.get(session['user_id'])
        if not user or user.role != 'teacher':
            flash('Teacher access required', 'error')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

# ============== NETWORK & LOCATION RESTRICTION HELPERS ==============

def check_network_restriction():
    """Check if current network/IP is allowed"""
    settings = RestrictionSettings.query.first()
    if not settings or not settings.network_restriction_enabled:
        return True, None
    
    # Get client IP
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ',' in client_ip:
        client_ip = client_ip.split(',')[0].strip()
    
    # Check allowed IP ranges
    allowed_ranges = json.loads(settings.allowed_ip_ranges) if settings.allowed_ip_ranges else []
    for ip_range in allowed_ranges:
        if client_ip.startswith(ip_range):
            return True, None
    
    # Check allowed WiFi networks (would need additional client-side detection)
    allowed_wifi = json.loads(settings.allowed_wifi_networks) if settings.allowed_wifi_networks else []
    
    return False, f"Access denied from IP: {client_ip}. Please connect from an authorized network."

def check_location_restriction(latitude=None, longitude=None):
    """Check if current location is within allowed radius"""
    settings = RestrictionSettings.query.first()
    if not settings or not settings.location_restriction_enabled:
        return True, None
    
    if latitude is None or longitude is None:
        return False, "Location data required. Please enable location services."
    
    # Calculate distance using Haversine formula
    from math import radians, sin, cos, sqrt, atan2
    
    lat1 = radians(settings.allowed_latitude)
    lon1 = radians(settings.allowed_longitude)
    lat2 = radians(float(latitude))
    lon2 = radians(float(longitude))
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = 6371000 * c  # Earth's radius in meters
    
    if distance <= settings.allowed_radius_meters:
        return True, None
    
    return False, f"You are {distance:.0f} meters outside the allowed area. Please be within {settings.allowed_radius_meters} meters of the campus."

# ============== MAIN ROUTES ==============

@app.route('/')
def index():
    """Landing page - redirects to appropriate dashboard if logged in"""
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            if user.role == 'student':
                return redirect(url_for('student_dashboard'))
            elif user.role == 'teacher':
                return redirect(url_for('teacher_dashboard'))
    return render_template('index.html')

@app.route('/logout')
def logout():
    """Logout route"""
    session.clear()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

# ============== FACE RECOGNITION AUTH ROUTES ==============

@app.route('/login/student')
def login_student():
    """Student login page with face recognition"""
    return render_template('login_face.html', role='student')

@app.route('/login/teacher')
def login_teacher():
    """Teacher login page with face recognition"""
    return render_template('login_face.html', role='teacher')

@app.route('/api/face/verify', methods=['POST'])
def api_face_verify():
    """API endpoint for face verification from webcam frame"""
    try:
        data = request.get_json()
        expected_role = data.get('role', 'student')
        image_data = data.get('image')
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if not image_data:
            return jsonify({
                'success': False,
                'message': 'No image data provided'
            })

        # Check network restriction
        network_allowed, network_msg = check_network_restriction()
        if not network_allowed:
            return jsonify({
                'success': False,
                'message': network_msg
            })

        # Check location restriction
        location_allowed, location_msg = check_location_restriction(latitude, longitude)
        if not location_allowed:
            return jsonify({
                'success': False,
                'message': location_msg
            })

        # Decode base64 image
        import base64
        try:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Invalid image data: {str(e)}'
            })

        # Check if any face is registered in the system
        existing_faces = User.query.filter(
            User.face_encoding_path.isnot(None)
        ).count()

        # FIRST-TIME TEACHER REGISTRATION
        if existing_faces == 0 and expected_role == 'teacher':
            teacher = User.query.filter_by(role='teacher').first()
            if not teacher:
                return jsonify({
                    'success': False,
                    'message': 'No teacher account found. Please initialize the database.'
                })

            success, result = face_system.capture_face_from_webcam(
                user_id=teacher.id,
                name=teacher.name,
                num_samples=1,
                provided_frame=frame
            )

            if success:
                teacher.face_encoding_path = result
                db.session.commit()

                session['user_id'] = teacher.id
                session['user_name'] = teacher.name
                session['user_role'] = teacher.role

                return jsonify({
                    'success': True,
                    'message': 'Face registered and logged in successfully! Welcome!',
                    'user': teacher.to_dict(),
                    'confidence': 100,
                    'first_time_registration': True
                })
            else:
                return jsonify({
                    'success': False,
                    'message': f'Face registration failed: {result}'
                })

        # NORMAL FACE VERIFICATION FLOW
        user_id, name, confidence = face_system.verify_face(provided_frame=frame)

        if user_id is None:
            return jsonify({
                'success': False,
                'message': name,
                'confidence': confidence
            })

        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found in database'
            })

        if user.role != expected_role:
            return jsonify({
                'success': False,
                'message': f'This account is registered as {user.role}, not {expected_role}'
            })

        # Log the user in
        session['user_id'] = user.id
        session['user_name'] = user.name
        session['user_role'] = user.role

        # Mark attendance for students
        attendance_marked = None
        if user.role == 'student':
            client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ',' in client_ip:
                client_ip = client_ip.split(',')[0].strip()
            attendance_marked = mark_attendance_for_student(user.id, client_ip, latitude, longitude)

        return jsonify({
            'success': True,
            'message': f'Welcome, {user.name}!',
            'user': user.to_dict(),
            'attendance_marked': attendance_marked,
            'confidence': confidence
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error during face verification: {str(e)}'
        })

def mark_attendance_for_student(student_id, ip_address=None, latitude=None, longitude=None):
    """Mark attendance for student based on current schedule"""
    now = datetime.now()
    current_day = now.weekday()
    current_time = now.time()
    
    schedules = ClassSchedule.query.filter_by(day_of_week=current_day).all()
    
    for schedule in schedules:
        schedule_start = schedule.start_time
        time_diff = datetime.combine(date.today(), current_time) - datetime.combine(date.today(), schedule_start)
        minutes_diff = time_diff.total_seconds() / 60
        
        if -15 <= minutes_diff <= 120:
            existing = Attendance.query.filter_by(
                student_id=student_id,
                schedule_id=schedule.id,
                date=date.today()
            ).first()
            
            if not existing:
                status = 'present'
                if minutes_diff > 15:
                    status = 'late'
                
                attendance = Attendance(
                    student_id=student_id,
                    schedule_id=schedule.id,
                    date=date.today(),
                    status=status,
                    ip_address=ip_address,
                    latitude=float(latitude) if latitude else None,
                    longitude=float(longitude) if longitude else None
                )
                db.session.add(attendance)
                db.session.commit()
                
                return {
                    'marked': True,
                    'subject': schedule.subject_name,
                    'status': status,
                    'time': now.strftime('%H:%M')
                }
    
    return {'marked': False, 'reason': 'No active class found'}

# ============== STUDENT DASHBOARD ROUTES ==============

@app.route('/student/dashboard')
@student_required
def student_dashboard():
    """Student dashboard"""
    user = User.query.get(session['user_id'])
    return render_template('student_dashboard.html', user=user)

@app.route('/api/student/data')
@student_required
def api_student_data():
    """Get all student data for dashboard"""
    user_id = session['user_id']
    
    today = datetime.now().weekday()
    current_time = datetime.now().time()
    
    # Get today's schedule
    schedules = ClassSchedule.query.filter_by(day_of_week=today).order_by(ClassSchedule.start_time).all()
    
    # Get all schedules for the week
    all_schedules = ClassSchedule.query.order_by(ClassSchedule.day_of_week, ClassSchedule.start_time).all()
    
    # Get student's submissions
    student_submissions = Submission.query.filter_by(student_id=user_id).all()
    submitted_homework_ids = [s.homework_id for s in student_submissions]
    
    # Get student's quiz answers
    student_quiz_answers = QuizAnswer.query.filter_by(student_id=user_id).all()
    completed_quiz_ids = list(set([a.quiz_id for a in student_quiz_answers]))
    
    # Get pending homework (not submitted)
    all_homework = Homework.query.filter(
        ((Homework.student_id == user_id) | (Homework.student_id == None))
    ).order_by(Homework.due_date).all()
    
    pending_homework = [h for h in all_homework if h.id not in submitted_homework_ids]
    completed_homework = [h for h in all_homework if h.id in submitted_homework_ids]
    
    # Get upcoming quizzes (not submitted)
    all_quizzes = Quiz.query.filter(
        ((Quiz.student_id == user_id) | (Quiz.student_id == None))
    ).order_by(Quiz.quiz_date).all()
    
    upcoming_quizzes = [q for q in all_quizzes if q.id not in completed_quiz_ids and q.quiz_date >= date.today()]
    completed_quizzes = [q for q in all_quizzes if q.id in completed_quiz_ids]
    
    # Get attendance records
    attendance_records = Attendance.query.filter_by(student_id=user_id).order_by(Attendance.date.desc()).limit(30).all()
    
    # Calculate attendance stats
    total_classes = Attendance.query.filter_by(student_id=user_id).count()
    present_count = Attendance.query.filter_by(student_id=user_id, status='present').count()
    late_count = Attendance.query.filter_by(student_id=user_id, status='late').count()
    attendance_rate = ((present_count + late_count) / total_classes * 100) if total_classes > 0 else 0
    
    # Get unread reminders
    reminders = Reminder.query.filter_by(student_id=user_id, is_read=False).order_by(Reminder.created_at.desc()).all()
    
    # Find next class
    next_class = None
    for schedule in schedules:
        if schedule.start_time > current_time:
            next_class = schedule.to_dict()
            break
    
    # If no more classes today, get first class of next day
    if not next_class and len(all_schedules) > 0:
        for schedule in all_schedules:
            if schedule.day_of_week > today or (schedule.day_of_week == 0 and today == 6):
                next_class = schedule.to_dict()
                break
    
    # Get recent submissions
    submissions = Submission.query.filter_by(student_id=user_id).order_by(Submission.submitted_at.desc()).limit(10).all()
    
    # Get quiz grades
    quiz_grades = []
    for quiz_id in completed_quiz_ids:
        quiz = Quiz.query.get(quiz_id)
        if quiz:
            answers = QuizAnswer.query.filter_by(quiz_id=quiz_id, student_id=user_id).all()
            total_marks = sum(a.marks_obtained or 0 for a in answers)
            max_marks = sum(a.question.marks or 1 for a in answers if a.question)
            quiz_grades.append({
                'quiz_id': quiz_id,
                'quiz_title': quiz.title,
                'subject_name': quiz.subject_name,
                'marks_obtained': total_marks,
                'max_marks': max_marks,
                'is_graded': all(a.is_graded for a in answers) if answers else False
            })
    
    return jsonify({
        'user': User.query.get(user_id).to_dict(),
        'today_schedules': [s.to_dict() for s in schedules],
        'all_schedules': [s.to_dict() for s in all_schedules],
        'pending_homework': [h.to_dict() for h in pending_homework],
        'completed_homework': [h.to_dict() for h in completed_homework],
        'upcoming_quizzes': [q.to_dict() for q in upcoming_quizzes],
        'completed_quizzes': [q.to_dict() for q in completed_quizzes],
        'attendance_records': [a.to_dict() for a in attendance_records],
        'attendance_stats': {
            'total': total_classes,
            'present': present_count,
            'late': late_count,
            'rate': round(attendance_rate, 2)
        },
        'reminders': [r.to_dict() for r in reminders],
        'next_class': next_class,
        'recent_submissions': [s.to_dict() for s in submissions],
        'quiz_grades': quiz_grades
    })

@app.route('/api/student/greeting')
@student_required
def api_student_greeting():
    """Generate personalized voice greeting"""
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    today = datetime.now().weekday()
    current_time = datetime.now().time()
    
    # Find next class
    schedules = ClassSchedule.query.filter_by(day_of_week=today).order_by(ClassSchedule.start_time).all()
    next_class = None
    for schedule in schedules:
        if schedule.start_time > current_time:
            next_class = schedule.to_dict()
            break
    
    # Get pending homework
    pending_homework = Homework.query.filter(
        ((Homework.student_id == user_id) | (Homework.student_id == None)),
        Homework.due_date >= date.today(),
        Homework.is_completed == False
    ).order_by(Homework.due_date).limit(3).all()
    
    # Get upcoming quizzes
    upcoming_quizzes = Quiz.query.filter(
        ((Quiz.student_id == user_id) | (Quiz.student_id == None)),
        Quiz.quiz_date >= date.today(),
        Quiz.is_completed == False
    ).order_by(Quiz.quiz_date).limit(3).all()
    
    # Generate greeting using NLP
    greeting_data = nlp_greeting.generate_greeting(
        student_name=user.name,
        next_class=next_class,
        pending_homework=[h.to_dict() for h in pending_homework],
        upcoming_quizzes=[q.to_dict() for q in upcoming_quizzes]
    )
    
    return jsonify(greeting_data)

@app.route('/api/student/homework/<int:hw_id>/complete', methods=['POST'])
@student_required
def api_complete_homework(hw_id):
    """Mark homework as completed"""
    homework = Homework.query.get_or_404(hw_id)
    homework.is_completed = True
    db.session.commit()
    return jsonify({'success': True, 'message': 'Homework marked as completed'})

@app.route('/api/student/reminder/<int:reminder_id>/read', methods=['POST'])
@student_required
def api_mark_reminder_read(reminder_id):
    """Mark reminder as read"""
    reminder = Reminder.query.get_or_404(reminder_id)
    if reminder.student_id == session['user_id']:
        reminder.is_read = True
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Unauthorized'}), 403

# ============== STUDENT SUBMISSION ROUTES ==============

@app.route('/api/student/homework/<int:hw_id>/submit', methods=['POST'])
@student_required
def api_submit_homework(hw_id):
    """Submit homework (text or file)"""
    homework = Homework.query.get_or_404(hw_id)
    student_id = session['user_id']
    
    # Check if already submitted
    existing = Submission.query.filter_by(homework_id=hw_id, student_id=student_id).first()
    if existing:
        return jsonify({'success': False, 'message': 'You have already submitted this homework'}), 400
    
    submission_text = request.form.get('submission_text', '')
    file_path = None
    
    # Handle file upload
    if 'file' in request.files:
        file = request.files['file']
        if file.filename:
            filename = f"hw_{hw_id}_student_{student_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
    
    submission = Submission(
        homework_id=hw_id,
        student_id=student_id,
        submission_text=submission_text,
        file_path=file_path
    )
    db.session.add(submission)
    
    # Mark homework as completed
    homework.is_completed = True
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Homework submitted successfully',
        'submission': submission.to_dict()
    })

@app.route('/api/student/quiz/<int:quiz_id>/questions')
@student_required
def api_get_quiz_questions(quiz_id):
    """Get quiz questions for student"""
    quiz = Quiz.query.get_or_404(quiz_id)
    questions = QuizQuestion.query.filter_by(quiz_id=quiz_id).order_by(QuizQuestion.order).all()
    
    return jsonify({
        'quiz': quiz.to_dict(),
        'questions': [q.to_dict() for q in questions]
    })

@app.route('/api/student/quiz/<int:quiz_id>/submit', methods=['POST'])
@student_required
def api_submit_quiz(quiz_id):
    """Submit quiz answers"""
    quiz = Quiz.query.get_or_404(quiz_id)
    student_id = session['user_id']
    
    # Check if already submitted
    existing = QuizAnswer.query.filter_by(quiz_id=quiz_id, student_id=student_id).first()
    if existing:
        return jsonify({'success': False, 'message': 'You have already submitted this quiz'}), 400
    
    data = request.get_json()
    answers = data.get('answers', {})
    
    for question_id, answer_text in answers.items():
        quiz_answer = QuizAnswer(
            quiz_id=quiz_id,
            question_id=int(question_id),
            student_id=student_id,
            answer_text=answer_text
        )
        db.session.add(quiz_answer)
    
    # Mark quiz as completed for this student
    quiz.is_completed = True
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Quiz submitted successfully'
    })

# ============== AI ASSISTANT ROUTES ==============

@app.route('/api/student/ai-assistant', methods=['POST'])
@student_required
def api_ai_assistant():
    """AI Assistant endpoint for students"""
    data = request.get_json()
    message = data.get('message', '')
    student_id = session['user_id']
    
    if not message:
        return jsonify({
            'success': False,
            'message': 'No message provided'
        }), 400
    
    # Process query with AI assistant
    result = ai_assistant.process_query(student_id, message)
    
    # Save conversation
    conversation = AIConversation(
        student_id=student_id,
        message=message,
        response=result['response'],
        context_type=result['context_type']
    )
    db.session.add(conversation)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'response': result['response'],
        'context_type': result['context_type'],
        'data': result.get('data')
    })

@app.route('/api/student/ai-conversations')
@student_required
def api_get_ai_conversations():
    """Get student's AI conversation history"""
    student_id = session['user_id']
    conversations = AIConversation.query.filter_by(student_id=student_id).order_by(AIConversation.created_at.desc()).limit(50).all()
    
    return jsonify({
        'conversations': [c.to_dict() for c in conversations]
    })

# ============== TEACHER/ADMIN DASHBOARD ROUTES ==============

@app.route('/teacher/dashboard')
@teacher_required
def teacher_dashboard():
    """Teacher/Admin dashboard"""
    user = User.query.get(session['user_id'])
    return render_template('teacher_dashboard.html', user=user)

@app.route('/api/teacher/data')
@teacher_required
def api_teacher_data():
    """Get all data for teacher dashboard"""
    # Get all students
    students = User.query.filter_by(role='student').all()
    
    # Get all schedules
    schedules = ClassSchedule.query.order_by(ClassSchedule.day_of_week, ClassSchedule.start_time).all()
    
    # Get all homework
    all_homework = Homework.query.order_by(Homework.created_at.desc()).all()
    
    # Get all quizzes
    all_quizzes = Quiz.query.order_by(Quiz.created_at.desc()).all()
    
    # Get today's attendance
    today = date.today()
    today_attendance = Attendance.query.filter_by(date=today).all()
    
    # Calculate stats
    total_students = len(students)
    total_schedules = len(schedules)
    total_homework = Homework.query.filter(Homework.due_date >= date.today()).count()
    total_quizzes = Quiz.query.filter(Quiz.quiz_date >= date.today()).count()
    
    # Get restriction settings
    restriction_settings = RestrictionSettings.query.first()
    
    return jsonify({
        'students': [s.to_dict() for s in students],
        'schedules': [s.to_dict() for s in schedules],
        'homework': [h.to_dict() for h in all_homework],
        'quizzes': [q.to_dict() for q in all_quizzes],
        'today_attendance': [a.to_dict() for a in today_attendance],
        'stats': {
            'total_students': total_students,
            'total_schedules': total_schedules,
            'total_homework': total_homework,
            'total_quizzes': total_quizzes,
            'today_attendance_count': len(today_attendance)
        },
        'restriction_settings': restriction_settings.to_dict() if restriction_settings else None
    })

@app.route('/api/teacher/student', methods=['POST'])
@teacher_required
def api_add_student():
    """Add new student with face registration"""
    data = request.get_json()
    
    existing = User.query.filter_by(email=data['email']).first()
    if existing:
        return jsonify({'success': False, 'message': 'Email already registered'}), 400
    
    student = User(
        name=data['name'],
        email=data['email'],
        role='student'
    )
    db.session.add(student)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Student added successfully',
        'student': student.to_dict(),
        'face_registration_required': True
    })

@app.route('/api/teacher/student/<int:student_id>', methods=['DELETE'])
@teacher_required
def api_delete_student(student_id):
    """Delete a student"""
    student = User.query.get_or_404(student_id)
    if student.role != 'student':
        return jsonify({'success': False, 'message': 'Not a student account'}), 400
    
    db.session.delete(student)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Student deleted successfully'})

@app.route('/api/teacher/student/<int:student_id>/register-face', methods=['POST'])
@teacher_required
def api_register_student_face(student_id):
    """Register face for student"""
    student = User.query.get_or_404(student_id)
    
    if student.role != 'student':
        return jsonify({'success': False, 'message': 'Not a student account'}), 400
    
    data = request.get_json()
    image_data = data.get('image')
    
    if not image_data:
        return jsonify({'success': False, 'message': 'No image data provided'})
    
    import base64
    try:
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Invalid image data: {str(e)}'
        })
    
    success, result = face_system.capture_face_from_webcam(
        user_id=student.id,
        name=student.name,
        num_samples=5,
        provided_frame=frame
    )
    
    if success:
        student.face_encoding_path = result
        db.session.commit()
    
    return jsonify({'success': success, 'message': result if not success else 'Face registered successfully'})

# ============== SCHEDULE MANAGEMENT ==============

@app.route('/api/teacher/schedule', methods=['POST'])
@teacher_required
def api_add_schedule():
    """Add new class schedule"""
    data = request.get_json()
    
    schedule = ClassSchedule(
        subject_name=data['subject_name'],
        day_of_week=int(data['day_of_week']),
        start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
        end_time=datetime.strptime(data['end_time'], '%H:%M').time(),
        room_number=data.get('room_number', ''),
        teacher_id=session['user_id']
    )
    db.session.add(schedule)
    db.session.commit()
    
    return jsonify({'success': True, 'schedule': schedule.to_dict()})

@app.route('/api/teacher/schedule/<int:schedule_id>', methods=['PUT', 'DELETE'])
@teacher_required
def api_manage_schedule(schedule_id):
    """Update or delete schedule"""
    schedule = ClassSchedule.query.get_or_404(schedule_id)
    
    if request.method == 'DELETE':
        db.session.delete(schedule)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Schedule deleted'})
    
    data = request.get_json()
    schedule.subject_name = data.get('subject_name', schedule.subject_name)
    schedule.day_of_week = int(data.get('day_of_week', schedule.day_of_week))
    if 'start_time' in data:
        schedule.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
    if 'end_time' in data:
        schedule.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    schedule.room_number = data.get('room_number', schedule.room_number)
    db.session.commit()
    
    return jsonify({'success': True, 'schedule': schedule.to_dict()})

# ============== HOMEWORK MANAGEMENT ==============

@app.route('/api/teacher/homework', methods=['POST'])
@teacher_required
def api_add_homework():
    """Add new homework assignment"""
    data = request.get_json()
    
    homework = Homework(
        title=data['title'],
        description=data.get('description', ''),
        subject_name=data['subject_name'],
        due_date=datetime.strptime(data['due_date'], '%Y-%m-%d').date(),
        student_id=data.get('student_id'),
        created_by=session['user_id'],
        allow_text_submission=data.get('allow_text_submission', True),
        allow_file_submission=data.get('allow_file_submission', True)
    )
    db.session.add(homework)
    db.session.commit()
    
    # Create reminders
    if homework.student_id:
        reminder = Reminder(
            student_id=homework.student_id,
            message=f"New homework assigned: {homework.title} for {homework.subject_name}",
            reminder_type='homework'
        )
        db.session.add(reminder)
        db.session.commit()
    else:
        students = User.query.filter_by(role='student').all()
        for student in students:
            reminder = Reminder(
                student_id=student.id,
                message=f"New homework assigned: {homework.title} for {homework.subject_name}",
                reminder_type='homework'
            )
            db.session.add(reminder)
        db.session.commit()
    
    return jsonify({'success': True, 'homework': homework.to_dict()})

@app.route('/api/teacher/homework/<int:hw_id>', methods=['PUT', 'DELETE'])
@teacher_required
def api_manage_homework(hw_id):
    """Update or delete homework"""
    homework = Homework.query.get_or_404(hw_id)
    
    if request.method == 'DELETE':
        db.session.delete(homework)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Homework deleted'})
    
    data = request.get_json()
    homework.title = data.get('title', homework.title)
    homework.description = data.get('description', homework.description)
    homework.subject_name = data.get('subject_name', homework.subject_name)
    if 'due_date' in data:
        homework.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
    homework.allow_text_submission = data.get('allow_text_submission', homework.allow_text_submission)
    homework.allow_file_submission = data.get('allow_file_submission', homework.allow_file_submission)
    db.session.commit()
    
    return jsonify({'success': True, 'homework': homework.to_dict()})

@app.route('/api/teacher/homework/<int:hw_id>/submissions')
@teacher_required
def api_get_homework_submissions(hw_id):
    """Get all submissions for a homework"""
    homework = Homework.query.get_or_404(hw_id)
    submissions = Submission.query.filter_by(homework_id=hw_id).order_by(Submission.submitted_at.desc()).all()
    
    return jsonify({
        'homework': homework.to_dict(),
        'submissions': [s.to_dict() for s in submissions]
    })

@app.route('/api/teacher/submission/<int:sub_id>/grade', methods=['POST'])
@teacher_required
def api_grade_submission(sub_id):
    """Grade a submission"""
    submission = Submission.query.get_or_404(sub_id)
    data = request.get_json()
    
    submission.grade = data.get('grade')
    submission.feedback = data.get('feedback', '')
    submission.is_graded = True
    db.session.commit()
    
    return jsonify({'success': True, 'submission': submission.to_dict()})

# ============== QUIZ MANAGEMENT ==============

@app.route('/api/teacher/quiz', methods=['POST'])
@teacher_required
def api_add_quiz():
    """Add new quiz"""
    data = request.get_json()
    
    quiz = Quiz(
        title=data['title'],
        subject_name=data['subject_name'],
        quiz_date=datetime.strptime(data['quiz_date'], '%Y-%m-%d').date(),
        duration_minutes=int(data.get('duration_minutes', 60)),
        student_id=data.get('student_id'),
        created_by=session['user_id']
    )
    db.session.add(quiz)
    db.session.commit()
    
    # Add questions if provided
    questions = data.get('questions', [])
    for i, q in enumerate(questions):
        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q['question_text'],
            question_type=q.get('question_type', 'mcq'),
            options=json.dumps(q.get('options', [])) if q.get('options') else None,
            correct_answer=q.get('correct_answer'),
            marks=q.get('marks', 1),
            order=i
        )
        db.session.add(question)
    
    db.session.commit()
    
    # Create reminders
    if quiz.student_id:
        reminder = Reminder(
            student_id=quiz.student_id,
            message=f"Upcoming quiz: {quiz.title} for {quiz.subject_name} on {quiz.quiz_date}",
            reminder_type='quiz'
        )
        db.session.add(reminder)
        db.session.commit()
    else:
        students = User.query.filter_by(role='student').all()
        for student in students:
            reminder = Reminder(
                student_id=student.id,
                message=f"Upcoming quiz: {quiz.title} for {quiz.subject_name} on {quiz.quiz_date}",
                reminder_type='quiz'
            )
            db.session.add(reminder)
        db.session.commit()
    
    return jsonify({'success': True, 'quiz': quiz.to_dict()})

@app.route('/api/teacher/quiz/<int:quiz_id>', methods=['PUT', 'DELETE'])
@teacher_required
def api_manage_quiz(quiz_id):
    """Update or delete quiz"""
    quiz = Quiz.query.get_or_404(quiz_id)
    
    if request.method == 'DELETE':
        db.session.delete(quiz)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Quiz deleted'})
    
    data = request.get_json()
    quiz.title = data.get('title', quiz.title)
    quiz.subject_name = data.get('subject_name', quiz.subject_name)
    if 'quiz_date' in data:
        quiz.quiz_date = datetime.strptime(data['quiz_date'], '%Y-%m-%d').date()
    quiz.duration_minutes = data.get('duration_minutes', quiz.duration_minutes)
    db.session.commit()
    
    return jsonify({'success': True, 'quiz': quiz.to_dict()})

@app.route('/api/teacher/quiz/<int:quiz_id>/questions', methods=['GET', 'POST'])
@teacher_required
def api_manage_quiz_questions(quiz_id):
    """Get or add questions to quiz"""
    quiz = Quiz.query.get_or_404(quiz_id)
    
    if request.method == 'GET':
        questions = QuizQuestion.query.filter_by(quiz_id=quiz_id).order_by(QuizQuestion.order).all()
        return jsonify({
            'quiz': quiz.to_dict(),
            'questions': [q.to_dict() for q in questions]
        })
    
    # POST - Add new question
    data = request.get_json()
    
    question = QuizQuestion(
        quiz_id=quiz_id,
        question_text=data['question_text'],
        question_type=data.get('question_type', 'mcq'),
        options=json.dumps(data.get('options', [])) if data.get('options') else None,
        correct_answer=data.get('correct_answer'),
        marks=data.get('marks', 1),
        order=QuizQuestion.query.filter_by(quiz_id=quiz_id).count()
    )
    db.session.add(question)
    db.session.commit()
    
    return jsonify({'success': True, 'question': question.to_dict()})

@app.route('/api/teacher/quiz/<int:quiz_id>/questions/<int:question_id>', methods=['PUT', 'DELETE'])
@teacher_required
def api_manage_single_question(quiz_id, question_id):
    """Update or delete a quiz question"""
    question = QuizQuestion.query.get_or_404(question_id)
    
    if request.method == 'DELETE':
        db.session.delete(question)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Question deleted'})
    
    data = request.get_json()
    question.question_text = data.get('question_text', question.question_text)
    question.question_type = data.get('question_type', question.question_type)
    if 'options' in data:
        question.options = json.dumps(data['options'])
    question.correct_answer = data.get('correct_answer', question.correct_answer)
    question.marks = data.get('marks', question.marks)
    db.session.commit()
    
    return jsonify({'success': True, 'question': question.to_dict()})

@app.route('/api/teacher/quiz/<int:quiz_id>/submissions')
@teacher_required
def api_get_quiz_submissions(quiz_id):
    """Get all student submissions for a quiz"""
    quiz = Quiz.query.get_or_404(quiz_id)
    
    # Get all students who submitted
    answers = QuizAnswer.query.filter_by(quiz_id=quiz_id).all()
    student_ids = list(set([a.student_id for a in answers]))
    
    submissions = []
    for student_id in student_ids:
        student = User.query.get(student_id)
        student_answers = QuizAnswer.query.filter_by(quiz_id=quiz_id, student_id=student_id).all()
        total_marks = sum(a.marks_obtained or 0 for a in student_answers)
        max_marks = sum(a.question.marks or 1 for a in student_answers if a.question)
        is_graded = all(a.is_graded for a in student_answers) if student_answers else False
        
        submissions.append({
            'student_id': student_id,
            'student_name': student.name if student else 'Unknown',
            'answers': [a.to_dict() for a in student_answers],
            'total_marks': total_marks,
            'max_marks': max_marks,
            'is_graded': is_graded,
            'submitted_at': student_answers[0].submitted_at.isoformat() if student_answers else None
        })
    
    return jsonify({
        'quiz': quiz.to_dict(),
        'submissions': submissions
    })

@app.route('/api/teacher/quiz-answer/<int:answer_id>/grade', methods=['POST'])
@teacher_required
def api_grade_quiz_answer(answer_id):
    """Grade a quiz answer"""
    answer = QuizAnswer.query.get_or_404(answer_id)
    data = request.get_json()
    
    answer.marks_obtained = data.get('marks_obtained')
    answer.is_graded = True
    db.session.commit()
    
    return jsonify({'success': True, 'answer': answer.to_dict()})

# ============== ATTENDANCE MANAGEMENT ==============

@app.route('/api/teacher/attendance')
@teacher_required
def api_get_attendance():
    """Get attendance records with filters"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    student_id = request.args.get('student_id')
    schedule_id = request.args.get('schedule_id')
    
    query = Attendance.query
    
    if start_date:
        query = query.filter(Attendance.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
    if end_date:
        query = query.filter(Attendance.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
    if student_id:
        query = query.filter_by(student_id=int(student_id))
    if schedule_id:
        query = query.filter_by(schedule_id=int(schedule_id))
    
    attendance_records = query.order_by(Attendance.date.desc()).all()
    
    return jsonify({
        'attendance': [a.to_dict() for a in attendance_records]
    })

@app.route('/api/teacher/attendance/download')
@teacher_required
def api_download_attendance():
    """Download attendance report as CSV or Excel"""
    format_type = request.args.get('format', 'csv')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    student_id = request.args.get('student_id')
    schedule_id = request.args.get('schedule_id')
    
    query = Attendance.query
    
    if start_date:
        query = query.filter(Attendance.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
    if end_date:
        query = query.filter(Attendance.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
    if student_id:
        query = query.filter_by(student_id=int(student_id))
    if schedule_id:
        query = query.filter_by(schedule_id=int(schedule_id))
    
    attendance_records = query.order_by(Attendance.date.desc()).all()
    
    data = []
    for record in attendance_records:
        data.append({
            'Date': record.date,
            'Student Name': record.student.name if record.student else 'Unknown',
            'Student Email': record.student.email if record.student else 'Unknown',
            'Subject': record.schedule.subject_name if record.schedule else 'Unknown',
            'Room': record.schedule.room_number if record.schedule else 'Unknown',
            'Check-in Time': record.check_in_time.strftime('%H:%M:%S') if record.check_in_time else '',
            'Status': record.status.capitalize(),
            'IP Address': record.ip_address or 'N/A'
        })
    
    df = pd.DataFrame(data)
    
    if format_type == 'excel':
        output = BytesIO()
        df.to_excel(output, index=False, sheet_name='Attendance Report')
        output.seek(0)
        return Response(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename=attendance_report.xlsx'}
        )
    else:
        output = df.to_csv(index=False)
        return Response(
            output,
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=attendance_report.csv'}
        )

@app.route('/api/teacher/attendance/analytics')
@teacher_required
def api_attendance_analytics():
    """Get attendance analytics"""
    # Daily attendance for last 30 days
    from datetime import timedelta
    
    end_date = date.today()
    start_date = end_date - timedelta(days=30)
    
    daily_stats = []
    current = start_date
    while current <= end_date:
        day_attendance = Attendance.query.filter_by(date=current).all()
        present = sum(1 for a in day_attendance if a.status == 'present')
        late = sum(1 for a in day_attendance if a.status == 'late')
        absent = sum(1 for a in day_attendance if a.status == 'absent')
        
        daily_stats.append({
            'date': current.isoformat(),
            'present': present,
            'late': late,
            'absent': absent,
            'total': len(day_attendance)
        })
        current += timedelta(days=1)
    
    # Student-wise attendance
    students = User.query.filter_by(role='student').all()
    student_stats = []
    for student in students:
        total = Attendance.query.filter_by(student_id=student.id).count()
        present = Attendance.query.filter_by(student_id=student.id, status='present').count()
        late = Attendance.query.filter_by(student_id=student.id, status='late').count()
        rate = ((present + late) / total * 100) if total > 0 else 0
        
        student_stats.append({
            'student_id': student.id,
            'student_name': student.name,
            'total': total,
            'present': present,
            'late': late,
            'rate': round(rate, 2)
        })
    
    return jsonify({
        'daily_stats': daily_stats,
        'student_stats': student_stats
    })

@app.route('/api/teacher/student/<int:student_id>/attendance')
@teacher_required
def api_student_attendance_detail(student_id):
    """Get detailed attendance for a specific student"""
    student = User.query.get_or_404(student_id)
    
    attendance_records = Attendance.query.filter_by(student_id=student_id).order_by(Attendance.date.desc()).all()
    
    total = len(attendance_records)
    present = sum(1 for a in attendance_records if a.status == 'present')
    late = sum(1 for a in attendance_records if a.status == 'late')
    absent = sum(1 for a in attendance_records if a.status == 'absent')
    
    return jsonify({
        'student': student.to_dict(),
        'attendance': [a.to_dict() for a in attendance_records],
        'stats': {
            'total': total,
            'present': present,
            'late': late,
            'absent': absent,
            'rate': round(((present + late) / total * 100), 2) if total > 0 else 0
        }
    })

# ============== RESTRICTION SETTINGS ==============

@app.route('/api/teacher/restrictions', methods=['GET', 'PUT'])
@teacher_required
def api_manage_restrictions():
    """Get or update restriction settings"""
    settings = RestrictionSettings.query.first()
    
    if not settings:
        settings = RestrictionSettings()
        db.session.add(settings)
        db.session.commit()
    
    if request.method == 'GET':
        return jsonify(settings.to_dict())
    
    # Update settings
    data = request.get_json()
    
    settings.network_restriction_enabled = data.get('network_restriction_enabled', settings.network_restriction_enabled)
    settings.location_restriction_enabled = data.get('location_restriction_enabled', settings.location_restriction_enabled)
    
    if 'allowed_ip_ranges' in data:
        settings.allowed_ip_ranges = json.dumps(data['allowed_ip_ranges'])
    if 'allowed_wifi_networks' in data:
        settings.allowed_wifi_networks = json.dumps(data['allowed_wifi_networks'])
    
    settings.allowed_latitude = data.get('allowed_latitude', settings.allowed_latitude)
    settings.allowed_longitude = data.get('allowed_longitude', settings.allowed_longitude)
    settings.allowed_radius_meters = data.get('allowed_radius_meters', settings.allowed_radius_meters)
    settings.updated_by = session['user_id']
    
    db.session.commit()
    
    return jsonify({'success': True, 'settings': settings.to_dict()})

# ============== UTILITY ROUTES ==============

@app.route('/api/test')
def api_test():
    """Test API endpoint"""
    return jsonify({
        'status': 'success',
        'message': 'Face Recognition Attendance System API is running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/static/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ============== MAIN ==============

if __name__ == '__main__':
    print("=" * 60)
    print("Face Recognition Attendance System")
    print("AI/ML College Project - Enhanced Version")
    print("=" * 60)
    print("Starting server on http://localhost:5000")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    app.run(debug=True, host='127.0.0.1', port=5000)
