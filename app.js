// Global variables
let currentUser = null;
let currentUserRole = null;
let selectedTeacherId = null;
let selectedMessageRecipient = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthState();
});

// Initialize the application
function initializeApp() {
    try {
        // Test Firebase connection
        testFirebaseConnection();
        
        // Validate required elements exist
        validateRequiredElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Check authentication state
        checkAuthState();
        
        hideLoadingScreen();
        showHome();

    } catch (error) {
        console.error('Error initializing application:', error);
        showNotification('Error initializing application', 'error');
    }
}

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        if (!window.firebaseServices) {
            throw new Error('Firebase services not initialized');
        }
        
        const { auth, db } = window.firebaseServices;
        
        if (!auth || !db) {
            throw new Error('Firebase auth or database not initialized');
        }
        
        // Test network connectivity
        await retryFirebaseOperation(async () => {
            await db.collection('users').limit(1).get();
        }, 2);
        

        
    } catch (error) {
        console.error('Firebase connection test: FAILED', error);
        handleFirebaseError(error, 'connection test');
    }
}

// Validate required HTML elements exist
function validateRequiredElements() {
    const requiredElements = [
        'loginForm', 'registerForm', 'bookingForm', 'messageForm',
        'addTeacherForm', 'addScheduleForm', 'teacherSearch',
        'studentDashboard', 'teacherDashboard', 'adminDashboard'
    ];
    
    const missingElements = [];
    
    requiredElements.forEach(elementId => {
        if (!document.getElementById(elementId)) {
            missingElements.push(elementId);
        }
    });
    
    if (missingElements.length > 0) {
        console.warn('Missing required elements:', missingElements);
    }
}

// Setup event listeners
function setupEventListeners() {
    try {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        
        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) registerForm.addEventListener('submit', handleRegister);
        
        // Role selection for registration
        const registerRole = document.getElementById('registerRole');
        if (registerRole) registerRole.addEventListener('change', handleRoleChange);
        
        // Booking form
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) bookingForm.addEventListener('submit', handleBooking);
        
        // Message form
        const messageForm = document.getElementById('messageForm');
        if (messageForm) messageForm.addEventListener('submit', handleMessage);
        
        // Add teacher form
        const addTeacherForm = document.getElementById('addTeacherForm');
        if (addTeacherForm) addTeacherForm.addEventListener('submit', handleAddTeacher);
        
        // Add schedule form
        const addScheduleForm = document.getElementById('addScheduleForm');
        if (addScheduleForm) addScheduleForm.addEventListener('submit', handleAddSchedule);
        
        // Teacher search input
        const teacherSearch = document.getElementById('teacherSearch');
        if (teacherSearch) {
            // Search on Enter key
            teacherSearch.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchTeachers();
                }
            });
            
            // Real-time search as user types (with debounce)
            let searchTimeout;
            teacherSearch.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchTeachers();
                }, 300); // Wait 300ms after user stops typing
            });
        }
        

    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Authentication state observer
function checkAuthState() {
    try {
        if (!window.firebaseServices) {
            console.error('Firebase services not initialized');
            showNotification('Firebase services not available. Please check your internet connection.', 'error');
            return;
        }
        
        const { auth } = window.firebaseServices;
        
        if (!auth) {
            console.error('Firebase auth not initialized');
            showNotification('Firebase authentication not available', 'error');
            return;
        }
        
        auth.onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in
                getUserData(user.uid);
            } else {
                // User is signed out
                currentUser = null;
                currentUserRole = null;
                updateNavigation(false);
                showHome();
            }
        }, function(error) {
            console.error('Auth state change error:', error);
            if (error.code === 'auth/network-request-failed') {
                showNotification('Network connection failed. Please check your internet connection and try again.', 'error');
            } else {
                showNotification('Authentication error. Please refresh the page.', 'error');
            }
        });
    } catch (error) {
        console.error('Error in checkAuthState:', error);
        showNotification('Error initializing authentication', 'error');
    }
}

// Get user data from Firestore
async function getUserData(userId) {
    try {
        if (!window.firebaseServices) {
            throw new Error('Firebase services not initialized');
        }
        
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            currentUser = { uid: userId, ...userData };
            currentUserRole = userData.role;
            
            // Check if student is approved
            if (userData.role === 'student' && !userData.approved) {
                showNotification('Your account is pending approval by admin.', 'warning');
                logout();
                return;
            }
            
            updateNavigation(true);
            showDashboard();
            logUserAction('User logged in successfully');
        } else {
            console.error('User document not found');
            logout();
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        showNotification(`Error loading user data: ${error.message}`, 'error');
        logout();
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;
    
    if (!email || !password || !role) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    showLoadingScreen();
    
    try {
        const { auth, db } = window.firebaseServices;
        
        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Verify user role
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.role !== role) {
                await auth.signOut();
                showNotification('Invalid role selected', 'error');
                hideLoadingScreen();
                return;
            }
            
            if (userData.role === 'student' && !userData.approved) {
                await auth.signOut();
                showNotification('Your account is pending approval', 'warning');
                hideLoadingScreen();
                return;
            }
        }
        
        logUserAction(`User logged in with role: ${role}`);
        hideLoadingScreen();
        
    } catch (error) {
        hideLoadingScreen();
        console.error('Login error:', error);
        showNotification(getErrorMessage(error), 'error');
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    const department = document.getElementById('registerDepartment').value;
    const subject = document.getElementById('registerSubject').value;
    
    if (!name || !email || !password || !role) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (role === 'teacher' && (!department || !subject)) {
        showNotification('Please fill in department and subject for teachers', 'error');
        return;
    }
    
    showLoadingScreen();
    
    try {
        const { auth, db } = window.firebaseServices;
        
        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        const userData = {
            name: name,
            email: email,
            role: role,
            approved: role === 'teacher' || role === 'admin' || email.endsWith('@yourinstitution.edu'), // Auto-approve institutional emails
            createdAt: new Date().toISOString()
        };
        
        if (role === 'teacher') {
            userData.department = department;
            userData.subject = subject;
        }
        
        await db.collection('users').doc(user.uid).set(userData);
        
        // Sign out to force login
        await auth.signOut();
        
        logUserAction(`New user registered: ${name} (${role})`);
        showNotification('Registration successful! Please login.', 'success');
        hideLoadingScreen();
        showLogin();
        
    } catch (error) {
        hideLoadingScreen();
        console.error('Registration error:', error);
        showNotification(getErrorMessage(error), 'error');
    }
}

// Handle role change in registration
function handleRoleChange() {
    const role = document.getElementById('registerRole').value;
    const teacherFields = document.getElementById('teacherFields');
    const teacherFields2 = document.getElementById('teacherFields2');
    
    if (role === 'teacher') {
        teacherFields.style.display = 'block';
        teacherFields2.style.display = 'block';
        document.getElementById('registerDepartment').required = true;
        document.getElementById('registerSubject').required = true;
    } else {
        teacherFields.style.display = 'none';
        teacherFields2.style.display = 'none';
        document.getElementById('registerDepartment').required = false;
        document.getElementById('registerSubject').required = false;
    }
}

// Handle booking appointment
async function handleBooking(e) {
    e.preventDefault();
    
    const date = document.getElementById('appointmentDate').value;
    const timeSlot = document.getElementById('appointmentSlot') ? document.getElementById('appointmentSlot').value : document.getElementById('appointmentTime').value;
    const message = document.getElementById('appointmentMessage').value;
    
    if (!date || !timeSlot || !selectedTeacherId) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const { db } = window.firebaseServices;
        
        // Check if this time slot is already booked
        const existingAppointment = await db.collection('appointments')
            .where('teacherId', '==', selectedTeacherId)
            .where('date', '==', date)
            .where('time', '==', timeSlot)
            .where('status', 'in', ['pending', 'approved'])
            .get();
        
        if (!existingAppointment.empty) {
            showNotification('This time slot is already booked. Please choose another time.', 'error');
            return;
        }
        
        // Updated appointment data structure
        const appointmentData = {
            studentId: currentUser.uid,
            studentName: currentUser.name,
            teacherId: selectedTeacherId,
            slotTime: `${date} ${timeSlot}`, // Combined date and time
            date: date,
            time: timeSlot,
            message: message,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        await db.collection('appointments').add(appointmentData);
        
        logUserAction(`Appointment booked with teacher: ${selectedTeacherId} at ${date} ${timeSlot}`);
        showNotification('Appointment booked successfully!', 'success');
        closeModal('bookingModal');
        loadStudentAppointments();
        
    } catch (error) {
        console.error('Booking error:', error);
        showNotification('Error booking appointment', 'error');
    }
}

// Handle sending message
async function handleMessage(e) {
    e.preventDefault();
    
    const content = document.getElementById('messageContent').value;
    
    if (!content || !selectedMessageRecipient) {
        showNotification('Please fill in message content', 'error');
        return;
    }
    
    try {
        const { db } = window.firebaseServices;
        
        const messageData = {
            fromId: currentUser.uid,
            fromName: currentUser.name,
            toId: selectedMessageRecipient,
            content: content,
            createdAt: new Date().toISOString()
        };
        
        await db.collection('messages').add(messageData);
        
        logUserAction(`Message sent to: ${selectedMessageRecipient}`);
        showNotification('Message sent successfully!', 'success');
        closeModal('messageModal');
        
    } catch (error) {
        console.error('Message error:', error);
        showNotification('Error sending message', 'error');
    }
}

// Handle adding teacher (admin only)
async function handleAddTeacher(e) {
    e.preventDefault();
    
    const name = document.getElementById('teacherName').value;
    const email = document.getElementById('teacherEmail').value;
    const department = document.getElementById('teacherDepartment').value;
    const subject = document.getElementById('teacherSubject').value;
    const password = document.getElementById('teacherPassword').value;
    
    if (!name || !email || !department || !subject || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const { auth, db } = window.firebaseServices;
        
        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        const userData = {
            name: name,
            email: email,
            role: 'teacher',
            department: department,
            subject: subject,
            approved: true,
            createdAt: new Date().toISOString()
        };
        
        await db.collection('users').doc(user.uid).set(userData);
        
        logUserAction(`Admin added new teacher: ${name}`);
        showNotification('Teacher added successfully!', 'success');
        closeModal('addTeacherModal');
        loadTeachersList();
        
    } catch (error) {
        console.error('Add teacher error:', error);
        showNotification(getErrorMessage(error), 'error');
    }
}

// Search teachers
async function searchTeachers() {
    const searchInput = document.getElementById('teacherSearch');
    if (!searchInput) {
        console.error('Teacher search input not found');
        return;
    }
    
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        // If search is empty, load all teachers
        loadAllTeachers();
        return;
    }
    
    try {
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        

        
        // Get all teachers and filter in JavaScript for case-insensitive search
        const teachersSnapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .get();
        
        const teachers = [];
        const searchTermLower = searchTerm.toLowerCase();
        
        teachersSnapshot.forEach(doc => {
            const teacher = { id: doc.id, ...doc.data() };
            
            // Filter for approved teachers only
            if (teacher.approved === true) {
                // Case-insensitive search across name, department, and subject
                const nameMatch = teacher.name && teacher.name.toLowerCase().includes(searchTermLower);
                const departmentMatch = teacher.department && teacher.department.toLowerCase().includes(searchTermLower);
                const subjectMatch = teacher.subject && teacher.subject.toLowerCase().includes(searchTermLower);
                
                if (nameMatch || departmentMatch || subjectMatch) {
                    teachers.push(teacher);
                }
            }
        });
        

        displayTeacherResults(teachers);
        
        if (teachers.length === 0) {
            showNotification('No teachers found matching your search', 'info');
        }
        
    } catch (error) {
        handleFirebaseError(error, 'search teachers');
    }
}

// Display teacher search results
function displayTeacherResults(teachers) {
    const resultsContainer = document.getElementById('teacherResults');
    
    if (!resultsContainer) {
        console.error('Teacher results container not found');
        return;
    }
    
    if (teachers.length === 0) {
        resultsContainer.innerHTML = '<p class="no-data">No teachers found matching your search</p>';
        return;
    }
    
    const teachersHTML = teachers.map(teacher => {
        // Format name with proper case
        const formattedName = teacher.name ? 
            teacher.name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : 
            'Unknown Teacher';
        
        // Format department with proper case
        const formattedDepartment = teacher.department ? 
            teacher.department.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : 
            'Not specified';
        
        // Format subject with proper case
        const formattedSubject = teacher.subject ? 
            teacher.subject.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') : 
            'Not specified';
        
        return `
            <div class="teacher-item">
                <h4>${formattedName}</h4>
                <p><strong>Department:</strong> ${formattedDepartment}</p>
                <p><strong>Subject:</strong> ${formattedSubject}</p>
                <div class="teacher-actions">
                    <button class="btn btn-primary" onclick="bookAppointment('${teacher.id}', '${formattedName}')">
                        Book Appointment
                    </button>

                </div>
            </div>
        `;
    }).join('');
    
    resultsContainer.innerHTML = teachersHTML;
}

// Book appointment with teacher
function bookAppointment(teacherId, teacherName) {
    selectedTeacherId = teacherId;
    document.getElementById('bookingModal').style.display = 'block';
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('appointmentDate').min = today;
}

// Send message to teacher
function sendMessage(teacherId, teacherName) {
    selectedMessageRecipient = teacherId;
    document.getElementById('messageTo').value = teacherName;
    document.getElementById('messageModal').style.display = 'block';
}

// Load student appointments
async function loadStudentAppointments() {
    if (currentUserRole !== 'student') return;
    
    try {
        const { db } = window.firebaseServices;
        
        // Simplified query to avoid index requirement
        const appointmentsSnapshot = await db.collection('appointments')
            .where('studentId', '==', currentUser.uid)
            .get();
        
        const appointments = [];
        appointmentsSnapshot.forEach(doc => {
            appointments.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by creation time in JavaScript
        appointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('Student appointments loaded:', appointments.length);
        displayStudentAppointments(appointments);
        
    } catch (error) {
        console.error('Error loading student appointments:', error);
        showNotification('Error loading appointments', 'error');
    }
}

// Display student appointments
function displayStudentAppointments(appointments) {
    const container = document.getElementById('studentAppointments');
    
    if (appointments.length === 0) {
        container.innerHTML = '<p class="no-data">No appointments found</p>';
        return;
    }
    
            const appointmentsHTML = appointments.map(appointment => {
            const statusClass = appointment.status === 'approved' ? 'confirmed' : 
                               appointment.status === 'rejected' ? 'rejected' : 'pending';
            const statusText = appointment.status === 'approved' ? 'Approved' : 
                              appointment.status === 'rejected' ? 'Rejected' : 
                              appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1);
            
            // Get teacher name for display
            const teacherName = appointment.teacherName || 'Teacher';
        
                    return `
                <div class="appointment-item ${statusClass}">
                    <h4>Appointment with ${teacherName}</h4>
                    <p><strong>Date:</strong> ${appointment.date}</p>
                    <p><strong>Time Slot:</strong> ${appointment.time}</p>
                    <p><strong>Status:</strong> <span class="status-${appointment.status}">${statusText}</span></p>
                    <p><strong>Message:</strong> ${appointment.message}</p>
                    ${appointment.status === 'approved' && appointment.approvedByTeacher ? 
                        `<p><strong>Approved by:</strong> ${appointment.approvedByTeacher}</p>` : 
                        ''
                    }
                    ${appointment.status === 'rejected' && appointment.rejectedByTeacher ? 
                        `<p><strong>Rejected by:</strong> ${appointment.rejectedByTeacher}</p>` : 
                        ''
                    }
                    <div class="appointment-actions">
                        ${appointment.status === 'pending' ? 
                            `<button class="btn btn-danger" onclick="cancelAppointment('${appointment.id}')">Cancel</button>` : 
                            ''
                        }
                    </div>
                </div>
            `;
    }).join('');
    
    container.innerHTML = appointmentsHTML;
}

// Load teacher appointments
async function loadTeacherAppointments() {
    if (currentUserRole !== 'teacher') return;
    
    try {
        const { db } = window.firebaseServices;
        
        const appointmentsSnapshot = await db.collection('appointments')
            .where('teacherId', '==', currentUser.uid)
            .get();
        
        const pendingAppointments = [];
        const confirmedAppointments = [];
        
        appointmentsSnapshot.forEach(doc => {
            const appointment = { id: doc.id, ...doc.data() };
            if (appointment.status === 'pending') {
                pendingAppointments.push(appointment);
            } else if (appointment.status === 'approved' || appointment.status === 'confirmed') {
                confirmedAppointments.push(appointment);
            } else if (appointment.status === 'rejected') {
                confirmedAppointments.push(appointment);
            }
        });
        
        // Sort both arrays by creation time
        pendingAppointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        confirmedAppointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('Teacher appointments loaded:', { pending: pendingAppointments.length, confirmed: confirmedAppointments.length });
        
        displayTeacherAppointments(pendingAppointments, confirmedAppointments);
        
    } catch (error) {
        console.error('Error loading teacher appointments:', error);
    }
}

// Display teacher appointments
function displayTeacherAppointments(pending, confirmed) {
    const pendingContainer = document.getElementById('pendingAppointments');
    const confirmedContainer = document.getElementById('confirmedAppointments');
    
    // Display pending appointments
    if (pending.length === 0) {
        pendingContainer.innerHTML = '<p class="no-data">No pending appointments</p>';
    } else {
        const pendingHTML = pending.map(appointment => `
            <div class="appointment-item pending">
                <h4>Appointment Request from ${appointment.studentName}</h4>
                <p><strong>Student:</strong> ${appointment.studentName}</p>
                <p><strong>Date:</strong> ${appointment.date}</p>
                <p><strong>Time Slot:</strong> ${appointment.time}</p>
                <p><strong>Status:</strong> <span class="status-pending">Pending Approval</span></p>
                <p><strong>Student Message:</strong> ${appointment.message}</p>
                <div class="appointment-actions">
                    <button class="btn btn-success" onclick="approveAppointment('${appointment.id}')">✓ Accept Request</button>
                    <button class="btn btn-danger" onclick="rejectAppointment('${appointment.id}')">✗ Reject Request</button>
                </div>
            </div>
        `).join('');
        pendingContainer.innerHTML = pendingHTML;
    }
    
    // Display confirmed and rejected appointments
    if (confirmed.length === 0) {
        confirmedContainer.innerHTML = '<p class="no-data">No confirmed appointments</p>';
    } else {
        const confirmedHTML = confirmed.map(appointment => {
            const statusClass = appointment.status === 'approved' ? 'confirmed' : 
                               appointment.status === 'rejected' ? 'rejected' : 'confirmed';
            const statusText = appointment.status === 'approved' ? 'Approved' : 
                              appointment.status === 'rejected' ? 'Rejected' : 'Confirmed';
            
            return `
                <div class="appointment-item ${statusClass}">
                    <h4>Appointment with ${appointment.studentName}</h4>
                    <p><strong>Date:</strong> ${appointment.date}</p>
                    <p><strong>Time Slot:</strong> ${appointment.time}</p>
                    <p><strong>Status:</strong> <span class="status-${appointment.status}">${statusText}</span></p>
                    <p><strong>Message:</strong> ${appointment.message}</p>
                </div>
            `;
        }).join('');
        confirmedContainer.innerHTML = confirmedHTML;
    }
}

// Load messages
async function loadMessages() {
    if (!currentUser) return;
    
    try {
        const { db } = window.firebaseServices;
        
        const messagesSnapshot = await db.collection('messages')
            .where('fromId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const receivedMessagesSnapshot = await db.collection('messages')
            .where('toId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        
        const messages = [];
        messagesSnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data(), type: 'sent' });
        });
        
        receivedMessagesSnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data(), type: 'received' });
        });
        
        // Sort by creation time
        messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        displayMessages(messages);
        
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

// Display messages
function displayMessages(messages) {
    const container = currentUserRole === 'student' ? 
        document.getElementById('studentMessages') : 
        document.getElementById('teacherMessages');
    
    if (messages.length === 0) {
        container.innerHTML = '<p>No messages found</p>';
        return;
    }
    
    const messagesHTML = messages.map(message => `
        <div class="message-item">
            <h4>${message.type === 'sent' ? 'To: ' + message.toId : 'From: ' + message.fromName}</h4>
            <p><strong>Message:</strong> ${message.content}</p>
            <p><strong>Time:</strong> ${message.createdAt ? new Date(message.createdAt).toLocaleString() : 'N/A'}</p>
        </div>
    `).join('');
    
    container.innerHTML = messagesHTML;
}

// Load teachers list (admin)
async function loadTeachersList() {
    if (currentUserRole !== 'admin') return;
    
    try {
        const { db } = window.firebaseServices;
        
        const teachersSnapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .get();
        
        const teachers = [];
        teachersSnapshot.forEach(doc => {
            teachers.push({ id: doc.id, ...doc.data() });
        });
        
        displayTeachersList(teachers);
        
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

// Display teachers list
function displayTeachersList(teachers) {
    const container = document.getElementById('teachersList');
    
    if (teachers.length === 0) {
        container.innerHTML = '<p>No teachers found</p>';
        return;
    }
    
    const teachersHTML = teachers.map(teacher => `
        <div class="admin-item">
            <h4>${teacher.name}</h4>
            <p><strong>Email:</strong> ${teacher.email}</p>
            <p><strong>Department:</strong> ${teacher.department}</p>
            <p><strong>Subject:</strong> ${teacher.subject}</p>
            <div class="admin-actions">
                <button class="btn btn-danger" onclick="deleteTeacher('${teacher.id}')">Delete</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = teachersHTML;
}

// Load pending students (admin)
async function loadPendingStudents() {
    if (currentUserRole !== 'admin') return;
    
    try {
        const { db } = window.firebaseServices;
        
        // Get all students and filter in JavaScript
        const studentsSnapshot = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        
        const students = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter for unapproved students
            if (student.approved === false) {
                students.push(student);
            }
        });
        
        displayPendingStudents(students);
        
    } catch (error) {
        console.error('Error loading pending students:', error);
    }
}

// Display pending students
function displayPendingStudents(students) {
    const container = document.getElementById('pendingStudents');
    
    if (students.length === 0) {
        container.innerHTML = '<p>No pending student approvals</p>';
        return;
    }
    
    const studentsHTML = students.map(student => `
        <div class="admin-item">
            <h4>${student.name}</h4>
            <p><strong>Email:</strong> ${student.email}</p>
            <div class="admin-actions">
                <button class="btn btn-success" onclick="approveStudent('${student.id}')">Approve</button>
                <button class="btn btn-danger" onclick="rejectStudent('${student.id}')">Reject</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = studentsHTML;
}

// Load system logs (admin)
async function loadSystemLogs() {
    if (currentUserRole !== 'admin') return;
    
    try {
        const { db } = window.firebaseServices;
        
        const logsSnapshot = await db.collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
        
        const logs = [];
        logsSnapshot.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
        });
        
        displaySystemLogs(logs);
        
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

// Display system logs
function displaySystemLogs(logs) {
    const container = document.getElementById('systemLogs');
    
    if (logs.length === 0) {
        container.innerHTML = '<p>No logs found</p>';
        return;
    }
    
            const logsHTML = logs.map(log => `
            <div class="log-item">
                <strong>${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</strong> - ${log.action}
            </div>
        `).join('');
    
    container.innerHTML = logsHTML;
}

// Respond to appointment (approve or reject)
async function respondToAppointment(appointmentId, decision) {
    try {
        const { db } = window.firebaseServices;
        
        // Get appointment details first
        const appointmentDoc = await db.collection('appointments').doc(appointmentId).get();
        if (!appointmentDoc.exists) {
            showNotification('Appointment not found', 'error');
            return;
        }
        
        const appointment = appointmentDoc.data();
        
        // Update appointment status with teacher details
        const updateData = {
            status: decision, // "approved" or "rejected"
            updatedAt: new Date().toISOString()
        };
        
        if (decision === 'approved') {
            updateData.approvedBy = currentUser.uid;
            updateData.approvedByTeacher = currentUser.name;
            updateData.approvedAt = new Date().toISOString();
        } else if (decision === 'rejected') {
            updateData.rejectedBy = currentUser.uid;
            updateData.rejectedByTeacher = currentUser.name;
            updateData.rejectedAt = new Date().toISOString();
        }
        
        await db.collection('appointments').doc(appointmentId).update(updateData);
        
        const actionText = decision === 'approved' ? 'approved' : 'rejected';
        logUserAction(`Appointment ${actionText} for student: ${appointment.studentName}`);
        showNotification(`Appointment ${actionText}! Student will be notified.`, 'success');
        
        // Refresh teacher appointments
        loadTeacherAppointments();
        
    } catch (error) {
        console.error(`Error ${decision} appointment:`, error);
        showNotification(`Error ${decision} appointment`, 'error');
    }
}

// Approve appointment (wrapper function)
async function approveAppointment(appointmentId) {
    await respondToAppointment(appointmentId, 'approved');
}

// Reject appointment (wrapper function)
async function rejectAppointment(appointmentId) {
    await respondToAppointment(appointmentId, 'rejected');
}

// Cancel appointment
async function cancelAppointment(appointmentId) {
    try {
        const { db } = window.firebaseServices;
        
        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
            cancelledBy: currentUser.uid,
            cancelledAt: new Date().toISOString()
        });
        
        logUserAction(`Appointment ${appointmentId} cancelled by student`);
        showNotification('Appointment cancelled!', 'success');
        loadStudentAppointments();
        
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        showNotification('Error cancelling appointment', 'error');
    }
}

// Approve student
async function approveStudent(studentId) {
    try {
        const { db } = window.firebaseServices;
        
        await db.collection('users').doc(studentId).update({
            approved: true
        });
        
        logUserAction(`Student ${studentId} approved`);
        showNotification('Student approved!', 'success');
        loadPendingStudents();
        
    } catch (error) {
        console.error('Error approving student:', error);
        showNotification('Error approving student', 'error');
    }
}

// Reject student
async function rejectStudent(studentId) {
    try {
        const { db } = window.firebaseServices;
        
        await db.collection('users').doc(studentId).delete();
        
        logUserAction(`Student ${studentId} rejected`);
        showNotification('Student rejected!', 'success');
        loadPendingStudents();
        
    } catch (error) {
        console.error('Error rejecting student:', error);
        showNotification('Error rejecting student', 'error');
    }
}

// Delete teacher
async function deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher?')) {
        return;
    }
    
    try {
        const { db } = window.firebaseServices;
        
        await db.collection('users').doc(teacherId).delete();
        
        logUserAction(`Teacher ${teacherId} deleted`);
        showNotification('Teacher deleted!', 'success');
        loadTeachersList();
        
    } catch (error) {
        console.error('Error deleting teacher:', error);
        showNotification('Error deleting teacher', 'error');
    }
}

// Handle add schedule
async function handleAddSchedule(e) {
    e.preventDefault();
    

    
    // Validate user role
    if (!currentUserRole || (currentUserRole !== 'admin' && currentUserRole !== 'teacher')) {
        showNotification('Invalid user role for adding schedules', 'error');
        return;
    }
    
    let teacherId;
    if (currentUserRole === 'admin') {
        teacherId = document.getElementById('scheduleTeacher').value;
        if (!teacherId) {
            showNotification('Please select a teacher', 'error');
            return;
        }
    } else if (currentUserRole === 'teacher') {
        teacherId = currentUser.uid; // Use current teacher's ID
        if (!teacherId) {
            showNotification('Teacher ID not found', 'error');
            return;
        }
    }
    
    // Get form values
    const day = document.getElementById('scheduleDay').value;
    const startTime = document.getElementById('scheduleStartTime').value;
    const endTime = document.getElementById('scheduleEndTime').value;
    const maxBookings = parseInt(document.getElementById('scheduleMaxBookings').value) || 1;
    const slotDuration = parseInt(document.getElementById('scheduleSlotDuration').value) || 30;
    const active = document.getElementById('scheduleActive').value === 'true';
    

    
    // Validate required fields
    if (!day || !startTime || !endTime) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (startTime >= endTime) {
        showNotification('End time must be after start time', 'error');
        return;
    }
    
    showLoadingScreen();
    
    try {
        // Check Firebase services
        if (!window.firebaseServices) {
            throw new Error('Firebase services not initialized');
        }
        
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        
        // Create schedule data
        const scheduleData = {
            teacherId: teacherId,
            day: day,
            startTime: startTime,
            endTime: endTime,
            maxBookings: maxBookings,
            slotDuration: slotDuration,
            active: active,
            createdAt: new Date().toISOString()
        };
        

        
        // Add to Firestore
        const docRef = await db.collection('teacherSchedules').add(scheduleData);

        
        // Log the action
        await logUserAction(`Schedule added for teacher ${teacherId} on ${day}`);
        
        // Show success message
        showNotification('Schedule added successfully!', 'success');
        
        // Close modal and reset form
        closeModal('addScheduleModal');
        document.getElementById('addScheduleForm').reset();
        
        // Refresh appropriate schedule list based on user role
        if (currentUserRole === 'admin') {
            await loadTeacherSchedules();
        } else if (currentUserRole === 'teacher') {
            await loadTeacherMySchedules();
        }
        
    } catch (error) {
        console.error('Error adding schedule:', error);
        console.error('Error details:', error.message, error.code);
        
        let errorMessage = 'Error adding schedule';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase service unavailable. Please check your connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        hideLoadingScreen();
    }
}

// Load teacher schedules
async function loadTeacherSchedules() {
    try {
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        

        
        const schedulesSnapshot = await db.collection('teacherSchedules')
            .get();
        
        const schedules = [];
        schedulesSnapshot.forEach(doc => {
            schedules.push({ id: doc.id, ...doc.data() });
        });
        

        displayTeacherSchedules(schedules);
        
    } catch (error) {
        console.error('Error loading teacher schedules:', error);
        console.error('Error details:', error.message, error.code);
        
        let errorMessage = 'Error loading schedules';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your Firebase security rules for teacherSchedules collection.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase service unavailable. Please check your connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Display teacher schedules
async function displayTeacherSchedules(schedules) {
    const container = document.getElementById('teacherSchedules');
    
    if (schedules.length === 0) {
        container.innerHTML = '<p class="no-data">No schedules found</p>';
        return;
    }
    
    // Group schedules by teacher
    const teacherSchedules = {};
    for (const schedule of schedules) {
        if (!teacherSchedules[schedule.teacherId]) {
            teacherSchedules[schedule.teacherId] = [];
        }
        teacherSchedules[schedule.teacherId].push(schedule);
    }
    
    let html = '';
    
    for (const [teacherId, teacherScheduleList] of Object.entries(teacherSchedules)) {
        try {
            // Get teacher name
            const { db } = window.firebaseServices;
            const teacherDoc = await db.collection('users').doc(teacherId).get();
            const teacherName = teacherDoc.exists ? teacherDoc.data().name : 'Unknown Teacher';
            
            html += `<div class="schedule-group">`;
            html += `<h4>${teacherName}</h4>`;
            
            teacherScheduleList.forEach(schedule => {
                const statusClass = schedule.active ? 'active' : 'inactive';
                const statusText = schedule.active ? 'Active' : 'Inactive';
                
                html += `<div class="schedule-item ${statusClass}">`;
                html += `<div class="schedule-info">`;
                html += `<strong>${schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)}</strong>`;
                html += `<span>${schedule.startTime} - ${schedule.endTime}</span>`;
                html += `<span>Slots: ${schedule.maxBookings} (${schedule.slotDuration}min each)</span>`;
                html += `<span class="status">${statusText}</span>`;
                html += `</div>`;
                html += `<div class="schedule-actions">`;
                html += `<button onclick="toggleScheduleStatus('${schedule.id}', ${!schedule.active})" class="btn btn-small ${schedule.active ? 'btn-warning' : 'btn-success'}">`;
                html += schedule.active ? 'Deactivate' : 'Activate';
                html += `</button>`;
                html += `<button onclick="deleteSchedule('${schedule.id}')" class="btn btn-small btn-danger">Delete</button>`;
                html += `</div>`;
                html += `</div>`;
            });
            
            html += `</div>`;
            
        } catch (error) {
            console.error('Error getting teacher name:', error);
        }
    }
    
    container.innerHTML = html;
}

// Toggle schedule status
async function toggleScheduleStatus(scheduleId, newStatus) {
    try {
        const { db } = window.firebaseServices;
        
        await db.collection('teacherSchedules').doc(scheduleId).update({
            active: newStatus
        });
        
        logUserAction(`Schedule ${scheduleId} ${newStatus ? 'activated' : 'deactivated'}`);
        showNotification(`Schedule ${newStatus ? 'activated' : 'deactivated'}!`, 'success');
        
        // Refresh appropriate schedule list based on user role
        if (currentUserRole === 'admin') {
            loadTeacherSchedules();
        } else if (currentUserRole === 'teacher') {
            loadTeacherMySchedules();
        }
        
    } catch (error) {
        console.error('Error toggling schedule status:', error);
        showNotification('Error updating schedule', 'error');
    }
}

// Delete schedule
async function deleteSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this schedule?')) {
        return;
    }
    
    try {
        const { db } = window.firebaseServices;
        
        await db.collection('teacherSchedules').doc(scheduleId).delete();
        
        logUserAction(`Schedule ${scheduleId} deleted`);
        showNotification('Schedule deleted!', 'success');
        
        // Refresh appropriate schedule list based on user role
        if (currentUserRole === 'admin') {
            loadTeacherSchedules();
        } else if (currentUserRole === 'teacher') {
            loadTeacherMySchedules();
        }
        
    } catch (error) {
        console.error('Error deleting schedule:', error);
        showNotification('Error deleting schedule', 'error');
    }
}

// Show add schedule modal
function showAddScheduleModal() {

    
    if (currentUserRole === 'admin') {
        // Load teachers for the dropdown
        loadTeachersForSchedule();
        document.getElementById('scheduleTeacher').style.display = 'block';
        document.querySelector('label[for="scheduleTeacher"]').style.display = 'block';
        document.getElementById('scheduleModalTitle').textContent = 'Add Teacher Schedule';
    } else if (currentUserRole === 'teacher') {
        // Hide teacher selection for teachers (they can only add their own schedules)
        document.getElementById('scheduleTeacher').style.display = 'none';
        document.querySelector('label[for="scheduleTeacher"]').style.display = 'none';
        document.getElementById('scheduleModalTitle').textContent = 'Add My Schedule';
    }
    document.getElementById('addScheduleModal').style.display = 'block';
}

// Load teachers for schedule dropdown
async function loadTeachersForSchedule() {
    try {
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        

        
        const teachersSnapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .get();
        
        const teacherSelect = document.getElementById('scheduleTeacher');
        if (!teacherSelect) {
            throw new Error('Teacher select element not found');
        }
        
        teacherSelect.innerHTML = '<option value="">Choose Teacher</option>';
        
        let teacherCount = 0;
        teachersSnapshot.forEach(doc => {
            const teacher = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = teacher.name;
            teacherSelect.appendChild(option);
            teacherCount++;
        });
        

        
    } catch (error) {
        console.error('Error loading teachers for schedule:', error);
        console.error('Error details:', error.message, error.code);
        
        let errorMessage = 'Error loading teachers';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your Firebase security rules for users collection.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase service unavailable. Please check your connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Load teacher's own schedules
async function loadTeacherMySchedules() {
    try {
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        
        if (!currentUser || !currentUser.uid) {
            throw new Error('User not authenticated');
        }
        

        
        const schedulesSnapshot = await db.collection('teacherSchedules')
            .where('teacherId', '==', currentUser.uid)
            .get();
        
        const schedules = [];
        schedulesSnapshot.forEach(doc => {
            schedules.push({ id: doc.id, ...doc.data() });
        });
        

        displayTeacherMySchedules(schedules);
        
    } catch (error) {
        console.error('Error loading teacher schedules:', error);
        console.error('Error details:', error.message, error.code);
        
        let errorMessage = 'Error loading schedules';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your Firebase security rules for teacherSchedules collection.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase service unavailable. Please check your connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Display teacher's own schedules
function displayTeacherMySchedules(schedules) {
    const container = document.getElementById('teacherMySchedules');
    
    if (schedules.length === 0) {
        container.innerHTML = '<p class="no-data">No schedules found. Add your first schedule!</p>';
        return;
    }
    
    let html = '';
    
    schedules.forEach(schedule => {
        const statusClass = schedule.active ? 'active' : 'inactive';
        const statusText = schedule.active ? 'Active' : 'Inactive';
        
        html += `<div class="schedule-item ${statusClass}">`;
        html += `<div class="schedule-info">`;
        html += `<strong>${schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)}</strong>`;
        html += `<span>${schedule.startTime} - ${schedule.endTime}</span>`;
        html += `<span>Slots: ${schedule.maxBookings} (${schedule.slotDuration}min each)</span>`;
        html += `<span class="status">${statusText}</span>`;
        html += `</div>`;
        html += `<div class="schedule-actions">`;
        html += `<button onclick="toggleScheduleStatus('${schedule.id}', ${!schedule.active})" class="btn btn-small ${schedule.active ? 'btn-warning' : 'btn-success'}">`;
        html += schedule.active ? 'Deactivate' : 'Activate';
        html += `</button>`;
        html += `<button onclick="deleteSchedule('${schedule.id}')" class="btn btn-small btn-danger">Delete</button>`;
        html += `</div>`;
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// Log user actions
async function logUserAction(action) {
    try {
        const { db } = window.firebaseServices;
        
        const logData = {
            userId: currentUser?.uid || 'anonymous',
            userName: currentUser?.name || 'anonymous',
            userRole: currentUserRole || 'anonymous',
            action: action,
            timestamp: new Date().toISOString()
        };
        
        await db.collection('logs').add(logData);
        
    } catch (error) {
        console.error('Error logging action:', error);
    }
}

// Navigation functions
function showHome() {
    hideAllPages();
    document.getElementById('homePage').classList.add('active');
}

function showLogin() {
    hideAllPages();
    document.getElementById('loginPage').classList.add('active');
}

function showRegister() {
    hideAllPages();
    document.getElementById('registerPage').classList.add('active');
}

function showDashboard() {
    hideAllPages();
    document.getElementById('dashboardPage').classList.add('active');
    
    // Load appropriate dashboard content
    if (currentUserRole === 'student') {
        document.getElementById('studentDashboard').style.display = 'block';
        document.getElementById('studentName').textContent = currentUser.name;
        loadStudentAppointments();
        loadStudentTeacherSchedules();
        loadAllTeachers(); // Load all available teachers
    } else if (currentUserRole === 'teacher') {
        document.getElementById('teacherDashboard').style.display = 'block';
        document.getElementById('teacherName').textContent = currentUser.name;
        loadTeacherAppointments();
        loadTeacherMySchedules();
    } else if (currentUserRole === 'admin') {
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('adminName').textContent = currentUser.name;
        loadTeachersList();
        loadTeacherSchedules();
        loadPendingStudents();
        loadSystemLogs();
    }
}

function hideAllPages() {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    // Hide all dashboards
    document.getElementById('studentDashboard').style.display = 'none';
    document.getElementById('teacherDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
}

function updateNavigation(isLoggedIn) {
    const homeNav = document.getElementById('homeNav');
    const loginNav = document.getElementById('loginNav');
    const registerNav = document.getElementById('registerNav');
    const dashboardNav = document.getElementById('dashboardNav');
    const logoutNav = document.getElementById('logoutNav');
    
    if (isLoggedIn) {
        loginNav.style.display = 'none';
        registerNav.style.display = 'none';
        dashboardNav.style.display = 'block';
        logoutNav.style.display = 'block';
    } else {
        loginNav.style.display = 'block';
        registerNav.style.display = 'block';
        dashboardNav.style.display = 'none';
        logoutNav.style.display = 'none';
    }
}

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    
    // Clear form fields
    if (modalId === 'bookingModal') {
        document.getElementById('bookingForm').reset();
        // Remove schedule info if it exists
        const scheduleInfo = document.querySelector('.schedule-info-group');
        if (scheduleInfo) {
            scheduleInfo.remove();
        }
        // Remove slot selection if it exists
        const slotSelection = document.getElementById('appointmentSlot');
        if (slotSelection && slotSelection.parentNode) {
            slotSelection.parentNode.remove();
        }
        selectedTeacherId = null;
    } else if (modalId === 'messageModal') {
        document.getElementById('messageForm').reset();
        selectedMessageRecipient = null;
    } else if (modalId === 'addTeacherModal') {
        document.getElementById('addTeacherForm').reset();
    } else if (modalId === 'addScheduleModal') {
        document.getElementById('addScheduleForm').reset();
    }
}

function showAddTeacherModal() {
    document.getElementById('addTeacherModal').style.display = 'block';
}

// Mobile menu toggle
function toggleMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Utility functions
function showLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/user-not-found':
            return 'User not found';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'Email already registered';
        case 'auth/weak-password':
            return 'Password is too weak';
        case 'auth/invalid-email':
            return 'Invalid email address';
        default:
            return error.message || 'An error occurred';
    }
}

// Logout function
async function logout() {
    try {
        const { auth } = window.firebaseServices;
        await auth.signOut();
        logUserAction('User logged out');
        showNotification('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Load student teacher schedules
async function loadStudentTeacherSchedules() {
    try {
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        

        
        const schedulesSnapshot = await db.collection('teacherSchedules')
            .where('active', '==', true)
            .get();
        
        const schedules = [];
        schedulesSnapshot.forEach(doc => {
            schedules.push({ id: doc.id, ...doc.data() });
        });
        

        displayStudentTeacherSchedules(schedules);
        
    } catch (error) {
        console.error('Error loading teacher schedules for student:', error);
        console.error('Error details:', error.message, error.code);
        
        let errorMessage = 'Error loading schedules';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firebase service unavailable. Please check your connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Display teacher schedules for students
async function displayStudentTeacherSchedules(schedules) {
    const container = document.getElementById('studentTeacherSchedules');
    
    if (schedules.length === 0) {
        container.innerHTML = '<p class="no-data">No available schedules found</p>';
        return;
    }
    
    // Group schedules by teacher
    const teacherSchedules = {};
    for (const schedule of schedules) {
        if (!teacherSchedules[schedule.teacherId]) {
            teacherSchedules[schedule.teacherId] = [];
        }
        teacherSchedules[schedule.teacherId].push(schedule);
    }
    
    let html = '';
    
    for (const [teacherId, teacherScheduleList] of Object.entries(teacherSchedules)) {
        try {
            // Get teacher name
            const { db } = window.firebaseServices;
            const teacherDoc = await db.collection('users').doc(teacherId).get();
            const teacherName = teacherDoc.exists ? teacherDoc.data().name : 'Unknown Teacher';
            const teacherDepartment = teacherDoc.exists ? teacherDoc.data().department : 'Unknown Department';
            
            html += `<div class="schedule-group">`;
            html += `<h4>${teacherName} - ${teacherDepartment}</h4>`;
            
            teacherScheduleList.forEach(schedule => {
                html += `<div class="schedule-item active">`;
                html += `<div class="schedule-info">`;
                html += `<strong>${schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)}</strong>`;
                html += `<span>${schedule.startTime} - ${schedule.endTime}</span>`;
                html += `<span>Slots: ${schedule.maxBookings} (${schedule.slotDuration}min each)</span>`;
                html += `</div>`;
                html += `<div class="schedule-actions">`;
                html += `<button onclick="bookScheduleAppointment('${teacherId}', '${teacherName}', '${schedule.day}', '${schedule.startTime}', '${schedule.endTime}', '${schedule.slotDuration}')" class="btn btn-small btn-primary">Book Appointment</button>`;
                html += `</div>`;
                html += `</div>`;
            });
            
            html += `</div>`;
            
        } catch (error) {
            console.error('Error getting teacher name:', error);
        }
    }
    
    container.innerHTML = html;
}

// Book appointment from schedule
function bookScheduleAppointment(teacherId, teacherName, day, startTime, endTime, slotDuration) {
    selectedTeacherId = teacherId;
    
    // Set the teacher name in the booking modal
    const bookingModal = document.getElementById('bookingModal');
    const modalTitle = bookingModal.querySelector('h3');
    modalTitle.textContent = `Book Appointment with ${teacherName}`;
    
    // Generate available time slots
    const slots = generateTimeSlots(startTime, endTime, parseInt(slotDuration));
    
    // Add schedule info and slot selection to the form
    const form = document.getElementById('bookingForm');
    
    // Clear any existing schedule info
    const existingScheduleInfo = form.querySelector('.schedule-info-group');
    if (existingScheduleInfo) {
        existingScheduleInfo.remove();
    }
    
    const scheduleInfo = document.createElement('div');
    scheduleInfo.className = 'form-group schedule-info-group';
    scheduleInfo.innerHTML = `
        <label>Available Schedule</label>
        <p><strong>${day.charAt(0).toUpperCase() + day.slice(1)}</strong> - ${startTime} to ${endTime}</p>
        <p>Slot Duration: ${slotDuration} minutes</p>
    `;
    
    // Create slot selection
    const slotSelection = document.createElement('div');
    slotSelection.className = 'form-group';
    slotSelection.innerHTML = `
        <label for="appointmentSlot">Select Time Slot</label>
        <select id="appointmentSlot" required>
            <option value="">Choose a time slot</option>
            ${slots.map(slot => `<option value="${slot}">${slot}</option>`).join('')}
        </select>
    `;
    
    // Insert schedule info and slot selection before the first form group
    const firstFormGroup = form.querySelector('.form-group');
    form.insertBefore(scheduleInfo, firstFormGroup);
    form.insertBefore(slotSelection, scheduleInfo.nextSibling);
    
    // Show the booking modal
    document.getElementById('bookingModal').style.display = 'block';
}

// Generate time slots based on start time, end time, and duration
function generateTimeSlots(startTime, endTime, durationMinutes) {
    const slots = [];
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    let current = new Date(start);
    
    while (current < end) {
        const timeString = current.toTimeString().slice(0, 5); // HH:MM format
        slots.push(timeString);
        current.setMinutes(current.getMinutes() + durationMinutes);
    }
    
    return slots;
}

// Load all available teachers for students
async function loadAllTeachers() {
    try {
        const { db } = window.firebaseServices;
        
        if (!db) {
            throw new Error('Firebase database not initialized');
        }
        

        
        const teachersSnapshot = await db.collection('users')
            .where('role', '==', 'teacher')
            .get();
        
        const teachers = [];
        teachersSnapshot.forEach(doc => {
            const teacher = { id: doc.id, ...doc.data() };
            if (teacher.approved === true) {
                teachers.push(teacher);
            }
        });
        

        displayTeacherResults(teachers);
        
        if (teachers.length === 0) {
            showNotification('No approved teachers available', 'info');
        }
        
    } catch (error) {
        handleFirebaseError(error, 'load all teachers');
    }
}

// Enhanced Firebase error handling
function handleFirebaseError(error, operation) {
    console.error(`Firebase error in ${operation}:`, error);
    
    let errorMessage = 'An error occurred. Please try again.';
    let actionMessage = '';
    
    if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please check your Firebase security rules.';
        actionMessage = 'Go to Firebase Console → Firestore Database → Rules and update them.';
    } else if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
        errorMessage = 'Network error. Please check your internet connection.';
        actionMessage = 'Try refreshing the page or check your connection.';
    } else if (error.code === 'not-found') {
        errorMessage = 'Collection not found. Please create required collections.';
        actionMessage = 'Go to Firebase Console → Firestore Database and create: users, teacherSchedules, appointments, messages, logs';
    } else if (error.code === 'invalid-argument') {
        errorMessage = 'Invalid data. Please check your input.';
    } else if (error.code === 'already-exists') {
        errorMessage = 'This item already exists.';
    } else if (error.code === 'resource-exhausted') {
        errorMessage = 'Service temporarily unavailable. Please try again later.';
    } else if (error.code === 'failed-precondition') {
        errorMessage = 'Operation failed. Please try again.';
    } else if (error.code === 'aborted') {
        errorMessage = 'Operation was cancelled. Please try again.';
    } else if (error.code === 'out-of-range') {
        errorMessage = 'Invalid data range. Please check your input.';
    } else if (error.code === 'unimplemented') {
        errorMessage = 'This feature is not available.';
    } else if (error.code === 'internal') {
        errorMessage = 'Internal server error. Please try again later.';
    } else if (error.code === 'data-loss') {
        errorMessage = 'Data loss occurred. Please try again.';
    } else if (error.code === 'unauthenticated') {
        errorMessage = 'Please log in to continue.';
        actionMessage = 'You need to be logged in to perform this action.';
    }
    
    showNotification(errorMessage, 'error');
    
    if (actionMessage) {
        console.error('Action required:', actionMessage);
        setTimeout(() => {
            showNotification(actionMessage, 'warning');
        }, 3000);
    }
}

// Enhanced retry logic for Firebase operations
async function retryFirebaseOperation(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            console.log(`Retrying operation (attempt ${attempt + 1}/${maxRetries})...`);
        }
    }
}

 