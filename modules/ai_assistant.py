"""
AI Assistant Module for Students
Fetches real data from database and provides intelligent responses
"""
import re
from datetime import datetime, date
from database import db, User, ClassSchedule, Attendance, Homework, Quiz, Reminder

class AIAssistant:
    """AI Assistant that understands student queries and fetches real system data"""
    
    def __init__(self):
        self.context_keywords = {
            'schedule': ['class', 'schedule', 'timetable', 'when', 'what time', 'next class', 'today classes'],
            'attendance': ['attendance', 'present', 'absent', 'late', 'attended', 'missed', 'percentage'],
            'homework': ['homework', 'assignment', 'task', 'due', 'submit', 'pending work'],
            'quiz': ['quiz', 'exam', 'test', 'assessment', 'upcoming quiz'],
            'grades': ['grade', 'marks', 'score', 'result', 'feedback'],
            'general': ['help', 'what can you do', 'hello', 'hi', 'thank']
        }
    
    def detect_context(self, message):
        """Detect the context of the student query"""
        message_lower = message.lower()
        
        for context, keywords in self.context_keywords.items():
            for keyword in keywords:
                if keyword in message_lower:
                    return context
        
        return 'general'
    
    def process_query(self, student_id, message):
        """Process student query and return intelligent response with real data"""
        context = self.detect_context(message)
        
        # Get student info
        student = User.query.get(student_id)
        if not student:
            return {
                'response': "I'm sorry, I couldn't find your student record. Please contact your administrator.",
                'context_type': 'error'
            }
        
        # Route to appropriate handler
        if context == 'schedule':
            return self.handle_schedule_query(student_id, message)
        elif context == 'attendance':
            return self.handle_attendance_query(student_id, message)
        elif context == 'homework':
            return self.handle_homework_query(student_id, message)
        elif context == 'quiz':
            return self.handle_quiz_query(student_id, message)
        elif context == 'grades':
            return self.handle_grades_query(student_id, message)
        else:
            return self.handle_general_query(student_id, message)
    
    def handle_schedule_query(self, student_id, message):
        """Handle class schedule related queries"""
        today = datetime.now().weekday()
        current_time = datetime.now().time()
        
        # Check if asking for today's schedule
        if 'today' in message.lower():
            schedules = ClassSchedule.query.filter_by(day_of_week=today).order_by(ClassSchedule.start_time).all()
            
            if not schedules:
                return {
                    'response': "You have no classes scheduled for today. Enjoy your free day!",
                    'context_type': 'schedule',
                    'data': []
                }
            
            response = f"📅 **Today's Schedule ({['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][today]}):**\n\n"
            for schedule in schedules:
                response += f"• **{schedule.subject_name}**\n"
                response += f"  🕐 {schedule.start_time.strftime('%H:%M')} - {schedule.end_time.strftime('%H:%M')}\n"
                response += f"  🚪 Room: {schedule.room_number}\n\n"
            
            # Find next class
            next_class = None
            for schedule in schedules:
                if schedule.start_time > current_time:
                    next_class = schedule
                    break
            
            if next_class:
                response += f"⏰ **Your next class is {next_class.subject_name} at {next_class.start_time.strftime('%H:%M')}**"
            else:
                response += "✅ You've completed all your classes for today!"
            
            return {
                'response': response,
                'context_type': 'schedule',
                'data': [s.to_dict() for s in schedules]
            }
        
        # Check if asking for next class
        elif 'next' in message.lower() or 'upcoming' in message.lower():
            schedules = ClassSchedule.query.filter_by(day_of_week=today).order_by(ClassSchedule.start_time).all()
            
            next_class = None
            for schedule in schedules:
                if schedule.start_time > current_time:
                    next_class = schedule
                    break
            
            if next_class:
                return {
                    'response': f"⏰ **Your next class:**\n\n📚 **{next_class.subject_name}**\n🕐 Time: {next_class.start_time.strftime('%H:%M')} - {next_class.end_time.strftime('%H:%M')}\n🚪 Room: {next_class.room_number}",
                    'context_type': 'schedule',
                    'data': next_class.to_dict()
                }
            else:
                # Check tomorrow
                tomorrow = (today + 1) % 7
                tomorrow_schedules = ClassSchedule.query.filter_by(day_of_week=tomorrow).order_by(ClassSchedule.start_time).all()
                
                if tomorrow_schedules:
                    first_class = tomorrow_schedules[0]
                    return {
                        'response': f"No more classes today! Your first class tomorrow is **{first_class.subject_name}** at {first_class.start_time.strftime('%H:%M')}.",
                        'context_type': 'schedule',
                        'data': first_class.to_dict()
                    }
                else:
                    return {
                        'response': "No more classes today and nothing scheduled for tomorrow. Enjoy your break!",
                        'context_type': 'schedule',
                        'data': None
                    }
        
        # Full week schedule
        else:
            all_schedules = ClassSchedule.query.order_by(ClassSchedule.day_of_week, ClassSchedule.start_time).all()
            
            if not all_schedules:
                return {
                    'response': "No class schedules have been set up yet.",
                    'context_type': 'schedule',
                    'data': []
                }
            
            response = "📅 **Your Weekly Schedule:**\n\n"
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            current_day = -1
            
            for schedule in all_schedules:
                if schedule.day_of_week != current_day:
                    current_day = schedule.day_of_week
                    response += f"**{days[current_day]}:**\n"
                response += f"  • {schedule.subject_name}: {schedule.start_time.strftime('%H:%M')}-{schedule.end_time.strftime('%H:%M')} ({schedule.room_number})\n"
            
            return {
                'response': response,
                'context_type': 'schedule',
                'data': [s.to_dict() for s in all_schedules]
            }
    
    def handle_attendance_query(self, student_id, message):
        """Handle attendance related queries"""
        # Get attendance records
        attendance_records = Attendance.query.filter_by(student_id=student_id).order_by(Attendance.date.desc()).all()
        
        # Calculate stats
        total = len(attendance_records)
        present = sum(1 for a in attendance_records if a.status == 'present')
        late = sum(1 for a in attendance_records if a.status == 'late')
        absent = sum(1 for a in attendance_records if a.status == 'absent')
        
        attendance_rate = ((present + late) / total * 100) if total > 0 else 0
        
        # Check if asking for specific stats
        if 'percentage' in message.lower() or 'rate' in message.lower():
            return {
                'response': f"📊 **Your Attendance Statistics:**\n\n✅ Present: {present}\n⏰ Late: {late}\n❌ Absent: {absent}\n📈 Attendance Rate: {attendance_rate:.1f}%",
                'context_type': 'attendance',
                'data': {'total': total, 'present': present, 'late': late, 'absent': absent, 'rate': attendance_rate}
            }
        
        # Recent attendance
        elif 'recent' in message.lower() or 'last' in message.lower():
            if not attendance_records:
                return {
                    'response': "You don't have any attendance records yet.",
                    'context_type': 'attendance',
                    'data': []
                }
            
            recent = attendance_records[:5]
            response = "📋 **Your Recent Attendance:**\n\n"
            
            for record in recent:
                status_emoji = {'present': '✅', 'late': '⏰', 'absent': '❌'}.get(record.status, '❓')
                response += f"{status_emoji} {record.date.strftime('%Y-%m-%d')} - {record.schedule.subject_name if record.schedule else 'Unknown'} ({record.status})\n"
            
            return {
                'response': response,
                'context_type': 'attendance',
                'data': [a.to_dict() for a in recent]
            }
        
        # General attendance info
        else:
            if total == 0:
                return {
                    'response': "You don't have any attendance records yet. Your attendance will be recorded when you check in for classes using face recognition.",
                    'context_type': 'attendance',
                    'data': None
                }
            
            response = f"📊 **Your Attendance Summary:**\n\n"
            response += f"✅ Present: {present}\n"
            response += f"⏰ Late: {late}\n"
            response += f"❌ Absent: {absent}\n"
            response += f"📈 Overall Attendance Rate: **{attendance_rate:.1f}%**\n\n"
            
            if attendance_rate >= 90:
                response += "🌟 Excellent attendance! Keep it up!"
            elif attendance_rate >= 75:
                response += "👍 Good attendance! Try to maintain it!"
            else:
                response += "⚠️ Your attendance needs improvement. Regular attendance is important for academic success!"
            
            return {
                'response': response,
                'context_type': 'attendance',
                'data': {'total': total, 'present': present, 'late': late, 'absent': absent, 'rate': attendance_rate}
            }
    
    def handle_homework_query(self, student_id, message):
        """Handle homework related queries"""
        # Get pending homework
        pending_homework = Homework.query.filter(
            ((Homework.student_id == student_id) | (Homework.student_id == None)),
            Homework.due_date >= date.today(),
            Homework.is_completed == False
        ).order_by(Homework.due_date).all()
        
        if not pending_homework:
            return {
                'response': "🎉 Great news! You have no pending homework assignments. Enjoy your free time!",
                'context_type': 'homework',
                'data': []
            }
        
        # Check if asking for count
        if 'how many' in message.lower() or 'count' in message.lower():
            return {
                'response': f"📚 You have **{len(pending_homework)}** pending homework assignment(s).",
                'context_type': 'homework',
                'data': {'count': len(pending_homework)}
            }
        
        # List all pending homework
        response = f"📚 **Your Pending Homework ({len(pending_homework)}):**\n\n"
        
        for hw in pending_homework:
            days_left = (hw.due_date - date.today()).days
            urgency = "🔴" if days_left <= 2 else "🟡" if days_left <= 5 else "🟢"
            response += f"{urgency} **{hw.title}**\n"
            response += f"   📖 Subject: {hw.subject_name}\n"
            response += f"   📅 Due: {hw.due_date.strftime('%Y-%m-%d')} ({days_left} days left)\n"
            if hw.description:
                response += f"   📝 {hw.description[:100]}{'...' if len(hw.description) > 100 else ''}\n"
            response += "\n"
        
        return {
            'response': response,
            'context_type': 'homework',
            'data': [h.to_dict() for h in pending_homework]
        }
    
    def handle_quiz_query(self, student_id, message):
        """Handle quiz related queries"""
        # Get upcoming quizzes
        upcoming_quizzes = Quiz.query.filter(
            ((Quiz.student_id == student_id) | (Quiz.student_id == None)),
            Quiz.quiz_date >= date.today(),
            Quiz.is_completed == False
        ).order_by(Quiz.quiz_date).all()
        
        if not upcoming_quizzes:
            return {
                'response': "🎉 No upcoming quizzes! You can relax and focus on your studies.",
                'context_type': 'quiz',
                'data': []
            }
        
        response = f"📝 **Upcoming Quizzes ({len(upcoming_quizzes)}):**\n\n"
        
        for quiz in upcoming_quizzes:
            days_left = (quiz.quiz_date - date.today()).days
            urgency = "🔴" if days_left <= 2 else "🟡" if days_left <= 5 else "🟢"
            response += f"{urgency} **{quiz.title}**\n"
            response += f"   📖 Subject: {quiz.subject_name}\n"
            response += f"   📅 Date: {quiz.quiz_date.strftime('%Y-%m-%d')} ({days_left} days left)\n"
            response += f"   ⏱️ Duration: {quiz.duration_minutes} minutes\n\n"
        
        return {
            'response': response,
            'context_type': 'quiz',
            'data': [q.to_dict() for q in upcoming_quizzes]
        }
    
    def handle_grades_query(self, student_id, message):
        """Handle grades related queries"""
        from database import Submission, QuizAnswer
        
        # Get graded homework submissions
        homework_submissions = Submission.query.filter_by(student_id=student_id, is_graded=True).all()
        
        # Get graded quiz answers
        quiz_answers = QuizAnswer.query.filter_by(student_id=student_id, is_graded=True).all()
        
        if not homework_submissions and not quiz_answers:
            return {
                'response': "📊 You don't have any grades yet. Complete and submit your assignments to get graded!",
                'context_type': 'grades',
                'data': None
            }
        
        response = "📊 **Your Grades:**\n\n"
        
        # Homework grades
        if homework_submissions:
            response += "**Homework:**\n"
            for sub in homework_submissions:
                hw = Homework.query.get(sub.homework_id)
                response += f"  • {hw.title if hw else 'Unknown'}: **{sub.grade}**\n"
            response += "\n"
        
        # Quiz grades
        if quiz_answers:
            response += "**Quizzes:**\n"
            quiz_ids = list(set([a.quiz_id for a in quiz_answers]))
            for quiz_id in quiz_ids:
                quiz = Quiz.query.get(quiz_id)
                answers = [a for a in quiz_answers if a.quiz_id == quiz_id]
                total_marks = sum(a.marks_obtained or 0 for a in answers)
                max_marks = sum(a.question.marks or 1 for a in answers if a.question)
                response += f"  • {quiz.title if quiz else 'Unknown'}: **{total_marks}/{max_marks}**\n"
        
        return {
            'response': response,
            'context_type': 'grades',
            'data': {
                'homework_grades': [s.to_dict() for s in homework_submissions],
                'quiz_grades': [a.to_dict() for a in quiz_answers]
            }
        }
    
    def handle_general_query(self, student_id, message):
        """Handle general queries"""
        message_lower = message.lower()
        
        # Greeting
        if any(word in message_lower for word in ['hello', 'hi', 'hey']):
            student = User.query.get(student_id)
            return {
                'response': f"Hello {student.name}! 👋 I'm your AI Study Assistant. I can help you with:\n\n📅 Class schedules\n📊 Attendance records\n📚 Homework assignments\n📝 Upcoming quizzes\n📈 Your grades\n\nWhat would you like to know?",
                'context_type': 'general'
            }
        
        # Help
        elif 'help' in message_lower or 'what can you do' in message_lower:
            return {
                'response': "🤖 **I can help you with:**\n\n📅 **Schedule Queries:**\n• 'What classes do I have today?'\n• 'When is my next class?'\n• 'Show my weekly schedule'\n\n📊 **Attendance Queries:**\n• 'What is my attendance percentage?'\n• 'Show my recent attendance'\n• 'How is my attendance?'\n\n📚 **Homework Queries:**\n• 'What homework do I have?'\n• 'How many pending assignments?'\n• 'Show pending homework'\n\n📝 **Quiz Queries:**\n• 'What quizzes are coming up?'\n• 'Show upcoming quizzes'\n\n📈 **Grade Queries:**\n• 'Show my grades'\n• 'What are my quiz scores?'\n\nFeel free to ask me anything about your academic information!",
                'context_type': 'general'
            }
        
        # Thank you
        elif 'thank' in message_lower:
            return {
                'response': "You're welcome! 😊 I'm here to help you succeed in your studies. Feel free to ask if you need anything else!",
                'context_type': 'general'
            }
        
        # Default response
        else:
            return {
                'response': "I'm not sure I understood that. You can ask me about:\n\n📅 Your class schedule\n📊 Your attendance records\n📚 Pending homework\n📝 Upcoming quizzes\n📈 Your grades\n\nOr type 'help' to see what I can do!",
                'context_type': 'general'
            }

# Global instance
ai_assistant = AIAssistant()
