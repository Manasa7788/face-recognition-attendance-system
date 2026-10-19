"""
Database Schema and Models for Face Recognition Attendance System
Enhanced with new features for submissions, quiz answers, and restrictions
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, time, date
import json

db = SQLAlchemy()

class User(db.Model):
    """Base User Model - Both Students and Teachers"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'student' or 'teacher'
    face_encoding_path = db.Column(db.String(255))  # Path to saved face encoding
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    attendances = db.relationship('Attendance', backref='student', lazy=True, foreign_keys='Attendance.student_id')
    schedules = db.relationship('ClassSchedule', backref='teacher', lazy=True, foreign_keys='ClassSchedule.teacher_id')
    homeworks = db.relationship('Homework', backref='student', lazy=True, foreign_keys='Homework.student_id')
    quizzes = db.relationship('Quiz', backref='student', lazy=True, foreign_keys='Quiz.student_id')
    submissions = db.relationship('Submission', backref='student', lazy=True, foreign_keys='Submission.student_id')
    quiz_answers = db.relationship('QuizAnswer', backref='student', lazy=True, foreign_keys='QuizAnswer.student_id')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'created_at': self.created_at.isoformat()
        }

class ClassSchedule(db.Model):
    """Class Schedule Model"""
    __tablename__ = 'class_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_name = db.Column(db.String(100), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    room_number = db.Column(db.String(20))
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'subject_name': self.subject_name,
            'day_of_week': self.day_of_week,
            'day_name': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][self.day_of_week],
            'start_time': self.start_time.strftime('%H:%M'),
            'end_time': self.end_time.strftime('%H:%M'),
            'room_number': self.room_number,
            'teacher_id': self.teacher_id
        }

class Attendance(db.Model):
    """Attendance Record Model"""
    __tablename__ = 'attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    schedule_id = db.Column(db.Integer, db.ForeignKey('class_schedules.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    check_in_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='present')  # present, absent, late
    ip_address = db.Column(db.String(50))  # IP address for network restriction
    latitude = db.Column(db.Float)  # GPS coordinates for location restriction
    longitude = db.Column(db.Float)
    
    schedule = db.relationship('ClassSchedule')
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'schedule_id': self.schedule_id,
            'subject_name': self.schedule.subject_name if self.schedule else None,
            'date': self.date.isoformat(),
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'status': self.status,
            'ip_address': self.ip_address,
            'latitude': self.latitude,
            'longitude': self.longitude
        }

class Homework(db.Model):
    """Homework Assignment Model"""
    __tablename__ = 'homeworks'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    subject_name = db.Column(db.String(100), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'))  # Assigned to specific student or all if null
    is_completed = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # Teacher who created
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    allow_text_submission = db.Column(db.Boolean, default=True)
    allow_file_submission = db.Column(db.Boolean, default=True)
    
    creator = db.relationship('User', foreign_keys=[created_by])
    submissions = db.relationship('Submission', backref='homework', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'subject_name': self.subject_name,
            'due_date': self.due_date.isoformat(),
            'student_id': self.student_id,
            'is_completed': self.is_completed,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'allow_text_submission': self.allow_text_submission,
            'allow_file_submission': self.allow_file_submission
        }

class Quiz(db.Model):
    """Quiz/Exam Model"""
    __tablename__ = 'quizzes'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    subject_name = db.Column(db.String(100), nullable=False)
    quiz_date = db.Column(db.Date, nullable=False)
    duration_minutes = db.Column(db.Integer, default=60)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'))  # Assigned to specific student or all if null
    is_completed = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    creator = db.relationship('User', foreign_keys=[created_by])
    questions = db.relationship('QuizQuestion', backref='quiz', lazy=True, cascade='all, delete-orphan')
    answers = db.relationship('QuizAnswer', backref='quiz', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'subject_name': self.subject_name,
            'quiz_date': self.quiz_date.isoformat(),
            'duration_minutes': self.duration_minutes,
            'student_id': self.student_id,
            'is_completed': self.is_completed,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'question_count': len(self.questions)
        }

class QuizQuestion(db.Model):
    """Individual Quiz Questions"""
    __tablename__ = 'quiz_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(20), default='mcq')  # mcq, descriptive
    options = db.Column(db.Text)  # JSON string for MCQ options
    correct_answer = db.Column(db.Text)  # For auto-grading MCQs
    marks = db.Column(db.Integer, default=1)
    order = db.Column(db.Integer, default=0)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'question_text': self.question_text,
            'question_type': self.question_type,
            'options': json.loads(self.options) if self.options else None,
            'marks': self.marks,
            'order': self.order
        }

class QuizAnswer(db.Model):
    """Student Answers to Quiz Questions"""
    __tablename__ = 'quiz_answers'
    
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('quiz_questions.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    answer_text = db.Column(db.Text)
    marks_obtained = db.Column(db.Integer)
    is_graded = db.Column(db.Boolean, default=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    question = db.relationship('QuizQuestion')
    
    def to_dict(self):
        return {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'question_id': self.question_id,
            'student_id': self.student_id,
            'answer_text': self.answer_text,
            'marks_obtained': self.marks_obtained,
            'is_graded': self.is_graded,
            'submitted_at': self.submitted_at.isoformat()
        }

class Submission(db.Model):
    """Homework Submissions by Students"""
    __tablename__ = 'submissions'
    
    id = db.Column(db.Integer, primary_key=True)
    homework_id = db.Column(db.Integer, db.ForeignKey('homeworks.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    submission_text = db.Column(db.Text)  # For text-based submissions
    file_path = db.Column(db.String(255))  # For file uploads
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_graded = db.Column(db.Boolean, default=False)
    grade = db.Column(db.String(10))
    feedback = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'homework_id': self.homework_id,
            'student_id': self.student_id,
            'submission_text': self.submission_text,
            'file_path': self.file_path,
            'submitted_at': self.submitted_at.isoformat(),
            'is_graded': self.is_graded,
            'grade': self.grade,
            'feedback': self.feedback
        }

class Reminder(db.Model):
    """Reminder Model for voice notifications"""
    __tablename__ = 'reminders'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    reminder_type = db.Column(db.String(50))  # class, homework, quiz, general
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'message': self.message,
            'reminder_type': self.reminder_type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat()
        }

class RestrictionSettings(db.Model):
    """Network and Location Restriction Settings"""
    __tablename__ = 'restriction_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    network_restriction_enabled = db.Column(db.Boolean, default=False)
    location_restriction_enabled = db.Column(db.Boolean, default=False)
    allowed_ip_ranges = db.Column(db.Text)  # JSON array of IP ranges
    allowed_wifi_networks = db.Column(db.Text)  # JSON array of WiFi SSIDs
    allowed_latitude = db.Column(db.Float)
    allowed_longitude = db.Column(db.Float)
    allowed_radius_meters = db.Column(db.Float, default=100)  # Geo-fencing radius
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'network_restriction_enabled': self.network_restriction_enabled,
            'location_restriction_enabled': self.location_restriction_enabled,
            'allowed_ip_ranges': json.loads(self.allowed_ip_ranges) if self.allowed_ip_ranges else [],
            'allowed_wifi_networks': json.loads(self.allowed_wifi_networks) if self.allowed_wifi_networks else [],
            'allowed_latitude': self.allowed_latitude,
            'allowed_longitude': self.allowed_longitude,
            'allowed_radius_meters': self.allowed_radius_meters,
            'updated_at': self.updated_at.isoformat()
        }

class AIConversation(db.Model):
    """Store AI Assistant Conversations"""
    __tablename__ = 'ai_conversations'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    context_type = db.Column(db.String(50))  # schedule, homework, quiz, attendance, general
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'message': self.message,
            'response': self.response,
            'context_type': self.context_type,
            'created_at': self.created_at.isoformat()
        }

def init_db(app):
    """Initialize database with sample data"""
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        
        # Check if admin already exists
        admin = User.query.filter_by(role='teacher').first()
        if not admin:
            # Create default admin/teacher
            admin = User(
                name='Admin Teacher',
                email='admin@college.edu',
                role='teacher'
            )
            db.session.add(admin)
            db.session.commit()
            
            # Create sample class schedules
            schedules = [
                ClassSchedule(
                    subject_name='Machine Learning',
                    day_of_week=0,  # Monday
                    start_time=time(9, 0),
                    end_time=time(11, 0),
                    room_number='Lab 101',
                    teacher_id=admin.id
                ),
                ClassSchedule(
                    subject_name='Deep Learning',
                    day_of_week=2,  # Wednesday
                    start_time=time(14, 0),
                    end_time=time(16, 0),
                    room_number='Lab 102',
                    teacher_id=admin.id
                ),
                ClassSchedule(
                    subject_name='Natural Language Processing',
                    day_of_week=4,  # Friday
                    start_time=time(10, 0),
                    end_time=time(12, 0),
                    room_number='Room 301',
                    teacher_id=admin.id
                ),
                ClassSchedule(
                    subject_name='Computer Vision',
                    day_of_week=1,  # Tuesday
                    start_time=time(11, 0),
                    end_time=time(13, 0),
                    room_number='Lab 103',
                    teacher_id=admin.id
                ),
                ClassSchedule(
                    subject_name='Data Science',
                    day_of_week=3,  # Thursday
                    start_time=time(9, 0),
                    end_time=time(11, 0),
                    room_number='Room 201',
                    teacher_id=admin.id
                )
            ]
            db.session.add_all(schedules)
            
            # Create sample homework
            homeworks = [
                Homework(
                    title='Implement Linear Regression',
                    description='Build a linear regression model from scratch using Python and NumPy.',
                    subject_name='Machine Learning',
                    due_date=date.today() + __import__('datetime').timedelta(days=7),
                    created_by=admin.id,
                    allow_text_submission=True,
                    allow_file_submission=True
                ),
                Homework(
                    title='CNN Architecture Analysis',
                    description='Analyze the architecture of ResNet and write a report.',
                    subject_name='Deep Learning',
                    due_date=date.today() + __import__('datetime').timedelta(days=5),
                    created_by=admin.id,
                    allow_text_submission=True,
                    allow_file_submission=True
                ),
                Homework(
                    title='Sentiment Analysis Project',
                    description='Build a sentiment analysis model using NLP techniques.',
                    subject_name='Natural Language Processing',
                    due_date=date.today() + __import__('datetime').timedelta(days=10),
                    created_by=admin.id,
                    allow_text_submission=True,
                    allow_file_submission=True
                )
            ]
            db.session.add_all(homeworks)
            
            # Create sample quizzes
            quizzes = [
                Quiz(
                    title='ML Fundamentals Quiz',
                    subject_name='Machine Learning',
                    quiz_date=date.today() + __import__('datetime').timedelta(days=3),
                    duration_minutes=45,
                    created_by=admin.id
                ),
                Quiz(
                    title='Neural Networks Basics',
                    subject_name='Deep Learning',
                    quiz_date=date.today() + __import__('datetime').timedelta(days=6),
                    duration_minutes=60,
                    created_by=admin.id
                )
            ]
            db.session.add_all(quizzes)
            
            # Create default restriction settings
            restrictions = RestrictionSettings(
                network_restriction_enabled=False,
                location_restriction_enabled=False,
                allowed_radius_meters=100,
                updated_by=admin.id
            )
            db.session.add(restrictions)
            
            db.session.commit()
            
            print("Database initialized with default admin, schedules, homework, and quizzes!")
            print("Admin credentials: admin@college.edu")
