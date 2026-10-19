/**
 * SmartAttend - Student Dashboard JavaScript
 * Dashboard functionality, AI assistant with voice, and data management
 */

// Global state
let dashboardData = null;
let currentSection = 'overview';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    setupEventListeners();
    updateCurrentDate();
    setupNavigation();
});

// Update current date
function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = new Date().toLocaleDateString('en-US', options);
}

// Load dashboard data from API
async function loadDashboardData() {
    try {
        const response = await fetch('/api/student/data');
        dashboardData = await response.json();
        
        updateStats();
        updateTodaySchedule();
        updateNextClass();
        updateAttendanceSummary();
        updatePendingHomework();
        updateUpcomingQuizzes();
        updateRecentAttendance();
        updateNotifications();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Update statistics cards
function updateStats() {
    if (!dashboardData) return;
    
    document.getElementById('attendanceRate').textContent = dashboardData.attendance_stats.rate + '%';
    document.getElementById('pendingHomework').textContent = dashboardData.pending_homework.length;
    document.getElementById('upcomingQuizzes').textContent = dashboardData.upcoming_quizzes.length;
    document.getElementById('todayClasses').textContent = dashboardData.today_schedules.length;
    
    // Update attendance chart
    const chartContainer = document.getElementById('attendanceChart');
    if (chartContainer) {
        const rate = dashboardData.attendance_stats.rate;
        chartContainer.innerHTML = `
            <div class="attendance-progress">
                <div class="progress-header">
                    <span>Overall</span>
                    <span>${rate}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${rate}%"></div>
                </div>
            </div>
        `;
    }
}

// Update today's schedule
function updateTodaySchedule() {
    const container = document.getElementById('todayScheduleList');
    if (!dashboardData || !container) return;
    
    const schedules = dashboardData.today_schedules;
    
    if (schedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-xmark"></i>
                <p>No classes scheduled for today</p>
            </div>
        `;
        return;
    }
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    container.innerHTML = schedules.map(schedule => {
        const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
        const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
        const startTimeMinutes = startHour * 60 + startMinute;
        const endTimeMinutes = endHour * 60 + endMinute;
        
        let status = 'upcoming';
        let statusText = 'Upcoming';
        
        if (currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes) {
            status = 'ongoing';
            statusText = 'In Progress';
        } else if (currentTimeMinutes > endTimeMinutes) {
            status = 'completed';
            statusText = 'Completed';
        }
        
        return `
            <div class="schedule-item">
                <div class="schedule-time">
                    <span class="time">${schedule.start_time}</span>
                    <span class="duration">${schedule.end_time}</span>
                </div>
                <div class="schedule-info">
                    <div class="subject">${schedule.subject_name}</div>
                    <div class="room"><i class="fas fa-door-open"></i> ${schedule.room_number || 'TBA'}</div>
                </div>
                <span class="schedule-status ${status}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// Update next class info
function updateNextClass() {
    const container = document.getElementById('nextClassInfo');
    if (!dashboardData || !container) return;
    
    const nextClass = dashboardData.next_class;
    
    if (!nextClass) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mug-hot"></i>
                <p>No more classes today!</p>
                <span>Enjoy your free time</span>
            </div>
        `;
        return;
    }
    
    // Calculate countdown
    const now = new Date();
    const [hours, minutes] = nextClass.start_time.split(':').map(Number);
    const classTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    const diff = classTime - now;
    
    let countdownHtml = '';
    if (diff > 0) {
        const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        countdownHtml = `
            <div class="countdown">
                <div class="countdown-item">
                    <span class="countdown-value">${hoursLeft}</span>
                    <span class="countdown-label">Hours</span>
                </div>
                <div class="countdown-item">
                    <span class="countdown-value">${minutesLeft}</span>
                    <span class="countdown-label">Mins</span>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="next-class-subject">${nextClass.subject_name}</div>
        <div class="next-class-time"><i class="fas fa-clock"></i> ${nextClass.start_time} - ${nextClass.end_time}</div>
        <div class="next-class-room"><i class="fas fa-door-open"></i> ${nextClass.room_number || 'TBA'}</div>
        ${countdownHtml}
    `;
}

// Update attendance summary
function updateAttendanceSummary() {
    const container = document.getElementById('attendanceSummary');
    if (!dashboardData || !container) return;
    
    const stats = dashboardData.attendance_stats;
    const total = stats.total || 1;
    const present = stats.present || 0;
    const late = stats.late || 0;
    const absent = total - present - late;
    
    container.innerHTML = `
        <div class="attendance-stat-row present">
            <span class="label"><i class="fas fa-check"></i> Present</span>
            <span class="value">${present}</span>
        </div>
        <div class="attendance-stat-row late">
            <span class="label"><i class="fas fa-clock"></i> Late</span>
            <span class="value">${late}</span>
        </div>
        <div class="attendance-stat-row absent">
            <span class="label"><i class="fas fa-times"></i> Absent</span>
            <span class="value">${absent > 0 ? absent : 0}</span>
        </div>
        <div class="attendance-progress">
            <div class="progress-header">
                <span>Attendance Rate</span>
                <span>${stats.rate}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${stats.rate}%"></div>
            </div>
        </div>
    `;
}

// Update pending homework
function updatePendingHomework() {
    const container = document.getElementById('pendingHomeworkList');
    if (!dashboardData || !container) return;
    
    const homework = dashboardData.pending_homework;
    
    if (homework.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>No pending homework!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = homework.slice(0, 3).map(hw => {
        const dueDate = new Date(hw.due_date);
        const today = new Date();
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let urgencyClass = '';
        let urgencyIcon = '🟢';
        if (diffDays <= 2) {
            urgencyClass = 'urgent';
            urgencyIcon = '🔴';
        } else if (diffDays <= 5) {
            urgencyClass = 'warning';
            urgencyIcon = '🟡';
        }
        
        return `
            <div class="homework-item">
                <div class="homework-icon">
                    <i class="fas fa-book"></i>
                </div>
                <div class="homework-info">
                    <div class="homework-title">${hw.title}</div>
                    <div class="homework-meta">
                        <span>${hw.subject_name}</span>
                        <span class="homework-due ${urgencyClass}">${urgencyIcon} ${diffDays} days left</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update upcoming quizzes
function updateUpcomingQuizzes() {
    const container = document.getElementById('upcomingQuizzesList');
    if (!dashboardData || !container) return;
    
    const quizzes = dashboardData.upcoming_quizzes;
    
    if (quizzes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-check"></i>
                <p>No upcoming quizzes!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizzes.slice(0, 3).map(quiz => {
        const quizDate = new Date(quiz.quiz_date);
        const today = new Date();
        const diffDays = Math.ceil((quizDate - today) / (1000 * 60 * 60 * 24));
        
        let urgencyIcon = '🟢';
        if (diffDays <= 2) urgencyIcon = '🔴';
        else if (diffDays <= 5) urgencyIcon = '🟡';
        
        return `
            <div class="quiz-item">
                <div class="quiz-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="quiz-info">
                    <div class="quiz-title">${quiz.title}</div>
                    <div class="quiz-meta">
                        <span>${quiz.subject_name}</span>
                        <span>${urgencyIcon} ${diffDays} days</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update recent attendance
function updateRecentAttendance() {
    const container = document.getElementById('recentAttendanceList');
    if (!dashboardData || !container) return;
    
    const attendance = dashboardData.attendance_records.slice(0, 5);
    
    if (attendance.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <p>No attendance records yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = attendance.map(record => {
        const date = new Date(record.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return `
            <div class="attendance-item">
                <span class="attendance-date">${dateStr}</span>
                <span class="attendance-subject">${record.subject_name || 'Unknown'}</span>
                <span class="attendance-status ${record.status}">${record.status}</span>
            </div>
        `;
    }).join('');
}

// Update notifications
function updateNotifications() {
    const badge = document.getElementById('notificationBadge');
    if (!dashboardData || !badge) return;
    
    const unreadCount = dashboardData.reminders.filter(r => !r.is_read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Greeting button
    const greetingBtn = document.getElementById('greetingBtn');
    if (greetingBtn) {
        greetingBtn.addEventListener('click', playGreeting);
    }
    
    // Notification button
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationsPanel = document.getElementById('notificationsPanel');
    
    if (notificationBtn && notificationsPanel) {
        notificationBtn.addEventListener('click', () => {
            notificationsPanel.style.display = 
                notificationsPanel.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Chat functionality
    setupChat();
    
    // Tab buttons
    setupTabs();
}

// Setup navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const dashboardContent = document.querySelector('.dashboard-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            
            // Update active nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Show/hide sections
            if (section === 'overview') {
                dashboardContent.style.display = 'block';
                sections.forEach(s => s.style.display = 'none');
            } else {
                dashboardContent.style.display = 'none';
                sections.forEach(s => {
                    s.style.display = s.id === `${section}-section` ? 'block' : 'none';
                });
                
                // Load section data
                loadSectionData(section);
            }
            
            currentSection = section;
        });
    });
}

// Load section-specific data
async function loadSectionData(section) {
    switch (section) {
        case 'schedule':
            await loadFullSchedule();
            break;
        case 'attendance':
            await loadFullAttendance();
            break;
        case 'homework':
            await loadFullHomework();
            break;
        case 'quizzes':
            await loadFullQuizzes();
            break;
        case 'grades':
            await loadGrades();
            break;
    }
}

// Load full schedule
async function loadFullSchedule() {
    const tableBody = document.getElementById('fullScheduleTable');
    if (!tableBody || !dashboardData) return;
    
    const schedules = dashboardData.all_schedules;
    
    if (schedules.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No schedules found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = schedules.map(s => `
        <tr>
            <td>${s.day_name}</td>
            <td>${s.subject_name}</td>
            <td>${s.start_time} - ${s.end_time}</td>
            <td>${s.room_number || 'TBA'}</td>
        </tr>
    `).join('');
}

// Load full attendance
async function loadFullAttendance() {
    const tableBody = document.getElementById('fullAttendanceTable');
    const statPresent = document.getElementById('statPresent');
    const statLate = document.getElementById('statLate');
    const statAbsent = document.getElementById('statAbsent');
    
    if (!tableBody || !dashboardData) return;
    
    const records = dashboardData.attendance_records;
    const stats = dashboardData.attendance_stats;
    
    // Update stats
    if (statPresent) statPresent.textContent = stats.present;
    if (statLate) statLate.textContent = stats.late;
    if (statAbsent) {
        const absent = stats.total - stats.present - stats.late;
        statAbsent.textContent = absent > 0 ? absent : 0;
    }
    
    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No attendance records found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = records.map(r => {
        const date = new Date(r.date);
        const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${r.subject_name || 'Unknown'}</td>
                <td><span class="attendance-status ${r.status}">${r.status}</span></td>
                <td>${r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '-'}</td>
            </tr>
        `;
    }).join('');
}

// Load full homework
async function loadFullHomework() {
    const container = document.getElementById('homeworkList');
    if (!container || !dashboardData) return;
    
    // Get active tab
    const activeTab = document.querySelector('.homework-tabs .tab-btn.active');
    const filter = activeTab ? activeTab.dataset.filter : 'pending';
    
    let homework = [];
    if (filter === 'pending') {
        homework = dashboardData.pending_homework;
    } else {
        homework = dashboardData.completed_homework || [];
    }
    
    if (homework.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>No ${filter} homework!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = homework.map(hw => {
        const dueDate = new Date(hw.due_date);
        const today = new Date();
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let urgencyClass = '';
        if (diffDays <= 2) urgencyClass = 'urgent';
        else if (diffDays <= 5) urgencyClass = 'warning';
        
        // Find submission for this homework
        const submission = dashboardData.recent_submissions?.find(s => s.homework_id === hw.id);
        
        return `
            <div class="homework-card">
                <div class="homework-card-header">
                    <div>
                        <div class="homework-card-title">${hw.title}</div>
                        <div class="homework-card-subject">${hw.subject_name}</div>
                    </div>
                    ${submission?.grade ? `<span class="badge-success">Grade: ${submission.grade}</span>` : ''}
                </div>
                <div class="homework-card-desc">${hw.description || 'No description'}</div>
                <div class="homework-card-footer">
                    <span class="homework-due-date ${urgencyClass}">
                        <i class="fas fa-calendar"></i> Due: ${dueDate.toLocaleDateString()}
                    </span>
                    ${filter === 'pending' ? `
                        <button class="btn-primary" onclick="openSubmitModal(${hw.id}, '${hw.title.replace(/'/g, "\\'")}')">
                            Submit
                        </button>
                    ` : ''}
                    ${submission?.grade ? `
                        <button class="btn-secondary" onclick="viewGrade(${hw.id}, 'homework')">
                            View Grade
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Load full quizzes
async function loadFullQuizzes() {
    const container = document.getElementById('quizzesList');
    if (!container || !dashboardData) return;
    
    // Get active tab
    const activeTab = document.querySelector('.quizzes-tabs .tab-btn.active');
    const filter = activeTab ? activeTab.dataset.filter : 'upcoming';
    
    let quizzes = [];
    if (filter === 'upcoming') {
        quizzes = dashboardData.upcoming_quizzes;
    } else {
        quizzes = dashboardData.completed_quizzes || [];
    }
    
    if (quizzes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-check"></i>
                <p>No ${filter} quizzes!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizzes.map(quiz => {
        const quizDate = new Date(quiz.quiz_date);
        
        // Find grade for this quiz
        const quizGrade = dashboardData.quiz_grades?.find(g => g.quiz_id === quiz.id);
        
        return `
            <div class="quiz-card">
                <div class="quiz-card-header">
                    <div>
                        <div class="quiz-card-title">${quiz.title}</div>
                        <div class="quiz-card-subject">${quiz.subject_name}</div>
                    </div>
                    ${quizGrade?.is_graded ? `<span class="badge-success">${quizGrade.marks_obtained}/${quizGrade.max_marks}</span>` : ''}
                </div>
                <div class="quiz-card-meta">
                    <span class="quiz-meta-item">
                        <i class="fas fa-calendar"></i> ${quizDate.toLocaleDateString()}
                    </span>
                    <span class="quiz-meta-item">
                        <i class="fas fa-clock"></i> ${quiz.duration_minutes} mins
                    </span>
                    <span class="quiz-meta-item">
                        <i class="fas fa-question-circle"></i> ${quiz.question_count || 0} questions
                    </span>
                </div>
                <div class="quiz-actions">
                    ${filter === 'upcoming' ? `
                        <button class="btn-primary" onclick="openQuizModal(${quiz.id})">
                            Take Quiz
                        </button>
                    ` : ''}
                    ${quizGrade?.is_graded ? `
                        <button class="btn-secondary" onclick="viewGrade(${quiz.id}, 'quiz')">
                            View Grade
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Load grades
async function loadGrades() {
    const container = document.getElementById('gradesList');
    if (!container || !dashboardData) return;
    
    // Get active tab
    const activeTab = document.querySelector('.grades-tabs .tab-btn.active');
    const filter = activeTab ? activeTab.dataset.filter : 'all';
    
    let grades = [];
    
    // Homework grades
    if (filter === 'all' || filter === 'homework') {
        const homeworkGrades = dashboardData.recent_submissions
            ?.filter(s => s.is_graded)
            ?.map(s => {
                const hw = dashboardData.pending_homework.find(h => h.id === s.homework_id) || 
                          dashboardData.completed_homework?.find(h => h.id === s.homework_id);
                return {
                    type: 'homework',
                    title: hw?.title || 'Unknown Homework',
                    subject: hw?.subject_name || 'Unknown',
                    grade: s.grade,
                    feedback: s.feedback,
                    date: s.submitted_at
                };
            }) || [];
        grades = [...grades, ...homeworkGrades];
    }
    
    // Quiz grades
    if (filter === 'all' || filter === 'quiz') {
        const quizGrades = dashboardData.quiz_grades
            ?.filter(g => g.is_graded)
            ?.map(g => ({
                type: 'quiz',
                title: g.quiz_title,
                subject: g.subject_name,
                grade: `${g.marks_obtained}/${g.max_marks}`,
                date: null
            })) || [];
        grades = [...grades, ...quizGrades];
    }
    
    if (grades.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star"></i>
                <p>No grades available yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = grades.map(g => `
        <div class="grade-card">
            <div class="grade-header">
                <span class="grade-type ${g.type}">${g.type}</span>
                <span class="grade-value">${g.grade}</span>
            </div>
            <div class="grade-title">${g.title}</div>
            <div class="grade-subject">${g.subject}</div>
            ${g.feedback ? `<div class="grade-feedback"><i class="fas fa-comment"></i> ${g.feedback}</div>` : ''}
            ${g.date ? `<div class="grade-date">${new Date(g.date).toLocaleDateString()}</div>` : ''}
        </div>
    `).join('');
}

// View grade
function viewGrade(id, type) {
    const container = document.getElementById('gradeDetails');
    
    if (type === 'homework') {
        const submission = dashboardData.recent_submissions?.find(s => s.homework_id === id);
        const hw = dashboardData.pending_homework.find(h => h.id === id) || 
                   dashboardData.completed_homework?.find(h => h.id === id);
        
        container.innerHTML = `
            <div class="grade-info">
                <h4>${hw?.title || 'Homework'}</h4>
                <p class="subject">${hw?.subject_name || ''}</p>
                <div class="grade-display-large">
                    <span class="grade-label">Your Grade</span>
                    <span class="grade-value-large">${submission?.grade || 'N/A'}</span>
                </div>
                ${submission?.feedback ? `
                    <div class="feedback-box">
                        <h5>Teacher's Feedback</h5>
                        <p>${submission.feedback}</p>
                    </div>
                ` : ''}
            </div>
        `;
    } else {
        const grade = dashboardData.quiz_grades?.find(g => g.quiz_id === id);
        const quiz = dashboardData.upcoming_quizzes.find(q => q.id === id) || 
                     dashboardData.completed_quizzes?.find(q => q.id === id);
        
        container.innerHTML = `
            <div class="grade-info">
                <h4>${grade?.quiz_title || quiz?.title || 'Quiz'}</h4>
                <p class="subject">${grade?.subject_name || quiz?.subject_name || ''}</p>
                <div class="grade-display-large">
                    <span class="grade-label">Your Score</span>
                    <span class="grade-value-large">${grade?.marks_obtained || 0}/${grade?.max_marks || 0}</span>
                </div>
            </div>
        `;
    }
    
    openModal('viewGradeModal');
}

// Setup chat functionality with VOICE
function setupChat() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatMessages = document.getElementById('chatMessages');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');
    
    if (!chatInput || !sendBtn || !chatMessages) return;
    
    // Send message
    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message
        addChatMessage('user', message);
        chatInput.value = '';
        
        // Show typing indicator
        const typingId = addTypingIndicator();
        
        try {
            const response = await fetch('/api/student/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            // Remove typing indicator
            removeTypingIndicator(typingId);
            
            // Add AI response
            if (data.success) {
                addChatMessage('ai', data.response);
                
                // SPEAK the response (VOICE FEATURE)
                speakText(data.response);
            } else {
                addChatMessage('ai', 'Sorry, I encountered an error. Please try again.');
            }
        } catch (error) {
            removeTypingIndicator(typingId);
            addChatMessage('ai', 'Sorry, I\'m having trouble connecting. Please try again later.');
        }
    };
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Suggestion chips
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.dataset.question;
            sendMessage();
        });
    });
}

// Text-to-Speech function (VOICE FEATURE)
function speakText(text) {
    if (!window.speechSynthesis) {
        console.warn('Speech synthesis not supported');
        return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean text for speech (remove markdown, emojis)
    const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/📅|📊|📚|📝|📈|✅|⏰|❌|🔴|🟡|🟢|🌟|👍|⚠️|🎉|•/g, '')
        .replace(/\n/g, ' ');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
                          voices.find(v => v.lang.includes('en-US')) ||
                          voices.find(v => v.lang.includes('en'));
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// Add chat message
function addChatMessage(sender, text) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    const avatar = sender === 'ai' 
        ? '<div class="message-avatar"><i class="fas fa-robot"></i></div>'
        : '<div class="message-avatar"><i class="fas fa-user"></i></div>';
    
    // Convert newlines to <br> and simple markdown
    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/•/g, '&bull;');
    
    messageDiv.innerHTML = `
        ${avatar}
        <div class="message-content">
            <p>${formattedText}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add typing indicator
function addTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const id = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = id;
    typingDiv.className = 'chat-message ai-message';
    typingDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-robot"></i></div>
        <div class="message-content">
            <p><i class="fas fa-ellipsis-h fa-pulse"></i> Thinking...</p>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return id;
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const typingDiv = document.getElementById(id);
    if (typingDiv) typingDiv.remove();
}

// Setup tabs
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const parent = tab.closest('.schedule-tabs, .homework-tabs, .quizzes-tabs, .grades-tabs');
            parent.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Reload content based on tab
            if (parent.classList.contains('homework-tabs')) {
                loadFullHomework();
            } else if (parent.classList.contains('quizzes-tabs')) {
                loadFullQuizzes();
            } else if (parent.classList.contains('grades-tabs')) {
                loadGrades();
            }
        });
    });
}

// Play greeting with VOICE
async function playGreeting() {
    try {
        const response = await fetch('/api/student/greeting');
        const data = await response.json();
        
        if (data.full_message && 'speechSynthesis' in window) {
            // Clean text for speech
            const cleanText = data.full_message
                .replace(/\*\*/g, '')
                .replace(/📅|📊|📚|📝|📈|✅|⏰|❌|🔴|🟡|🟢|🌟|👍|⚠️|🎉|•/g, '')
                .replace(/\n/g, ' ');
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1;
            utterance.pitch = 1;
            
            // Try to find a good voice
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
                                  voices.find(v => v.lang.includes('en-US')) ||
                                  voices.find(v => v.lang.includes('en'));
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    } catch (error) {
        console.error('Error playing greeting:', error);
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function openSubmitModal(hwId, title) {
    document.getElementById('submitHwId').value = hwId;
    document.getElementById('submitHwTitle').textContent = title;
    openModal('submitHomeworkModal');
}

function openQuizModal(quizId) {
    // Load quiz questions
    loadQuizQuestions(quizId);
    openModal('takeQuizModal');
}

// Load quiz questions
async function loadQuizQuestions(quizId) {
    try {
        const response = await fetch(`/api/student/quiz/${quizId}/questions`);
        const data = await response.json();
        
        document.getElementById('quizModalTitle').textContent = data.quiz.title;
        
        const container = document.getElementById('quizQuestions');
        container.innerHTML = data.questions.map((q, i) => `
            <div class="quiz-question-item" data-question-id="${q.id}">
                <div class="question-header">
                    <span class="question-number">Question ${i + 1}</span>
                    <span class="question-marks">${q.marks} marks</span>
                </div>
                <div class="question-text">${q.question_text}</div>
                ${q.question_type === 'mcq' && q.options ? `
                    <div class="question-options">
                        ${q.options.map((opt, j) => `
                            <label class="option-label">
                                <input type="radio" name="q_${q.id}" value="${opt}">
                                <span>${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                ` : `
                    <div class="form-group">
                        <textarea class="answer-text" rows="3" placeholder="Type your answer here..."></textarea>
                    </div>
                `}
            </div>
        `).join('');
        
        // Store quiz ID for submission
        container.dataset.quizId = quizId;
        
    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Failed to load quiz');
    }
}

// Submit quiz
async function submitQuiz() {
    const container = document.getElementById('quizQuestions');
    const quizId = container.dataset.quizId;
    
    const answers = {};
    container.querySelectorAll('.quiz-question-item').forEach(item => {
        const questionId = item.dataset.questionId;
        const selectedOption = item.querySelector('input[type="radio"]:checked');
        const textAnswer = item.querySelector('.answer-text');
        
        if (selectedOption) {
            answers[questionId] = selectedOption.value;
        } else if (textAnswer) {
            answers[questionId] = textAnswer.value;
        }
    });
    
    try {
        const response = await fetch(`/api/student/quiz/${quizId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('takeQuizModal');
            alert('Quiz submitted successfully!');
            // Refresh data
            loadDashboardData();
        } else {
            alert(data.message || 'Failed to submit quiz');
        }
    } catch (error) {
        alert('Error submitting quiz. Please try again.');
    }
}

// Show section helper
function showSection(section) {
    const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (navItem) navItem.click();
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    });
});

// Submit homework
document.getElementById('confirmSubmitHomework')?.addEventListener('click', async () => {
    const hwId = document.getElementById('submitHwId').value;
    const text = document.getElementById('submissionText').value;
    const fileInput = document.getElementById('submissionFile');
    
    const formData = new FormData();
    formData.append('submission_text', text);
    if (fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
    }
    
    try {
        const response = await fetch(`/api/student/homework/${hwId}/submit`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('submitHomeworkModal');
            alert('Homework submitted successfully!');
            // Refresh data
            loadDashboardData();
        } else {
            alert(data.message || 'Failed to submit homework');
        }
    } catch (error) {
        alert('Error submitting homework. Please try again.');
    }
});

// Submit quiz button
document.getElementById('confirmSubmitQuiz')?.addEventListener('click', submitQuiz);

// Load voices for speech synthesis
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        // Voices loaded
    };
}
