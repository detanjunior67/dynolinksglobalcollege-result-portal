// Subject Presets
const JSS_SUBJECTS = [
    "Mathematics",
    "English Language",
    "Basic Technology",
    "Home Economics",
    "Business Studies",
    "Religious Studies",
    "Social Studies",
    "Agricultural Science",
    "Nigerian Language",
    "French Language",
    "Physical and Health Education",
    "Civic Education",
    "Information Technology",
    "Creative Art",
    "History",
    "Entrepreneurship"
];

const SSS_COMPULSORY = [
    "Mathematics",
    "English Language",
    "Agricultural Science",
    "Civic Education",
    "Economics",
    "Marketing"
];

const SSS_DEPARTMENTS = {
    Science: ["Chemistry", "Physics", "Biology"],
    Arts: ["Literature in English", "Government", "Christian Religious Studies"],
    Commercial: ["Financial Accounting", "Commerce", "Literature in English"]
};

// State variable to track edit mode
let isEditingMode = false;

// Dynamic Subject Fields Generator
function generateSubjectFields(presetSubjects = []) {
    const container = document.getElementById('subjectsContainer');
    if (container) {
        container.innerHTML = '';
        for (let i = 1; i <= 20; i++) {
            const subjectName = presetSubjects[i - 1] || '';
            container.innerHTML += `
                <div class="form-row subject-row" style="margin-bottom: 10px;">
                    <div class="form-group" style="flex: 2;">
                        <input type="text" class="sub-name" value="${subjectName}" placeholder="Subject ${i} Name (e.g. Mathematics)" oninput="recalculatePercentage()">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="sub-ca" min="0" max="40" placeholder="CA (40)" oninput="recalculatePercentage()">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <input type="number" class="sub-exam" min="0" max="60" placeholder="Exam (60)" oninput="recalculatePercentage()">
                    </div>
                </div>`;
        }
        recalculatePercentage();
    }
}

// Handle Class Selection
function handleClassChange() {
    const select = document.getElementById('admClassSelect');
    const customInput = document.getElementById('admCustomClass');
    const deptGroup = document.getElementById('departmentGroup');
    const deptSelect = document.getElementById('admDepartmentSelect');
    const selectedClass = select.value;

    deptGroup.classList.add('hidden');
    deptSelect.required = false;
    deptSelect.value = '';

    if (selectedClass === 'Custom') {
        customInput.classList.remove('hidden');
        customInput.required = true;
        generateSubjectFields();
    } else {
        customInput.classList.add('hidden');
        customInput.required = false;
        customInput.value = '';

        if (['JSS1', 'JSS2', 'JSS3'].includes(selectedClass)) {
            generateSubjectFields(JSS_SUBJECTS);
        } else if (['SSS1', 'SSS2', 'SSS3'].includes(selectedClass)) {
            deptGroup.classList.remove('hidden');
            deptSelect.required = true;
            generateSubjectFields(SSS_COMPULSORY);
        } else {
            generateSubjectFields();
        }
    }
}

// Handle Department Selection for SSS Classes
function handleDepartmentChange() {
    const deptSelect = document.getElementById('admDepartmentSelect');
    const selectedDept = deptSelect.value;

    if (SSS_DEPARTMENTS[selectedDept]) {
        const fullSubjectList = [...SSS_COMPULSORY, ...SSS_DEPARTMENTS[selectedDept]];
        generateSubjectFields(fullSubjectList);
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

    const calcTotalScore = document.getElementById('calcTotalScore');
    const calcMaxScore = document.getElementById('calcMaxScore');
    const calcPercentage = document.getElementById('calcPercentage');

    if (calcTotalScore) calcTotalScore.textContent = totalScore;
    if (calcMaxScore) calcMaxScore.textContent = maxScore;
    if (calcPercentage) calcPercentage.textContent = percentage;
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

        studentSection.classList.add('active-section');
        studentSection.style.display = 'block';

        staffSection.classList.remove('active-section');
        staffSection.style.display = 'none';
    } else {
        staffTab.classList.add('active');
        studentTab.classList.remove('active');

        staffSection.classList.add('active-section');
        staffSection.style.display = 'block';

        studentSection.classList.remove('active-section');
        studentSection.style.display = 'none';
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
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #777;">No student results uploaded yet.</td></tr>`;
                return;
            }

            data.students.forEach(student => {
                const safeStudentId = encodeURIComponent(student.student_id);
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${student.student_id}</strong></td>
                        <td>${student.full_name}</td>
                        <td>${student.student_class}</td>
                        <td><code>${student.pin_code || 'N/A'}</code></td>
                        <td>${student.usage_count} / ${student.max_usage}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-primary" onclick="editStudent('${safeStudentId}')">Edit Scores</button>
                            <button type="button" class="btn btn-sm btn-warning" onclick="resetPin('${safeStudentId}')">Reset PIN</button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="deleteStudent('${safeStudentId}')">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error('Failed to load student status list:', err);
    }
}

// Edit Student Record Handler
async function editStudent(encodedStudentId) {
    const studentId = decodeURIComponent(encodedStudentId);
    try {
        const res = await fetch(`/api/admin/student/${encodeURIComponent(studentId)}`);
        const data = await res.json();

        if (data.success && data.student) {
            const student = data.student;
            isEditingMode = true;

            // Populate main fields
            document.getElementById('admStudentId').value = student.student_id;
            document.getElementById('admFullName').value = student.full_name;
            if (document.getElementById('admEmail')) {
                document.getElementById('admEmail').value = student.email || '';
            }
            if (document.getElementById('admSession')) {
                document.getElementById('admSession').value = student.session || '';
            }
            if (document.getElementById('admTerm')) {
                document.getElementById('admTerm').value = student.term || '';
            }
            document.getElementById('generatedPin').value = student.pin_code || '';

            // Set Class & Department options
            const classSelect = document.getElementById('admClassSelect');
            const rawClass = student.student_class || '';

            let baseClass = rawClass;
            let dept = '';

            if (rawClass.includes('(') && rawClass.includes(')')) {
                const parts = rawClass.split('(');
                baseClass = parts[0].trim();
                dept = parts[1].replace(')', '').trim();
            }

            if (['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'].includes(baseClass)) {
                classSelect.value = baseClass;
                handleClassChange();
                if (dept) {
                    const deptSelect = document.getElementById('admDepartmentSelect');
                    if (deptSelect) {
                        deptSelect.value = dept;
                        handleDepartmentChange();
                    }
                }
            } else {
                classSelect.value = 'Custom';
                handleClassChange();
                const customInput = document.getElementById('admCustomClass');
                if (customInput) customInput.value = baseClass;
            }

            // Populate subject scores
            const subjectRows = document.querySelectorAll('.subject-row');
            if (student.results && student.results.length > 0) {
                student.results.forEach((resItem, index) => {
                    if (subjectRows[index]) {
                        subjectRows[index].querySelector('.sub-name').value = resItem.subject || '';
                        subjectRows[index].querySelector('.sub-ca').value = resItem.ca !== undefined ? resItem.ca : '';
                        subjectRows[index].querySelector('.sub-exam').value = resItem.exam !== undefined ? resItem.exam : '';
                    }
                });
            }

            recalculatePercentage();

            // Change button label and scroll up to the editor form
            const submitBtn = document.querySelector('#addResultForm button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Student Result';

            document.getElementById('addResultForm').scrollIntoView({ behavior: 'smooth' });

        } else {
            alert(data.message || 'Could not fetch student record for editing.');
        }
    } catch (err) {
        console.error('Error fetching student details:', err);
        alert('Could not fetch student record for editing.');
    }
}

// Admin Actions: Reset PIN and Delete Record
async function resetPin(encodedStudentId) {
    const studentId = decodeURIComponent(encodedStudentId);
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

async function deleteStudent(encodedStudentId) {
    const studentId = decodeURIComponent(encodedStudentId);
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

// Submit Result Form (Handles Save and Edit updates)
document.getElementById('addResultForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const studentId = document.getElementById('admStudentId').value.trim();
    const fullName = document.getElementById('admFullName').value.trim();
    const email = document.getElementById('admEmail') ? document.getElementById('admEmail').value.trim() : '';

    const selectClass = document.getElementById('admClassSelect').value;
    const customClass = document.getElementById('admCustomClass').value.trim();
    const deptSelect = document.getElementById('admDepartmentSelect').value;

    let studentClass = selectClass === 'Custom' ? customClass : selectClass;
    if (['SSS1', 'SSS2', 'SSS3'].includes(selectClass) && deptSelect) {
        studentClass += ` (${deptSelect})`;
    }

    const session = document.getElementById('admSession').value;
    const term = document.getElementById('admTerm').value;
    const pin = document.getElementById('generatedPin').value.trim();

    if (!studentClass) {
        alert('Please select or type a class name.');
        return;
    }

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

    const payload = { studentId, fullName, email, studentClass, session, term, pin, subjects };
    const targetEndpoint = isEditingMode ? '/api/admin/update-student' : '/api/admin/add-full-result';
    const httpMethod = isEditingMode ? 'PUT' : 'POST';

    try {
        const res = await fetch(targetEndpoint, {
            method: httpMethod,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        alert(data.message);

        if (data.success) {
            isEditingMode = false;
            document.getElementById('addResultForm').reset();
            document.getElementById('generatedPin').value = '';
            document.getElementById('admCustomClass').classList.add('hidden');
            document.getElementById('departmentGroup').classList.add('hidden');

            const submitBtn = document.querySelector('#addResultForm button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Save Student Result';

            generateSubjectFields();
            recalculatePercentage();
            loadStudentStatuses();
        }
    } catch (err) {
        alert('Failed to connect to server.');
    }
});