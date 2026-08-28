// Render 20 Blank Subject Fields on Page Load
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('subjectsContainer');
    if (container) {
        container.innerHTML = '';
        for (let i = 1; i <= 20; i++) {
            container.innerHTML += `
                <div class="form-row subject-row" style="margin-bottom: 10px;">
                    <div class="form-group" style="flex: 2;">
                        <input type="text" class="sub-name" placeholder="Subject ${i} Name (e.g. Mathematics)">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="sub-ca" min="0" max="40" placeholder="CA (40)">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="sub-exam" min="0" max="60" placeholder="Exam (60)">
                    </div>
                </div>`;
        }
    }
});

// Tab Switcher with smooth section animation
function switchTab(tabName) {
    const studentTab = document.getElementById('studentTabBtn');
    const staffTab = document.getElementById('staffTabBtn');
    const studentSection = document.getElementById('student-section');
    const staffSection = document.getElementById('staff-section');

    if (tabName === 'student') {
        studentTab.classList.add('active');
        staffTab.classList.remove('active');
        
        staffSection.classList.remove('active-section');
        setTimeout(() => {
            staffSection.style.display = 'none';
            studentSection.style.display = 'block';
            studentSection.classList.add('active-section');
        }, 150);

    } else {
        staffTab.classList.add('active');
        studentTab.classList.remove('active');

        studentSection.classList.remove('active-section');
        setTimeout(() => {
            studentSection.style.display = 'none';
            staffSection.style.display = 'block';
            staffSection.classList.add('active-section');
        }, 150);
    }
}

// Fetch and Render Student Result Status List for Admin Dashboard
async function loadStudentStatuses() {
    try {
        const response = await fetch('/api/admin/student-status');
        const data = await response.json();

        if (data.success) {
            const tbody = document.getElementById('adminStudentList');
            tbody.innerHTML = '';

            if (data.students.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #777;">No student results uploaded yet.</td></tr>`;
                return;
            }

            data.students.forEach(student => {
                const hasChecked = student.usage_count > 0;
                const statusBadge = hasChecked 
                    ? `<span style="color: #27ae60; font-weight:600;">Checked (${student.usage_count}/${student.max_usage})</span>` 
                    : `<span style="color: #e67e22; font-weight:600;">Not Checked Yet</span>`;

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${student.student_id}</strong></td>
                        <td>${student.full_name}</td>
                        <td>${student.student_class}</td>
                        <td><code>${student.pin_code || 'N/A'}</code></td>
                        <td>${student.usage_count} time(s)</td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error('Failed to load student status list:', err);
    }
}

// Student Form Handling with 3-Attempt Check Output
document.getElementById('studentLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentId = document.getElementById('studentId').value.trim();
    const pin = document.getElementById('pin').value.trim();

    try {
        const response = await fetch('/api/check-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, pin })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('resName').textContent = data.student.name;
            document.getElementById('resId').textContent = data.student.id;
            document.getElementById('resClass').textContent = data.student.class;
            document.getElementById('resSession').textContent = data.student.session;
            document.getElementById('resTerm').textContent = data.student.term;
            
            // Display Remaining PIN Checks
            document.getElementById('resRemaining').textContent = `${data.remainingChecks} attempt(s) remaining`;

            const tbody = document.getElementById('resultBody');
            tbody.innerHTML = '';
            data.results.forEach(item => {
                tbody.innerHTML += `
                    <tr>
                        <td>${item.subject}</td>
                        <td>${item.ca}</td>
                        <td>${item.exam}</td>
                        <td><strong>${item.total}</strong></td>
                        <td><strong>${item.grade}</strong></td>
                    </tr>`;
            });

            document.getElementById('studentLoginForm').classList.add('hidden');
            document.getElementById('result-card').classList.remove('hidden');
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Could not establish connection to the backend server.');
    }
});

function resetStudentForm() {
    document.getElementById('result-card').classList.add('hidden');
    document.getElementById('studentLoginForm').classList.remove('hidden');
    document.getElementById('studentLoginForm').reset();
}

// Capture and Save Student Result as PNG Image
async function downloadResultAsImage() {
    const resultElement = document.getElementById('result-card');
    const studentId = document.getElementById('resId').textContent || 'Student_Result';
    const actionButtons = resultElement.querySelector('.action-buttons');

    try {
        if (actionButtons) actionButtons.style.visibility = 'hidden';

        await new Promise(resolve => setTimeout(resolve, 150));

        const canvas = await html2canvas(resultElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            windowWidth: resultElement.scrollWidth,
            windowHeight: resultElement.scrollHeight
        });

        const link = document.createElement('a');
        link.download = `${studentId.replace(/[\/\\]/g, '_')}_Result.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();

    } catch (err) {
        console.error('Failed to export image:', err);
        alert('Could not download image. Please try again.');
    } finally {
        if (actionButtons) actionButtons.style.visibility = 'visible';
    }
}

// Trigger Backend CSV File Download for Admin
function exportAdminResultsCSV() {
    window.location.href = '/api/admin/export-results';
}

// Admin Authentication (Password: adminDGC)
document.getElementById('adminAuthForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const pass = document.getElementById('adminPass').value;

    if (pass === 'adminDGC') {
        document.getElementById('adminAuthForm').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        document.getElementById('adminAuthForm').reset();
        
        loadStudentStatuses();
    } else {
        alert('Invalid Admin Authorization Password.');
    }
});

function logoutAdmin() {
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('adminAuthForm').classList.remove('hidden');
}

// Random 6-digit PIN Generator
function generateStudentPin() {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('generatedPin').value = randomPin;
}

// Submit 20 Subjects + Session & Term + Generated PIN
document.getElementById('addResultForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const studentId = document.getElementById('admStudentId').value.trim();
    const fullName = document.getElementById('admFullName').value.trim();
    const studentClass = document.getElementById('admClass').value.trim();
    const session = document.getElementById('admSession').value;
    const term = document.getElementById('admTerm').value;
    const pin = document.getElementById('generatedPin').value.trim();

    if (!pin) {
        alert('Please click "Generate PIN" before saving.');
        return;
    }

    const subjectRows = document.querySelectorAll('.subject-row');
    const subjects = [];

    subjectRows.forEach(row => {
        const name = row.querySelector('.sub-name').value.trim();
        const ca = row.querySelector('.sub-ca').value;
        const exam = row.querySelector('.sub-exam').value;

        if (name && ca !== '' && exam !== '') {
            subjects.push({
                subjectName: name,
                caScore: parseInt(ca),
                examScore: parseInt(exam)
            });
        }
    });

    if (subjects.length === 0) {
        alert('Please fill in at least one subject with valid scores.');
        return;
    }

    try {
        const res = await fetch('/api/admin/add-full-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, fullName, studentClass, session, term, pin, subjects })
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
            document.getElementById('addResultForm').reset();
            document.getElementById('generatedPin').value = '';
            
            loadStudentStatuses();
        }
    } catch (err) {
        alert('Failed to connect to server.');
    }
});
