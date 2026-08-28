// Dynamic Subject Fields Generator
function generateSubjectFields() {
    const container = document.getElementById('subjectsContainer');
    if (container) {
        container.innerHTML = '';
        for (let i = 1; i <= 20; i++) {
            container.innerHTML += `
                <div class="form-row subject-row" style="margin-bottom: 10px;">
                    <div class="form-group" style="flex: 2;">
                        <input type="text" class="sub-name" placeholder="Subject ${i} Name (e.g. Mathematics)" oninput="recalculatePercentage()">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="sub-ca" min="0" max="40" placeholder="CA (40)" oninput="recalculatePercentage()">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="sub-exam" min="0" max="60" placeholder="Exam (60)" oninput="recalculatePercentage()">
                    </div>
                </div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    generateSubjectFields();
});

// Live Percentage Calculator in Admin Dashboard
function recalculatePercentage() {
    const rows = document.querySelectorAll('.subject-row');
    let totalScore = 0;
    let validSubjectCount = 0;

    rows.forEach(row => {
        const name = row.querySelector('.sub-name').value.trim();
        const ca = row.querySelector('.sub-ca').value;
        const exam = row.querySelector('.sub-exam').value;

        if (name !== '' && ca !== '' && exam !== '') {
            totalScore += (parseInt(ca) || 0) + (parseInt(exam) || 0);
            validSubjectCount++;
        }
    });

    const maxScore = validSubjectCount * 100;
    const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(2) : '0.00';

    document.getElementById('calcTotalScore').textContent = totalScore;
    document.getElementById('calcMaxScore').textContent = maxScore;
    document.getElementById('calcPercentage').textContent = percentage;
}

// Tab Switcher
function switchTab(tabName) {
    const studentTab = document.getElementById('studentTabBtn');
    const staffTab = document.getElementById('staffTabBtn');
    const studentSection = document.getElementById('student-section');
    const staffSection = document.getElementById('staff-section');

    if (tabName === 'student') {
        studentTab.classList.add('active');
        staffTab.classList.remove('active');
        staffSection.style.display = 'none';
        studentSection.style.display = 'block';
    } else {
        staffTab.classList.add('active');
        studentTab.classList.remove('active');
        studentSection.style.display = 'none';
        staffSection.style.display = 'block';
    }
}

// Search Filter for Admin Table
function filterAdminTable() {
    const input = document.getElementById('adminSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#adminStudentList tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(input) ? '' : 'none';
    });
}

// Fetch and Render Student List for Admin
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
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${student.student_id}</strong></td>
                        <td>${student.full_name}</td>
                        <td>${student.student_class}</td>
                        <td><code>${student.pin_code || 'N/A'}</code></td>
                        <td>${student.usage_count} / ${student.max_usage}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-primary" onclick="resetPin('${student.student_id}')">Reset PIN</button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="deleteStudent('${student.student_id}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error('Failed to load student status list:', err);
    }
}

// Admin Actions: Reset PIN and Delete Record
async function resetPin(studentId) {
    if (!confirm(`Reset PIN checks for ${studentId}?`)) return;
    try {
        const res = await fetch('/api/admin/reset-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId })
        });
        const data = await res.json();
        alert(data.message);
        loadStudentStatuses();
    } catch (err) {
        alert('Failed to reset PIN.');
    }
}

async function deleteStudent(studentId) {
    if (!confirm(`Delete all records for ${studentId}? This action cannot be undone.`)) return;
    try {
        const res = await fetch('/api/admin/delete-student', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId })
        });
        const data = await res.json();
        alert(data.message);
        loadStudentStatuses();
    } catch (err) {
        alert('Failed to delete student.');
    }
}

// Student Search Submission
document.getElementById('studentLoginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentId = document.getElementById('studentId').value.trim();
    const pin = document.getElementById('pin').value.trim();
    const session = document.getElementById('studentSession').value;
    const term = document.getElementById('studentTerm').value;

    try {
        const response = await fetch('/api/check-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, pin, session, term })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('resName').textContent = data.student.name;
            document.getElementById('resId').textContent = data.student.id;
            document.getElementById('resClass').textContent = data.student.class;
            document.getElementById('resSession').textContent = data.student.session;
            document.getElementById('resTerm').textContent = data.student.term;
            document.getElementById('resRemaining').textContent = `${data.remainingChecks} attempt(s) remaining`;

            let totalObtained = 0;
            const tbody = document.getElementById('resultBody');
            tbody.innerHTML = '';

            data.results.forEach(item => {
                totalObtained += item.total;
                tbody.innerHTML += `
                    <tr>
                        <td>${item.subject}</td>
                        <td>${item.ca}</td>
                        <td>${item.exam}</td>
                        <td><strong>${item.total}</strong></td>
                        <td><strong>${item.grade}</strong></td>
                    </tr>`;
            });

            const maxPossible = data.results.length * 100;
            const percentage = maxPossible > 0 ? ((totalObtained / maxPossible) * 100).toFixed(2) : '0.00';

            document.getElementById('resTotalScore').textContent = `${totalObtained} / ${maxPossible}`;
            document.getElementById('resPercentage').textContent = percentage;

            document.getElementById('studentLoginForm').classList.add('hidden');
            document.getElementById('result-card').classList.remove('hidden');
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Could not connect to server.');
    }
});

function resetStudentForm() {
    document.getElementById('result-card').classList.add('hidden');
    document.getElementById('studentLoginForm').classList.remove('hidden');
    document.getElementById('studentLoginForm').reset();
}

// PNG Download
async function downloadResultAsImage() {
    const resultElement = document.getElementById('result-card');
    const studentId = document.getElementById('resId').textContent || 'Result';
    const canvas = await html2canvas(resultElement, { scale: 2 });
    const link = document.createElement('a');
    link.download = `${studentId}_Result.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// PDF Download
async function downloadResultPDF() {
    const { jsPDF } = window.jspdf;
    const resultElement = document.getElementById('result-card');
    const studentId = document.getElementById('resId').textContent || 'Result';

    const canvas = await html2canvas(resultElement, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
    pdf.save(`${studentId}_Result.pdf`);
}

function exportAdminResultsCSV() {
    window.location.href = '/api/admin/export-results';
}

// Admin Auth
document.getElementById('adminAuthForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (document.getElementById('adminPass').value === 'adminDGC') {
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

function generateStudentPin() {
    document.getElementById('generatedPin').value = Math.floor(100000 + Math.random() * 900000).toString();
}

// Submit Result Form
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

    const subjects = [];
    document.querySelectorAll('.subject-row').forEach(row => {
        const name = row.querySelector('.sub-name').value.trim();
        const ca = row.querySelector('.sub-ca').value;
        const exam = row.querySelector('.sub-exam').value;

        if (name && ca !== '' && exam !== '') {
            subjects.push({ subjectName: name, caScore: parseInt(ca), examScore: parseInt(exam) });
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
            generateSubjectFields();
            recalculatePercentage();
            loadStudentStatuses();
        }
    } catch (err) {
        alert('Failed to connect to server.');
    }
});