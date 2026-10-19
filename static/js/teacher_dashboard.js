/**
 * SmartAttend - Teacher Dashboard JavaScript
 * Teacher dashboard functionality, student management, and analytics
 */

// Global state
let dashboardData = null;
let currentSection = 'overview';
let attendanceChart = null;
let studentWiseChart = null;
let restrictionSettings = {
    network_restriction_enabled: false,
    location_restriction_enabled: false,
    allowed_ip_ranges: [],
    allowed_wifi_networks: [],
    allowed_latitude: null,
    allowed_longitude: null,
    allowed_radius_meters: 100
};
let currentQuizQuestions = [];
let editingScheduleId = null;
let editingHomeworkId = null;
let editingQuizId = null;
let currentFaceRegisterStudentId = null;

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
        const response = await fetch('/api/teacher/data');
        dashboardData = await response.json();
        
        // Load restriction settings
        if (dashboardData.restriction_settings) {
            restrictionSettings = dashboardData.restriction_settings;
        }
        
        updateStats();
        updateTodayAttendance();
        updateSchedulesList();
        updateStudentsList();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Update statistics cards
function updateStats() {
    if (!dashboardData) return;
    
    document.getElementById('totalStudents').textContent = dashboardData.stats.total_students;
    document.getElementById('totalSchedules').textContent = dashboardData.stats.total_schedules;
    document.getElementById('todayAttendance').textContent = dashboardData.stats.today_attendance_count;
    document.getElementById('activeHomework').textContent = dashboardData.stats.total_homework;
}

// Update today's attendance
function updateTodayAttendance() {
    const container = document.getElementById('todayAttendanceList');
    if (!dashboardData || !container) return;
    
    const attendance = dashboardData.today_attendance;
    
    if (attendance.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <p>No attendance recorded today</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = attendance.slice(0, 5).map(record => `
        <div class="attendance-item">
            <span class="attendance-subject">${record.student_name || 'Unknown'}</span>
            <span class="attendance-subject">${record.subject_name || 'Unknown'}</span>
            <span class="attendance-status ${record.status}">${record.status}</span>
        </div>
    `).join('');
}

// Update schedules list
function updateSchedulesList() {
    const container = document.getElementById('schedulesList');
    if (!dashboardData || !container) return;
    
    const schedules = dashboardData.schedules;
    
    if (schedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-xmark"></i>
                <p>No schedules found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = schedules.slice(0, 5).map(s => `
        <div class="schedule-item">
            <div class="schedule-time">
                <span class="time">${s.start_time}</span>
                <span class="duration">${s.day_name}</span>
            </div>
            <div class="schedule-info">
                <div class="subject">${s.subject_name}</div>
                <div class="room">${s.room_number || 'TBA'}</div>
            </div>
        </div>
    `).join('');
}

// Update students list
function updateStudentsList() {
    const container = document.getElementById('studentsList');
    if (!dashboardData || !container) return;
    
    const students = dashboardData.students;
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <p>No students found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = students.slice(0, 5).map(s => `
        <div class="student-item">
            <div class="student-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="student-info">
                <div class="student-name">${s.name}</div>
                <div class="student-email">${s.email}</div>
            </div>
        </div>
    `).join('');
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
    
    // Notification button
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationsPanel = document.getElementById('notificationsPanel');
    
    if (notificationBtn && notificationsPanel) {
        notificationBtn.addEventListener('click', () => {
            notificationsPanel.style.display = 
                notificationsPanel.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Add student
    document.getElementById('confirmAddStudent')?.addEventListener('click', addStudent);
    
    // Add schedule
    document.getElementById('confirmAddSchedule')?.addEventListener('click', addSchedule);
    
    // Add homework
    document.getElementById('confirmAddHomework')?.addEventListener('click', addHomework);
    
    // Add quiz
    document.getElementById('confirmAddQuiz')?.addEventListener('click', addQuiz);
    
    // Download report
    document.getElementById('confirmDownloadReport')?.addEventListener('click', downloadReport);
    
    // Restriction toggles
    setupRestrictionToggles();
    
    // Grade submission
    document.getElementById('confirmGradeSubmission')?.addEventListener('click', gradeSubmission);
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
        case 'students':
            await loadStudentsTable();
            break;
        case 'attendance':
            await loadAttendanceData();
            break;
        case 'schedules':
            await loadSchedulesTable();
            break;
        case 'homework':
            await loadHomeworkTable();
            break;
        case 'quizzes':
            await loadQuizzesTable();
            break;
        case 'restrictions':
            await loadRestrictionSettings();
            break;
    }
}

// Load students table
async function loadStudentsTable() {
    const tableBody = document.getElementById('studentsTable');
    if (!tableBody || !dashboardData) return;
    
    const students = dashboardData.students;
    
    if (students.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No students found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = students.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>${s.email}</td>
            <td>${s.face_encoding_path ? '<span class="badge-success">Yes</span>' : '<span class="badge-warning">No</span>'}</td>
            <td>-</td>
            <td>
                <button class="btn-icon" onclick="registerFace(${s.id})" title="Register Face">
                    <i class="fas fa-camera"></i>
                </button>
                <button class="btn-icon" onclick="viewStudentAttendance(${s.id})" title="View Attendance">
                    <i class="fas fa-clipboard-check"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteStudent(${s.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load attendance data
async function loadAttendanceData() {
    await loadAttendanceTable();
    await loadAttendanceAnalytics();
    await loadFilterOptions();
}

// Load attendance table
async function loadAttendanceTable() {
    const tableBody = document.getElementById('attendanceTable');
    if (!tableBody || !dashboardData) return;
    
    try {
        const response = await fetch('/api/teacher/attendance');
        const data = await response.json();
        
        const attendance = data.attendance;
        
        if (attendance.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No attendance records found</td></tr>';
            return;
        }
        
        tableBody.innerHTML = attendance.slice(0, 50).map(a => {
            const date = new Date(a.date);
            const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${a.student_name || 'Unknown'}</td>
                    <td>${a.subject_name || 'Unknown'}</td>
                    <td><span class="attendance-status ${a.status}">${a.status}</span></td>
                    <td>${a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : '-'}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

// Load attendance analytics
async function loadAttendanceAnalytics() {
    try {
        const response = await fetch('/api/teacher/attendance/analytics');
        const data = await response.json();
        
        // Daily stats chart
        const dailyCtx = document.getElementById('attendanceTrendChart');
        if (dailyCtx) {
            if (attendanceChart) attendanceChart.destroy();
            
            attendanceChart = new Chart(dailyCtx, {
                type: 'line',
                data: {
                    labels: data.daily_stats.map(s => new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                    datasets: [{
                        label: 'Present',
                        data: data.daily_stats.map(s => s.present),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true
                    }, {
                        label: 'Late',
                        data: data.daily_stats.map(s => s.late),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#94a3b8' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        y: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        }
                    }
                }
            });
        }
        
        // Student-wise chart
        const studentCtx = document.getElementById('studentWiseChart');
        if (studentCtx) {
            if (studentWiseChart) studentWiseChart.destroy();
            
            const topStudents = data.student_stats.slice(0, 10);
            
            studentWiseChart = new Chart(studentCtx, {
                type: 'bar',
                data: {
                    labels: topStudents.map(s => s.student_name.split(' ')[0]),
                    datasets: [{
                        label: 'Attendance Rate (%)',
                        data: topStudents.map(s => s.rate),
                        backgroundColor: '#6366f1'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#94a3b8' }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        y: {
                            ticks: { color: '#94a3b8' },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            max: 100
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Load filter options
async function loadFilterOptions() {
    const studentFilter = document.getElementById('attendanceStudentFilter');
    const classFilter = document.getElementById('attendanceClassFilter');
    const reportStudent = document.getElementById('reportStudent');
    
    if (studentFilter && dashboardData) {
        const students = dashboardData.students;
        studentFilter.innerHTML = '<option value="">All Students</option>' + 
            students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    
    if (reportStudent && dashboardData) {
        const students = dashboardData.students;
        reportStudent.innerHTML = '<option value="">All Students</option>' + 
            students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    
    if (classFilter && dashboardData) {
        const schedules = dashboardData.schedules;
        const subjects = [...new Set(schedules.map(s => s.subject_name))];
        classFilter.innerHTML = '<option value="">All Classes</option>' + 
            subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    }
}

// Load schedules table
async function loadSchedulesTable() {
    const tableBody = document.getElementById('schedulesTable');
    if (!tableBody || !dashboardData) return;
    
    const schedules = dashboardData.schedules;
    
    if (schedules.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No schedules found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = schedules.map(s => `
        <tr>
            <td>${s.subject_name}</td>
            <td>${s.day_name}</td>
            <td>${s.start_time} - ${s.end_time}</td>
            <td>${s.room_number || 'TBA'}</td>
            <td>
                <button class="btn-icon" onclick="editSchedule(${s.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteSchedule(${s.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load homework table
async function loadHomeworkTable() {
    const tableBody = document.getElementById('homeworkTable');
    if (!tableBody || !dashboardData) return;
    
    const homework = dashboardData.homework;
    
    if (homework.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No homework found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = homework.map(h => {
        const dueDate = new Date(h.due_date);
        return `
            <tr>
                <td>${h.title}</td>
                <td>${h.subject_name}</td>
                <td>${dueDate.toLocaleDateString()}</td>
                <td>${h.submission_count || 0}</td>
                <td>
                    <button class="btn-icon" onclick="viewSubmissions(${h.id})" title="View Submissions">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="editHomework(${h.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="deleteHomework(${h.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load quizzes table
async function loadQuizzesTable() {
    const tableBody = document.getElementById('quizzesTable');
    if (!tableBody || !dashboardData) return;
    
    const quizzes = dashboardData.quizzes;
    
    if (quizzes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No quizzes found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = quizzes.map(q => {
        const quizDate = new Date(q.quiz_date);
        return `
            <tr>
                <td>${q.title}</td>
                <td>${q.subject_name}</td>
                <td>${quizDate.toLocaleDateString()}</td>
                <td>${q.duration_minutes} min</td>
                <td>${q.question_count || 0}</td>
                <td>
                    <button class="btn-icon" onclick="manageQuizQuestions(${q.id})" title="Manage Questions">
                        <i class="fas fa-question-circle"></i>
                    </button>
                    <button class="btn-icon" onclick="editQuiz(${q.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="deleteQuiz(${q.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load restriction settings
async function loadRestrictionSettings() {
    // Update toggle switches
    document.getElementById('networkRestrictionToggle').checked = restrictionSettings.network_restriction_enabled;
    document.getElementById('locationRestrictionToggle').checked = restrictionSettings.location_restriction_enabled;
    
    // Show/hide settings
    document.getElementById('networkSettings').style.display = 
        restrictionSettings.network_restriction_enabled ? 'block' : 'none';
    document.getElementById('locationSettings').style.display = 
        restrictionSettings.location_restriction_enabled ? 'block' : 'none';
    
    // Update IP ranges
    updateIpRangesList();
    
    // Update WiFi networks
    updateWifiNetworksList();
    
    // Update location fields
    if (restrictionSettings.allowed_latitude) {
        document.getElementById('allowedLatitude').value = restrictionSettings.allowed_latitude;
    }
    if (restrictionSettings.allowed_longitude) {
        document.getElementById('allowedLongitude').value = restrictionSettings.allowed_longitude;
    }
    document.getElementById('allowedRadius').value = restrictionSettings.allowed_radius_meters;
}

// Setup restriction toggles
function setupRestrictionToggles() {
    const networkToggle = document.getElementById('networkRestrictionToggle');
    const locationToggle = document.getElementById('locationRestrictionToggle');
    
    if (networkToggle) {
        networkToggle.addEventListener('change', () => {
            restrictionSettings.network_restriction_enabled = networkToggle.checked;
            document.getElementById('networkSettings').style.display = 
                networkToggle.checked ? 'block' : 'none';
        });
    }
    
    if (locationToggle) {
        locationToggle.addEventListener('change', () => {
            restrictionSettings.location_restriction_enabled = locationToggle.checked;
            document.getElementById('locationSettings').style.display = 
                locationToggle.checked ? 'block' : 'none';
        });
    }
}

// Add IP range
function addIpRange() {
    const input = document.getElementById('ipRangeInput');
    const range = input.value.trim();
    
    if (range && !restrictionSettings.allowed_ip_ranges.includes(range)) {
        restrictionSettings.allowed_ip_ranges.push(range);
        updateIpRangesList();
        input.value = '';
    }
}

// Update IP ranges list
function updateIpRangesList() {
    const container = document.getElementById('ipRangesList');
    if (!container) return;
    
    container.innerHTML = restrictionSettings.allowed_ip_ranges.map((range, index) => `
        <span class="tag">
            ${range}
            <button onclick="removeIpRange(${index})"><i class="fas fa-times"></i></button>
        </span>
    `).join('');
}

// Remove IP range
function removeIpRange(index) {
    restrictionSettings.allowed_ip_ranges.splice(index, 1);
    updateIpRangesList();
}

// Add WiFi network
function addWifiNetwork() {
    const input = document.getElementById('wifiInput');
    const network = input.value.trim();
    
    if (network && !restrictionSettings.allowed_wifi_networks.includes(network)) {
        restrictionSettings.allowed_wifi_networks.push(network);
        updateWifiNetworksList();
        input.value = '';
    }
}

// Update WiFi networks list
function updateWifiNetworksList() {
    const container = document.getElementById('wifiNetworksList');
    if (!container) return;
    
    container.innerHTML = restrictionSettings.allowed_wifi_networks.map((network, index) => `
        <span class="tag">
            ${network}
            <button onclick="removeWifiNetwork(${index})"><i class="fas fa-times"></i></button>
        </span>
    `).join('');
}

// Remove WiFi network
function removeWifiNetwork(index) {
    restrictionSettings.allowed_wifi_networks.splice(index, 1);
    updateWifiNetworksList();
}

// Get current location
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('allowedLatitude').value = position.coords.latitude;
                document.getElementById('allowedLongitude').value = position.coords.longitude;
                restrictionSettings.allowed_latitude = position.coords.latitude;
                restrictionSettings.allowed_longitude = position.coords.longitude;
            },
            (error) => {
                alert('Could not get location: ' + error.message);
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
}

// Save restriction settings
async function saveRestrictionSettings() {
    restrictionSettings.allowed_latitude = parseFloat(document.getElementById('allowedLatitude').value) || null;
    restrictionSettings.allowed_longitude = parseFloat(document.getElementById('allowedLongitude').value) || null;
    restrictionSettings.allowed_radius_meters = parseInt(document.getElementById('allowedRadius').value) || 100;
    
    try {
        const response = await fetch('/api/teacher/restrictions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restrictionSettings)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Restriction settings saved successfully!');
        } else {
            alert('Failed to save settings: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        alert('Error saving settings. Please try again.');
    }
}

// Add student
async function addStudent() {
    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('studentEmail').value.trim();
    
    if (!name || !email) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/teacher/student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('addStudentModal');
            document.getElementById('addStudentForm').reset();
            alert('Student added successfully! Now register their face.');
            registerFace(data.student.id);
            // Update data immediately
            dashboardData.students.push(data.student);
            dashboardData.stats.total_students++;
            updateStats();
            updateStudentsList();
            loadStudentsTable();
        } else {
            alert(data.message || 'Failed to add student');
        }
    } catch (error) {
        alert('Error adding student. Please try again.');
    }
}

// Register face
async function registerFace(studentId) {
    currentFaceRegisterStudentId = studentId;
    openModal('faceRegisterModal');
    
    const video = document.getElementById('faceRegisterVideo');
    const canvas = document.getElementById('faceRegisterCanvas');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        
        document.getElementById('captureFaceBtn').onclick = async () => {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            const imageData = canvas.toDataURL('image/jpeg', 0.9);
            
            try {
                const response = await fetch(`/api/teacher/student/${studentId}/register-face`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageData })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    stream.getTracks().forEach(track => track.stop());
                    closeModal('faceRegisterModal');
                    alert('Face registered successfully!');
                    // Update student data
                    const student = dashboardData.students.find(s => s.id === studentId);
                    if (student) student.face_encoding_path = data.file_path;
                    updateStudentsList();
                    loadStudentsTable();
                } else {
                    alert(data.message || 'Failed to register face');
                }
            } catch (error) {
                alert('Error registering face. Please try again.');
            }
        };
        
        document.querySelector('#faceRegisterModal .modal-close').onclick = () => {
            stream.getTracks().forEach(track => track.stop());
            closeModal('faceRegisterModal');
        };
        
    } catch (err) {
        alert('Could not access webcam. Please ensure you have granted camera permissions.');
    }
}

// Delete student
async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    
    try {
        const response = await fetch(`/api/teacher/student/${studentId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Student deleted successfully!');
            // Update data immediately
            dashboardData.students = dashboardData.students.filter(s => s.id !== studentId);
            dashboardData.stats.total_students--;
            updateStats();
            updateStudentsList();
            loadStudentsTable();
        } else {
            alert(data.message || 'Failed to delete student');
        }
    } catch (error) {
        alert('Error deleting student. Please try again.');
    }
}

// View student attendance
async function viewStudentAttendance(studentId) {
    try {
        const response = await fetch(`/api/teacher/student/${studentId}/attendance`);
        const data = await response.json();
        
        const stats = data.stats;
        alert(`Attendance for ${data.student.name}:\n\n` +
              `Total: ${stats.total}\n` +
              `Present: ${stats.present}\n` +
              `Late: ${stats.late}\n` +
              `Absent: ${stats.absent}\n` +
              `Rate: ${stats.rate}%`);
    } catch (error) {
        alert('Error loading attendance data');
    }
}

// Add schedule
async function addSchedule() {
    const subject = document.getElementById('scheduleSubject').value.trim();
    const day = document.getElementById('scheduleDay').value;
    const startTime = document.getElementById('scheduleStartTime').value;
    const endTime = document.getElementById('scheduleEndTime').value;
    const room = document.getElementById('scheduleRoom').value.trim();
    
    if (!subject || !startTime || !endTime) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('/api/teacher/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject_name: subject,
                day_of_week: parseInt(day),
                start_time: startTime,
                end_time: endTime,
                room_number: room
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('addScheduleModal');
            document.getElementById('addScheduleForm').reset();
            alert('Schedule added successfully!');
            // Update data immediately
            dashboardData.schedules.push(data.schedule);
            dashboardData.stats.total_schedules++;
            updateStats();
            updateSchedulesList();
            loadSchedulesTable();
        } else {
            alert(data.message || 'Failed to add schedule');
        }
    } catch (error) {
        alert('Error adding schedule. Please try again.');
    }
}

// Edit schedule - IMPLEMENTED
async function editSchedule(scheduleId) {
    const schedule = dashboardData.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    editingScheduleId = scheduleId;
    
    // Populate edit modal
    document.getElementById('editScheduleSubject').value = schedule.subject_name;
    document.getElementById('editScheduleDay').value = schedule.day_of_week;
    document.getElementById('editScheduleStartTime').value = schedule.start_time;
    document.getElementById('editScheduleEndTime').value = schedule.end_time;
    document.getElementById('editScheduleRoom').value = schedule.room_number || '';
    
    openModal('editScheduleModal');
}

// Save schedule edit
async function saveScheduleEdit() {
    const subject = document.getElementById('editScheduleSubject').value.trim();
    const day = document.getElementById('editScheduleDay').value;
    const startTime = document.getElementById('editScheduleStartTime').value;
    const endTime = document.getElementById('editScheduleEndTime').value;
    const room = document.getElementById('editScheduleRoom').value.trim();
    
    if (!subject || !startTime || !endTime) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/schedule/${editingScheduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject_name: subject,
                day_of_week: parseInt(day),
                start_time: startTime,
                end_time: endTime,
                room_number: room
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('editScheduleModal');
            alert('Schedule updated successfully!');
            // Update data immediately
            const index = dashboardData.schedules.findIndex(s => s.id === editingScheduleId);
            if (index !== -1) dashboardData.schedules[index] = data.schedule;
            updateSchedulesList();
            loadSchedulesTable();
        } else {
            alert(data.message || 'Failed to update schedule');
        }
    } catch (error) {
        alert('Error updating schedule. Please try again.');
    }
}

// Delete schedule
async function deleteSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    try {
        const response = await fetch(`/api/teacher/schedule/${scheduleId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Schedule deleted successfully!');
            // Update data immediately
            dashboardData.schedules = dashboardData.schedules.filter(s => s.id !== scheduleId);
            dashboardData.stats.total_schedules--;
            updateStats();
            updateSchedulesList();
            loadSchedulesTable();
        } else {
            alert(data.message || 'Failed to delete schedule');
        }
    } catch (error) {
        alert('Error deleting schedule. Please try again.');
    }
}

// Add homework
async function addHomework() {
    const title = document.getElementById('hwTitle').value.trim();
    const subject = document.getElementById('hwSubject').value.trim();
    const dueDate = document.getElementById('hwDueDate').value;
    const description = document.getElementById('hwDescription').value.trim();
    const allowText = document.getElementById('hwAllowText').checked;
    const allowFile = document.getElementById('hwAllowFile').checked;
    
    if (!title || !subject || !dueDate) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('/api/teacher/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                subject_name: subject,
                due_date: dueDate,
                description,
                allow_text_submission: allowText,
                allow_file_submission: allowFile
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('addHomeworkModal');
            document.getElementById('addHomeworkForm').reset();
            alert('Homework added successfully!');
            // Update data immediately
            dashboardData.homework.push({ ...data.homework, submission_count: 0 });
            dashboardData.stats.total_homework++;
            updateStats();
            loadHomeworkTable();
        } else {
            alert(data.message || 'Failed to add homework');
        }
    } catch (error) {
        alert('Error adding homework. Please try again.');
    }
}

// Edit homework - IMPLEMENTED
async function editHomework(homeworkId) {
    const homework = dashboardData.homework.find(h => h.id === homeworkId);
    if (!homework) return;
    
    editingHomeworkId = homeworkId;
    
    // Populate edit modal
    document.getElementById('editHwTitle').value = homework.title;
    document.getElementById('editHwSubject').value = homework.subject_name;
    document.getElementById('editHwDueDate').value = homework.due_date;
    document.getElementById('editHwDescription').value = homework.description || '';
    document.getElementById('editHwAllowText').checked = homework.allow_text_submission;
    document.getElementById('editHwAllowFile').checked = homework.allow_file_submission;
    
    openModal('editHomeworkModal');
}

// Save homework edit
async function saveHomeworkEdit() {
    const title = document.getElementById('editHwTitle').value.trim();
    const subject = document.getElementById('editHwSubject').value.trim();
    const dueDate = document.getElementById('editHwDueDate').value;
    const description = document.getElementById('editHwDescription').value.trim();
    const allowText = document.getElementById('editHwAllowText').checked;
    const allowFile = document.getElementById('editHwAllowFile').checked;
    
    if (!title || !subject || !dueDate) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/homework/${editingHomeworkId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                subject_name: subject,
                due_date: dueDate,
                description,
                allow_text_submission: allowText,
                allow_file_submission: allowFile
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('editHomeworkModal');
            alert('Homework updated successfully!');
            // Update data immediately
            const index = dashboardData.homework.findIndex(h => h.id === editingHomeworkId);
            if (index !== -1) {
                const submissionCount = dashboardData.homework[index].submission_count;
                dashboardData.homework[index] = { ...data.homework, submission_count };
            }
            loadHomeworkTable();
        } else {
            alert(data.message || 'Failed to update homework');
        }
    } catch (error) {
        alert('Error updating homework. Please try again.');
    }
}

// Delete homework
async function deleteHomework(homeworkId) {
    if (!confirm('Are you sure you want to delete this homework?')) return;
    
    try {
        const response = await fetch(`/api/teacher/homework/${homeworkId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Homework deleted successfully!');
            // Update data immediately
            dashboardData.homework = dashboardData.homework.filter(h => h.id !== homeworkId);
            dashboardData.stats.total_homework--;
            updateStats();
            loadHomeworkTable();
        } else {
            alert(data.message || 'Failed to delete homework');
        }
    } catch (error) {
        alert('Error deleting homework. Please try again.');
    }
}

// View submissions
async function viewSubmissions(homeworkId) {
    try {
        const response = await fetch(`/api/teacher/homework/${homeworkId}/submissions`);
        const data = await response.json();
        
        const container = document.getElementById('submissionsList');
        
        if (data.submissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No submissions yet</p>
                </div>
            `;
        } else {
            container.innerHTML = data.submissions.map(s => `
                <div class="submission-item">
                    <div class="submission-header">
                        <span class="submission-student">${s.student_name || 'Unknown'}</span>
                        <span class="submission-date">${new Date(s.submitted_at).toLocaleString()}</span>
                    </div>
                    <div class="submission-content">
                        ${s.submission_text || 'File submission'}
                    </div>
                    ${s.file_path ? `<a href="${s.file_path}" target="_blank" class="btn-secondary"><i class="fas fa-download"></i> Download</a>` : ''}
                    <div class="submission-actions">
                        ${s.is_graded ? `<span class="badge-success">Grade: ${s.grade}</span>` : ''}
                        <button class="btn-primary" onclick="openGradeModal(${s.id}, '${s.student_name || 'Student'}', '${(s.submission_text || 'File submission').replace(/'/g, "\\'")}', '${s.grade || ''}', '${(s.feedback || '').replace(/'/g, "\\'")}')">
                            ${s.is_graded ? 'Update Grade' : 'Grade'}
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        openModal('viewSubmissionsModal');
    } catch (error) {
        alert('Error loading submissions');
    }
}

// Open grade modal
function openGradeModal(submissionId, studentName, content, grade, feedback) {
    document.getElementById('gradeSubmissionId').value = submissionId;
    document.getElementById('gradeStudentName').textContent = studentName;
    document.getElementById('gradeSubmissionContent').textContent = content;
    document.getElementById('gradeValue').value = grade || '';
    document.getElementById('gradeFeedback').value = feedback || '';
    openModal('gradeSubmissionModal');
}

// Grade submission
async function gradeSubmission() {
    const submissionId = document.getElementById('gradeSubmissionId').value;
    const grade = document.getElementById('gradeValue').value.trim();
    const feedback = document.getElementById('gradeFeedback').value.trim();
    
    if (!grade) {
        alert('Please enter a grade');
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/submission/${submissionId}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grade, feedback })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('gradeSubmissionModal');
            closeModal('viewSubmissionsModal');
            alert('Grade saved successfully!');
        } else {
            alert(data.message || 'Failed to save grade');
        }
    } catch (error) {
        alert('Error saving grade. Please try again.');
    }
}

// Add quiz question to form
function addQuizQuestion() {
    const container = document.getElementById('quizQuestionsContainer');
    const questionIndex = currentQuizQuestions.length;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'quiz-question-form';
    questionDiv.dataset.index = questionIndex;
    questionDiv.innerHTML = `
        <div class="question-header">
            <h4>Question ${questionIndex + 1}</h4>
            <button type="button" class="btn-icon btn-danger" onclick="removeQuizQuestion(${questionIndex})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="form-group">
            <label>Question Text</label>
            <textarea class="question-text" rows="2" placeholder="Enter question..."></textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Type</label>
                <select class="question-type">
                    <option value="mcq">Multiple Choice</option>
                    <option value="descriptive">Descriptive</option>
                </select>
            </div>
            <div class="form-group">
                <label>Marks</label>
                <input type="number" class="question-marks" value="1" min="1">
            </div>
        </div>
        <div class="form-group mcq-options">
            <label>Options (one per line)</label>
            <textarea class="question-options" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"></textarea>
        </div>
        <div class="form-group">
            <label>Correct Answer</label>
            <input type="text" class="question-answer" placeholder="Enter correct answer">
        </div>
    `;
    
    container.appendChild(questionDiv);
    currentQuizQuestions.push({});
}

// Remove quiz question from form
function removeQuizQuestion(index) {
    const container = document.getElementById('quizQuestionsContainer');
    const questions = container.querySelectorAll('.quiz-question-form');
    if (questions[index]) {
        questions[index].remove();
        currentQuizQuestions.splice(index, 1);
        // Re-index remaining questions
        container.querySelectorAll('.quiz-question-form').forEach((q, i) => {
            q.dataset.index = i;
            q.querySelector('h4').textContent = `Question ${i + 1}`;
            q.querySelector('.btn-danger').setAttribute('onclick', `removeQuizQuestion(${i})`);
        });
    }
}

// Add quiz
async function addQuiz() {
    const title = document.getElementById('quizTitle').value.trim();
    const subject = document.getElementById('quizSubject').value.trim();
    const quizDate = document.getElementById('quizDate').value;
    const duration = document.getElementById('quizDuration').value;
    
    if (!title || !subject || !quizDate) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Collect questions
    const questions = [];
    document.querySelectorAll('#quizQuestionsContainer .quiz-question-form').forEach(q => {
        const text = q.querySelector('.question-text').value.trim();
        const type = q.querySelector('.question-type').value;
        const marks = parseInt(q.querySelector('.question-marks').value) || 1;
        const optionsText = q.querySelector('.question-options').value.trim();
        const options = optionsText ? optionsText.split('\n').filter(o => o.trim()) : [];
        const correctAnswer = q.querySelector('.question-answer').value.trim();
        
        if (text) {
            questions.push({
                question_text: text,
                question_type: type,
                marks: marks,
                options: options,
                correct_answer: correctAnswer
            });
        }
    });
    
    try {
        const response = await fetch('/api/teacher/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                subject_name: subject,
                quiz_date: quizDate,
                duration_minutes: parseInt(duration),
                questions
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('addQuizModal');
            document.getElementById('addQuizForm').reset();
            document.getElementById('quizQuestionsContainer').innerHTML = '';
            currentQuizQuestions = [];
            alert('Quiz added successfully!');
            // Update data immediately
            dashboardData.quizzes.push({ ...data.quiz, question_count: questions.length });
            loadQuizzesTable();
        } else {
            alert(data.message || 'Failed to add quiz');
        }
    } catch (error) {
        alert('Error adding quiz. Please try again.');
    }
}

// Manage quiz questions
async function manageQuizQuestions(quizId) {
    editingQuizId = quizId;
    const quiz = dashboardData.quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    
    try {
        const response = await fetch(`/api/teacher/quiz/${quizId}/questions`);
        const data = await response.json();
        
        const container = document.getElementById('manageQuestionsList');
        
        if (data.questions.length === 0) {
            container.innerHTML = '<p class="empty-text">No questions added yet</p>';
        } else {
            container.innerHTML = data.questions.map((q, i) => `
                <div class="existing-question" data-question-id="${q.id}">
                    <div class="question-header">
                        <span class="question-number">Q${i + 1}</span>
                        <button class="btn-icon btn-danger" onclick="deleteQuestion(${q.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="question-text">${q.question_text}</div>
                    <div class="question-meta">Type: ${q.question_type} | Marks: ${q.marks}</div>
                </div>
            `).join('');
        }
        
        openModal('manageQuestionsModal');
    } catch (error) {
        alert('Error loading questions');
    }
}

// Add new question to existing quiz
async function addNewQuestionToQuiz() {
    const text = document.getElementById('newQuestionText').value.trim();
    const type = document.getElementById('newQuestionType').value;
    const marks = parseInt(document.getElementById('newQuestionMarks').value) || 1;
    const optionsText = document.getElementById('newQuestionOptions').value.trim();
    const options = optionsText ? optionsText.split('\n').filter(o => o.trim()) : [];
    const correctAnswer = document.getElementById('newQuestionCorrectAnswer').value.trim();
    
    if (!text) {
        alert('Please enter question text');
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/quiz/${editingQuizId}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_text: text,
                question_type: type,
                marks: marks,
                options: options,
                correct_answer: correctAnswer
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear form
            document.getElementById('newQuestionText').value = '';
            document.getElementById('newQuestionOptions').value = '';
            document.getElementById('newQuestionCorrectAnswer').value = '';
            
            // Refresh questions list
            manageQuizQuestions(editingQuizId);
            
            // Update quiz count
            const quiz = dashboardData.quizzes.find(q => q.id === editingQuizId);
            if (quiz) quiz.question_count = (quiz.question_count || 0) + 1;
            loadQuizzesTable();
            
            alert('Question added successfully!');
        } else {
            alert(data.message || 'Failed to add question');
        }
    } catch (error) {
        alert('Error adding question. Please try again.');
    }
}

// Delete question
async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
        const response = await fetch(`/api/teacher/quiz/${editingQuizId}/questions/${questionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            manageQuizQuestions(editingQuizId);
            const quiz = dashboardData.quizzes.find(q => q.id === editingQuizId);
            if (quiz && quiz.question_count > 0) quiz.question_count--;
            loadQuizzesTable();
            alert('Question deleted successfully!');
        } else {
            alert(data.message || 'Failed to delete question');
        }
    } catch (error) {
        alert('Error deleting question. Please try again.');
    }
}

// Edit quiz - IMPLEMENTED
async function editQuiz(quizId) {
    const quiz = dashboardData.quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    
    editingQuizId = quizId;
    
    // Populate edit modal
    document.getElementById('editQuizTitle').value = quiz.title;
    document.getElementById('editQuizSubject').value = quiz.subject_name;
    document.getElementById('editQuizDate').value = quiz.quiz_date;
    document.getElementById('editQuizDuration').value = quiz.duration_minutes;
    
    openModal('editQuizModal');
}

// Save quiz edit
async function saveQuizEdit() {
    const title = document.getElementById('editQuizTitle').value.trim();
    const subject = document.getElementById('editQuizSubject').value.trim();
    const quizDate = document.getElementById('editQuizDate').value;
    const duration = document.getElementById('editQuizDuration').value;
    
    if (!title || !subject || !quizDate) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`/api/teacher/quiz/${editingQuizId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                subject_name: subject,
                quiz_date: quizDate,
                duration_minutes: parseInt(duration)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('editQuizModal');
            alert('Quiz updated successfully!');
            // Update data immediately
            const index = dashboardData.quizzes.findIndex(q => q.id === editingQuizId);
            if (index !== -1) {
                const questionCount = dashboardData.quizzes[index].question_count;
                dashboardData.quizzes[index] = { ...data.quiz, question_count };
            }
            loadQuizzesTable();
        } else {
            alert(data.message || 'Failed to update quiz');
        }
    } catch (error) {
        alert('Error updating quiz. Please try again.');
    }
}

// Delete quiz
async function deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
        const response = await fetch(`/api/teacher/quiz/${quizId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Quiz deleted successfully!');
            // Update data immediately
            dashboardData.quizzes = dashboardData.quizzes.filter(q => q.id !== quizId);
            loadQuizzesTable();
        } else {
            alert(data.message || 'Failed to delete quiz');
        }
    } catch (error) {
        alert('Error deleting quiz. Please try again.');
    }
}

// Download report
async function downloadReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const studentId = document.getElementById('reportStudent').value;
    const format = document.querySelector('input[name="reportFormat"]:checked').value;
    
    let url = `/api/teacher/attendance/download?format=${format}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    if (studentId) url += `&student_id=${studentId}`;
    
    window.open(url, '_blank');
    closeModal('downloadReportModal');
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

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    });
});
