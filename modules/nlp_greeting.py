"""
NLP Greeting Module - Generates personalized voice greetings for students
"""
from datetime import datetime

class NLPGreeting:
    """Natural Language Processing for personalized greetings"""
    
    def __init__(self):
        self.greeting_templates = {
            'morning': [
                "Good morning, {name}! Ready to start your day?",
                "Rise and shine, {name}! Let's make today productive!",
                "Good morning, {name}! Hope you had a great breakfast!"
            ],
            'afternoon': [
                "Good afternoon, {name}! Hope your day is going well!",
                "Hello, {name}! Ready for your afternoon classes?",
                "Good afternoon, {name}! Keep up the great work!"
            ],
            'evening': [
                "Good evening, {name}! Hope you had a productive day!",
                "Evening, {name}! Time to wrap up your studies!",
                "Hello, {name}! How was your day?"
            ]
        }
    
    def get_time_of_day(self):
        """Determine time of day"""
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return 'morning'
        elif 12 <= hour < 17:
            return 'afternoon'
        else:
            return 'evening'
    
    def generate_greeting(self, student_name, next_class=None, pending_homework=None, upcoming_quizzes=None):
        """Generate personalized greeting text"""
        time_of_day = self.get_time_of_day()
        
        # Base greeting
        import random
        base_greeting = random.choice(self.greeting_templates[time_of_day]).format(name=student_name)
        
        # Build message parts
        message_parts = [base_greeting]
        
        # Add next class info
        if next_class:
            class_msg = f"Your next class is {next_class['subject_name']} at {next_class['start_time']}"
            if next_class.get('room_number'):
                class_msg += f" in {next_class['room_number']}"
            message_parts.append(class_msg)
        else:
            message_parts.append("You have no more classes scheduled for today.")
        
        # Add homework info
        if pending_homework and len(pending_homework) > 0:
            hw_count = len(pending_homework)
            if hw_count == 1:
                hw = pending_homework[0]
                message_parts.append(f"You have 1 pending homework: {hw['title']} for {hw['subject_name']}, due on {hw['due_date']}")
            else:
                message_parts.append(f"You have {hw_count} pending homework assignments. Don't forget to complete them!")
        else:
            message_parts.append("Great news! You have no pending homework.")
        
        # Add quiz info
        if upcoming_quizzes and len(upcoming_quizzes) > 0:
            quiz_count = len(upcoming_quizzes)
            if quiz_count == 1:
                quiz = upcoming_quizzes[0]
                message_parts.append(f"Upcoming quiz: {quiz['title']} for {quiz['subject_name']} on {quiz['quiz_date']}")
            else:
                message_parts.append(f"You have {quiz_count} upcoming quizzes. Start preparing early!")
        else:
            message_parts.append("No upcoming quizzes. Enjoy the break!")
        
        # Add motivational closing
        closings = [
            "Have a wonderful day ahead!",
            "Keep learning and growing!",
            "You're doing great, keep it up!",
            "Believe in yourself and all that you are!"
        ]
        message_parts.append(random.choice(closings))
        
        full_message = " ".join(message_parts)
        
        return {
            'greeting': base_greeting,
            'full_message': full_message,
            'time_of_day': time_of_day,
            'next_class': next_class,
            'pending_homework_count': len(pending_homework) if pending_homework else 0,
            'upcoming_quizzes_count': len(upcoming_quizzes) if upcoming_quizzes else 0
        }

# Global instance
nlp_greeting = NLPGreeting()
