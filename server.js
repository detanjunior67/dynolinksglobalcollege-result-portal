const express = require('express');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const crypto = require('crypto');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { google } = require('googleapis');

const app = express();

// Middleware with increased payload size limits for large bulk uploads (50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static frontend files from both root and public directories
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Google OAuth2 & Gmail HTTP API Configuration
const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

const withTimeout = (promise, milliseconds, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds))
]);

// Helper function to send email using Gmail REST API (Bypasses SMTP completely)
async function sendEmail({ to, subject, html, replyTo }) {
    try {
        const senderEmail = process.env.EMAIL_USER || 'infodynolinks@gmail.com';
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        
        const messageParts = [
            `From: Dynolinks Portal <${senderEmail}>`,
            `To: ${to}`,
            ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            html
        ];
        
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
        });

        console.log(`Gmail API Email sent successfully. Message ID: ${res.data.id}`);
        return res.data;
    } catch (err) {
        console.error('Gmail API Email Error:', err.response?.data || err.message);
        throw err;
    }
}

app.post('/api/admin/login', async (req, res) => {
    const { password, surface = 'portal', deviceName = 'Unknown device' } = req.body || {};
    const expectedPassword = surface === 'cbt'
        ? (process.env.CBT_ADMIN_PASSWORD || 'cbtadmin')
        : (process.env.ADMIN_PASSWORD || 'adminDGC');

    if (!password || password !== expectedPassword) {
        return res.status(401).json({ success: false, message: 'Invalid Administrator Password!' });
    }

    const loginTime = new Date();
    sendEmail({
            to: process.env.EMAIL_USER || 'infodynolinks@gmail.com',
            subject: `Admin Login: ${surface === 'cbt' ? 'CBT Management Portal' : 'Result Portal'}`,
            html: `
                <h2>Administrator Login Notification</h2>
                <p><strong>Portal:</strong> ${surface === 'cbt' ? 'CBT Management Portal' : 'Result Portal'}</p>
                <p><strong>Time:</strong> ${loginTime.toLocaleString()}</p>
                <p><strong>IP address:</strong> ${req.ip || 'Unavailable'}</p>
                <p><strong>Device:</strong> ${deviceName}</p>
                <p><strong>User agent:</strong> ${req.get('user-agent') || 'Unavailable'}</p>
            `
        }).catch(err => console.error('Admin login notification failed:', err.response?.data || err.message));

    res.json({ success: true, emailSent: true });
});

// Helper function to format and grade subjects
const processSubjectScores = (subjects) => {
    if (!Array.isArray(subjects)) return [];
    return subjects
        .filter(sub => sub && ((sub.subjectName && sub.subjectName.trim() !== '') || (sub.subject && sub.subject.trim() !== '')))
        .map(sub => {
            const name = (sub.subjectName || sub.subject || '').trim();
            const caVal = Number(sub.caScore !== undefined ? sub.caScore : sub.ca) || 0;
            const examVal = Number(sub.examScore !== undefined ? sub.examScore : sub.exam) || 0;
            const total = caVal + examVal;

            let grade = 'F';
            if (total >= 70) grade = 'A';
            else if (total >= 60) grade = 'B';
            else if (total >= 50) grade = 'C';
            else if (total >= 45) grade = 'D';
            else if (total >= 40) grade = 'E';

            return {
                subject: name,
                ca: caVal,
                exam: examVal,
                total: total,
                grade: grade
            };
        });
};

// Helper function to safely escape CSV cell values
const sanitizeCsvField = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
};

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    throw new Error('MONGO_URI is required. Configure the same MongoDB URI locally and on the deployed host.');
}

try {
    const databaseTarget = new URL(MONGO_URI);
    console.log(`MongoDB target: ${databaseTarget.hostname}${databaseTarget.pathname}`);
} catch {
    throw new Error('MONGO_URI is not a valid MongoDB connection string.');
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to Cloud MongoDB Database Successfully!'))
    .catch(err => console.error('MongoDB Connection Error Detailed:', err.message));

// Student Schema
const StudentSchema = new mongoose.Schema({
    student_id: { type: String, required: true, unique: true },
    full_name: { type: String, required: true },
    email: { type: String, default: '' },
    student_class: { type: String, required: true },
    session: { type: String, required: true },
    term: { type: String, required: true },
    pin_code: { type: String, required: true },
    usage_count: { type: Number, default: 0 },
    max_usage: { type: Number, default: 3 },
    results: [{
        subject: String,
        ca: Number,
        exam: Number,
        total: Number,
        grade: String
    }]
}, { timestamps: true });

const Student = mongoose.model('Student', StudentSchema);

// Comprehensive Admission & Enquiry Schema
const EnquirySchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    sex: { type: String, default: '' },
    dob: { type: String, default: '' },
    state: { type: String, default: '' },
    town: { type: String, default: '' },
    lga: { type: String, default: '' },
    livesWith: { type: String, default: '' },
    parents: { type: String, default: '' },
    position: { type: String, default: '' },
    language: { type: String, default: '' },
    fatherOcc: { type: String, default: '' },
    motherOcc: { type: String, default: '' },
    address: { type: String, default: '' },
    fatherPhone: { type: String, default: '' },
    motherPhone: { type: String, default: '' },
    siblingsNo: { type: String, default: '0' },
    siblingsNames: { type: String, default: '' },
    healthCondition: { type: String, default: '' },
    immunized: { type: String, default: 'Yes' },
    immunizedDisease: { type: String, default: '' },
    restrictedActivities: { type: String, default: '' },
    otherHealthInfo: { type: String, default: '' },
    parentSign: { type: String, default: '' },
    parentSignDate: { type: String, default: '' },
    classAdmitted: { type: String, default: '' },
    sssTrack: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    category: { type: String, default: 'Admission Form' },
    message: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const Enquiry = mongoose.model('Enquiry', EnquirySchema);

const AdmissionPinSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, match: /^[A-Z0-9]{10}$/ },
    status: { type: String, enum: ['unused', 'used'], default: 'unused' },
    usedAt: { type: Date, default: null }
}, { timestamps: true });

const AdmissionPin = mongoose.model('AdmissionPin', AdmissionPinSchema);

// CBT Question Schema
const QuestionSchema = new mongoose.Schema({
    classKey: { type: String, required: true },
    subjectId: { type: String, required: true },
    qNumber: { type: Number },
    text: { type: String, required: true },
    options: [{ type: String }],
    correctIndex: { type: Number, required: true },
    points: { type: Number, default: 1 },
    customTime: { type: Number, default: 60 },
    hint: { type: String, default: '' }
}, { timestamps: true });

const Question = mongoose.model('Question', QuestionSchema);

// CBT Exam Result Schema
const CbtResultSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    classLevel: { type: String, required: true },
    totalPoints: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    grade: { type: String, default: 'F' },
    subjectBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: String, default: () => new Date().toLocaleString() }
}, { timestamps: true });

const CbtResult = mongoose.model('CbtResult', CbtResultSchema);

const buildStudentQuery = (studentId) => {
    const cleanId = decodeURIComponent(String(studentId)).trim();
    const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const queryConditions = [
        { student_id: cleanId },
        { student_id: new RegExp(`^${escapedId}$`, 'i') }
    ];
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
        queryConditions.push({ _id: cleanId });
    }
    return { $or: queryConditions };
};

// GET Single Student Record
app.get('/api/admin/student/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const student = await Student.findOne(buildStudentQuery(studentId));

        if (!student) {
            return res.status(404).json({ success: false, message: `Student record not found for ID: ${decodeURIComponent(studentId)}` });
        }

        res.json({ success: true, student });
    } catch (err) {
        console.error('Fetch student error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving student record for editing.' });
    }
});

// Admin Save/Update Result Endpoint
app.post('/api/admin/add-full-result', async (req, res) => {
    try {
        const { studentId, fullName, email, studentClass, session, term, pin, subjects } = req.body;

        if (!studentId || !fullName || !studentClass || !pin || !subjects || subjects.length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide all required student details and scores.' });
        }

        const formattedResults = processSubjectScores(subjects);

        if (formattedResults.length === 0) {
            return res.status(400).json({ success: false, message: 'Please include at least one subject with a valid name.' });
        }

        const cleanId = String(studentId).trim();
        const cleanPin = String(pin).trim();
        const studentEmail = email ? email.trim() : '';

        const updatedStudent = await Student.findOneAndUpdate(
            buildStudentQuery(cleanId),
            {
                student_id: cleanId,
                full_name: fullName.trim(),
                email: studentEmail,
                student_class: studentClass,
                session: session,
                term: term,
                pin_code: cleanPin,
                results: formattedResults
            },
            { upsert: true, new: true, runValidators: true }
        );

        if (studentEmail) {
            sendEmail({
                    to: studentEmail,
                    subject: `Academic Result Published - ${session} (${term})`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; color: #0d233a;">
                            <h2 style="color: #0288d1; border-bottom: 2px solid #ffb300; padding-bottom: 8px;">
                                Dynolinks Academic Result Notification
                            </h2>
                            <p>Dear <strong>${fullName.trim()}</strong>,</p>
                            <p>Your academic results for <strong>${session} - ${term}</strong> have been updated on the portal.</p>
                            <div style="background: #f4f7f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                <p style="margin: 5px 0;"><strong>Student ID:</strong> ${cleanId}</p>
                                <p style="margin: 5px 0;"><strong>Access PIN:</strong> ${cleanPin}</p>
                                <p style="margin: 5px 0;"><strong>Class:</strong> ${studentClass}</p>
                            </div>
                            <p>For enquiries, reach out to us via WhatsApp at <strong>+234 807 983 1549</strong>.</p>
                        </div>
                    `
                }).catch(emailError => console.error('Result notification email failed:', emailError.response?.data || emailError.message));
        }

        res.json({
            success: true,
            emailSent: true,
            message: emailSent ? 'Result and PIN saved successfully!' : 'Result and PIN saved.',
            student: updatedStudent
        });

    } catch (err) {
        console.error('Save student error detailed:', err);
        res.status(500).json({ success: false, message: 'Failed to save student record.' });
    }
});

// Admin Bulk Upload Endpoint
app.post('/api/admin/bulk-upload', async (req, res) => {
    try {
        const { students } = req.body;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid student data received for bulk upload.' });
        }

        let processCount = 0;

        for (const item of students) {
            try {
                const cleanId = item.studentId ? String(item.studentId).trim() : (item.student_id ? String(item.student_id).trim() : '');
                const cleanPin = item.pin ? String(item.pin).trim() : (item.pin_code ? String(item.pin_code).trim() : '');
                const fullName = item.fullName || item.full_name || '';

                if (!cleanId || !fullName) continue;

                const formattedResults = processSubjectScores(item.subjects || []);

                await Student.findOneAndUpdate(
                    buildStudentQuery(cleanId),
                    {
                        student_id: cleanId,
                        full_name: String(fullName).trim(),
                        student_class: String(item.studentClass || item.student_class || '').trim(),
                        session: String(item.session || '').trim(),
                        term: String(item.term || '').trim(),
                        pin_code: cleanPin,
                        results: formattedResults
                    },
                    { upsert: true, new: true, runValidators: true }
                );

                processCount++;
            } catch (singleItemErr) {
                console.error(`Failed to process student item during bulk upload:`, singleItemErr);
            }
        }

        if (processCount === 0) {
            return res.status(400).json({ success: false, message: 'Failed to upload any records. Ensure fields like Student ID and Full Name are populated.' });
        }

        return res.status(200).json({
            success: true,
            message: `Bulk upload completed successfully! Uploaded ${processCount} student record(s).`
        });

    } catch (err) {
        console.error('Bulk upload server error:', err);
        return res.status(500).json({ success: false, message: 'Server error processing bulk result upload.' });
    }
});

// Admin PUT Update Endpoint
app.put('/api/admin/update-student', async (req, res) => {
    try {
        const { studentId, fullName, email, studentClass, session, term, pin, subjects } = req.body;

        if (!studentId) {
            return res.status(400).json({ success: false, message: 'Student ID is required for update.' });
        }

        const cleanId = String(studentId).trim();
        const updateData = { student_id: cleanId };

        if (fullName) updateData.full_name = fullName.trim();
        if (email !== undefined) updateData.email = email.trim();
        if (studentClass) updateData.student_class = studentClass;
        if (session) updateData.session = session;
        if (term) updateData.term = term;
        if (pin) updateData.pin_code = String(pin).trim();

        if (subjects && Array.isArray(subjects)) {
            updateData.results = processSubjectScores(subjects);
        }

        const updatedStudent = await Student.findOneAndUpdate(
            buildStudentQuery(cleanId),
            { $set: updateData },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ 
            success: true, 
            message: 'Student record saved/updated successfully!', 
            student: updatedStudent 
        });

    } catch (err) {
        console.error('Update student error:', err);
        res.status(500).json({ success: false, message: 'Failed to update student record.' });
    }
});

// Admin List Endpoint
app.get('/api/admin/student-status', async (req, res) => {
    try {
        const students = await Student.find({}, 'student_id full_name email student_class pin_code usage_count max_usage results session term').sort({ createdAt: -1 });
        res.json({ success: true, students });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching student list.' });
    }
});

// Reset PIN Endpoint
app.post('/api/admin/reset-pin', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required.' });
        await Student.findOneAndUpdate(buildStudentQuery(studentId), { usage_count: 0 });
        res.json({ success: true, message: `PIN check count reset to 0 for ${studentId}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not reset PIN.' });
    }
});

// Delete Student Endpoint
app.delete('/api/admin/delete-student', async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required.' });
        await Student.deleteOne(buildStudentQuery(studentId));
        res.json({ success: true, message: `Student ${studentId} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete student.' });
    }
});

// Export Results CSV Endpoint
app.get('/api/admin/export-results', async (req, res) => {
    try {
        const students = await Student.find({});
        const headers = ['Student ID', 'Full Name', 'Email', 'Class', 'Session', 'Term', 'PIN', 'Subject', 'CA Score', 'Exam Score', 'Total Score', 'Grade'];
        
        let csv = '\uFEFF' + headers.map(sanitizeCsvField).join(',') + '\n';

        students.forEach(s => {
            if (s.results && s.results.length > 0) {
                s.results.forEach(r => {
                    const row = [
                        sanitizeCsvField(s.student_id),
                        sanitizeCsvField(s.full_name),
                        sanitizeCsvField(s.email),
                        sanitizeCsvField(s.student_class),
                        sanitizeCsvField(s.session),
                        sanitizeCsvField(s.term),
                        sanitizeCsvField(s.pin_code),
                        sanitizeCsvField(r.subject),
                        r.ca || 0,
                        r.exam || 0,
                        r.total || 0,
                        sanitizeCsvField(r.grade)
                    ];
                    csv += row.join(',') + '\n';
                });
            } else {
                const row = [
                    sanitizeCsvField(s.student_id),
                    sanitizeCsvField(s.full_name),
                    sanitizeCsvField(s.email),
                    sanitizeCsvField(s.student_class),
                    sanitizeCsvField(s.session),
                    sanitizeCsvField(s.term),
                    sanitizeCsvField(s.pin_code),
                    '""', 0, 0, 0, '""'
                ];
                csv += row.join(',') + '\n';
            }
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="Dynolinks_Results_Export.csv"');
        res.status(200).send(csv);
    } catch (err) {
        console.error('Export results error:', err);
        res.status(500).send('Error generating CSV.');
    }
});

// Export Admission Enquiries CSV Endpoint
app.get('/api/admin/export-enquiries', async (req, res) => {
    try {
        const enquiries = await Enquiry.find({}).sort({ createdAt: -1 });

        const headers = [
            'Full Name', 'Sex', 'DOB', 'State', 'Town', 'LGA', 'Class Admitted',
            'SSS Track', 'Email', 'Phone / Father Phone', 'Mother Phone', 'Parents / Guardian',
            'Father Occupation', 'Mother Occupation', 'Address', 'Health Condition',
            'Immunized', 'Category', 'Date Submitted'
        ];

        let csv = '\uFEFF' + headers.map(sanitizeCsvField).join(',') + '\n';

        enquiries.forEach(e => {
            const row = [
                sanitizeCsvField(e.fullName),
                sanitizeCsvField(e.sex),
                sanitizeCsvField(e.dob),
                sanitizeCsvField(e.state),
                sanitizeCsvField(e.town),
                sanitizeCsvField(e.lga),
                sanitizeCsvField(e.classAdmitted),
                sanitizeCsvField(e.sssTrack),
                sanitizeCsvField(e.email),
                sanitizeCsvField(e.fatherPhone || e.phone),
                sanitizeCsvField(e.motherPhone),
                sanitizeCsvField(e.parents),
                sanitizeCsvField(e.fatherOcc),
                sanitizeCsvField(e.motherOcc),
                sanitizeCsvField(e.address),
                sanitizeCsvField(e.healthCondition),
                sanitizeCsvField(e.immunized),
                sanitizeCsvField(e.category),
                sanitizeCsvField(e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '')
            ];
            csv += row.join(',') + '\n';
        });

        const currentDate = new Date().toISOString().split('T')[0];
        const fileName = `Dynolinks_Admission_Enquiries_${currentDate}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(csv);
    } catch (err) {
        console.error('Export enquiries error:', err);
        res.status(500).send('Error generating enquiries CSV.');
    }
});

// Check Student Result Endpoint
app.post('/api/check-result', async (req, res) => {
    try {
        const { studentId, pin, session, term } = req.body;

        if (!studentId || !pin || !session || !term) {
            return res.status(400).json({ success: false, message: 'Please provide all search credentials.' });
        }

        const student = await Student.findOne({
            student_id: new RegExp(`^${studentId.trim()}$`, 'i'),
            pin_code: pin.trim(),
            session: session,
            term: term
        });

        if (!student) {
            return res.status(400).json({ success: false, message: 'Invalid Student ID, Access PIN, or Session/Term selection.' });
        }

        if (student.usage_count >= student.max_usage) {
            return res.status(403).json({ success: false, message: 'PIN check limit reached (Maximum 3 attempts allowed).' });
        }

        student.usage_count += 1;
        await student.save();

        const checkTime = new Date();
        const resultRows = (student.results || []).map(result => `
                <tr>
                    <td>${result.subject || ''}</td>
                    <td>${result.ca ?? 0}</td>
                    <td>${result.exam ?? 0}</td>
                    <td>${result.total ?? 0}</td>
                    <td>${result.grade || ''}</td>
                </tr>
            `).join('');
        sendEmail({
                to: process.env.EMAIL_USER || 'infodynolinks@gmail.com',
                subject: `Student Result Checked: ${student.student_id}`,
                html: `
                    <h2>Student Result Check Notification</h2>
                    <p>A student successfully checked an academic result.</p>
                    <p><strong>Student:</strong> ${student.full_name}</p>
                    <p><strong>Student ID:</strong> ${student.student_id}</p>
                    <p><strong>Email:</strong> ${student.email || 'Not provided'}</p>
                    <p><strong>Class:</strong> ${student.student_class}</p>
                    <p><strong>Session:</strong> ${student.session}</p>
                    <p><strong>Term:</strong> ${student.term}</p>
                    <p><strong>Checks used:</strong> ${student.usage_count} of ${student.max_usage}</p>
                    <p><strong>Checks remaining:</strong> ${student.max_usage - student.usage_count}</p>
                    <p><strong>Time:</strong> ${checkTime.toLocaleString()}</p>
                    <table border="1" cellpadding="6" cellspacing="0">
                        <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th></tr></thead>
                        <tbody>${resultRows || '<tr><td colspan="5">No subject results</td></tr>'}</tbody>
                    </table>
                `
            }).catch(emailError => console.error('Result check notification failed:', emailError.response?.data || emailError.message));

        res.json({
            success: true,
            emailSent: true,
            student: {
                id: student.student_id,
                name: student.full_name,
                email: student.email,
                class: student.student_class,
                session: student.session,
                term: term
            },
            remainingChecks: student.max_usage - student.usage_count,
            results: student.results.map(r => ({
                subject: r.subject,
                ca: r.ca,
                exam: r.exam,
                total: r.total,
                grade: r.grade
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving academic results.' });
    }
});

// Admission Form / Enquiry API Endpoint
app.post('/api/enquiries', async (req, res) => {
    let reservedPin = null;
    try {
        const {
            fullName, sex, dob, state, town, lga, livesWith, parents, position, language,
            fatherOcc, motherOcc, address, fatherPhone, motherPhone, siblingsNo, siblingsNames,
            healthCondition, immunized, immunizedDisease, restrictedActivities, otherHealthInfo,
            parentSign, parentSignDate, classAdmitted, sssTrack, email, phone, category, message, admissionPin
        } = req.body;

        if (!fullName) {
            return res.status(400).json({ success: false, message: 'Full name is required.' });
        }

        const cleanPin = String(admissionPin || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{10}$/.test(cleanPin)) {
            return res.status(400).json({ success: false, message: 'A valid 10-character admission PIN is required.' });
        }

        reservedPin = await AdmissionPin.findOneAndUpdate(
            { code: cleanPin, status: 'unused' },
            { $set: { status: 'used', usedAt: new Date() } },
            { new: true }
        );
        if (!reservedPin) {
            return res.status(400).json({ success: false, message: 'PIN is invalid or has already been used.' });
        }

        const newEnquiry = new Enquiry({
            fullName: fullName.trim(),
            sex: sex || '',
            dob: dob || '',
            state: state || '',
            town: town || '',
            lga: lga || '',
            livesWith: livesWith || '',
            parents: parents || '',
            position: position || '',
            language: language || '',
            fatherOcc: fatherOcc || '',
            motherOcc: motherOcc || '',
            address: address || '',
            fatherPhone: fatherPhone || phone || '',
            motherPhone: motherPhone || '',
            siblingsNo: siblingsNo || '0',
            siblingsNames: siblingsNames || '',
            healthCondition: healthCondition || '',
            immunized: immunized || 'Yes',
            immunizedDisease: immunizedDisease || '',
            restrictedActivities: restrictedActivities || '',
            otherHealthInfo: otherHealthInfo || '',
            parentSign: parentSign || '',
            parentSignDate: parentSignDate || '',
            classAdmitted: classAdmitted || '',
            sssTrack: sssTrack || '',
            email: email || '',
            phone: phone || fatherPhone || '',
            category: category || 'Admission Form',
            message: message || `Admission form submitted for ${classAdmitted}`
        });

        await newEnquiry.save();

        const recipientEmail = process.env.EMAIL_USER || 'infodynolinks@gmail.com';
        sendEmail({
                to: recipientEmail,
                replyTo: email || undefined,
                subject: `New Admission Form: ${fullName} (${classAdmitted})`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #0F172A;">
                        <h3 style="color: #0284C7; border-bottom: 2px solid #E11D48; padding-bottom: 8px;">
                            New Admission Form Submitted
                        </h3>
                        <p><strong>Student Name:</strong> ${fullName}</p>
                        <p><strong>Class Admitted:</strong> ${classAdmitted} ${sssTrack ? `(${sssTrack})` : ''}</p>
                        <p><strong>Parents / Guardian:</strong> ${parents}</p>
                        <p><strong>Father Phone:</strong> ${fatherPhone}</p>
                        <p><strong>Mother Phone:</strong> ${motherPhone}</p>
                        <p><strong>Address:</strong> ${address}</p>
                    </div>
                `
            }).catch(emailError => console.error('Admission notification email failed:', emailError.response?.data || emailError.message));

        res.json({
            success: true,
            emailSent: true,
            message: 'Admission Form Submitted Successfully!'
        });

    } catch (err) {
        if (reservedPin) {
            await AdmissionPin.updateOne(
                { _id: reservedPin._id },
                { $set: { status: 'unused' }, $unset: { usedAt: 1 } }
            ).catch(resetError => console.error('Admission PIN rollback failed:', resetError));
        }
        console.error('Enquiry Save Error:', err);
        res.status(500).json({ success: false, message: 'Failed to record admission form.' });
    }
});

// Admin Enquiries List Endpoint
app.get('/api/admin/enquiries', async (req, res) => {
    try {
        const enquiries = await Enquiry.find({}).sort({ createdAt: -1 });
        res.json({ success: true, enquiries });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch enquiries.' });
    }
});

app.get('/api/admin/admission-pins', async (req, res) => {
    try {
        const pins = await AdmissionPin.find({}).sort({ createdAt: -1 });
        res.json({ success: true, pins });
    } catch (err) {
        console.error('Fetch admission PINs error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch admission PINs.' });
    }
});

app.post('/api/admin/admission-pins', async (req, res) => {
    try {
        const requestedCode = String(req.body?.code || '').trim().toUpperCase();
        const code = requestedCode || crypto.randomBytes(8).toString('hex').slice(0, 10).toUpperCase();

        if (!/^[A-Z0-9]{10}$/.test(code)) {
            return res.status(400).json({ success: false, message: 'PIN must contain exactly 10 letters or numbers.' });
        }

        const pin = await AdmissionPin.create({ code });
        res.status(201).json({ success: true, pin });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'That PIN already exists. Use another code.' });
        }
        console.error('Create admission PIN error:', err);
        res.status(500).json({ success: false, message: 'Failed to create admission PIN.' });
    }
});

app.post('/api/admission-pins/verify', async (req, res) => {
    try {
        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{10}$/.test(code)) {
            return res.status(400).json({ success: false, message: 'Enter a valid 10-character PIN.' });
        }

        const pin = await AdmissionPin.findOne({ code, status: 'unused' }).select('_id code status');
        if (!pin) {
            return res.status(400).json({ success: false, message: 'PIN is invalid or has already been used.' });
        }

        res.json({ success: true, message: 'PIN accepted.' });
    } catch (err) {
        console.error('Verify admission PIN error:', err);
        res.status(500).json({ success: false, message: 'Could not verify admission PIN.' });
    }
});

// CBT QUESTIONS API ENDPOINTS

// GET questions (Supports optional filtering by classKey and subjectId)
app.get('/api/questions', async (req, res) => {
    try {
        const { classKey, subjectId } = req.query;
        const filter = {};
        if (classKey) filter.classKey = classKey;
        if (subjectId) filter.subjectId = subjectId;

        const questions = await Question.find(filter).sort({ qNumber: 1 });
        res.json(questions);
    } catch (err) {
        console.error('Error fetching questions:', err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// POST a new CBT question
app.post('/api/questions', async (req, res) => {
    try {
        const newQuestion = new Question(req.body);
        const saved = await newQuestion.save();
        res.status(201).json(saved);
    } catch (err) {
        console.error('Error saving question:', err);
        res.status(400).json({ error: err.message });
    }
});

// PUT update an existing CBT question
app.put('/api/questions/:id', async (req, res) => {
    try {
        const updatedQuestion = await Question.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updatedQuestion) {
            return res.status(404).json({ error: 'Question not found' });
        }
        res.json(updatedQuestion);
    } catch (err) {
        console.error('Error updating question:', err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE a CBT question
app.delete('/api/questions/:id', async (req, res) => {
    try {
        const deletedQuestion = await Question.findByIdAndDelete(req.params.id);
        if (!deletedQuestion) {
            return res.status(404).json({ error: 'Question not found' });
        }
        res.json({ success: true, message: 'Question deleted successfully' });
    } catch (err) {
        console.error('Error deleting question:', err);
        res.status(500).json({ error: err.message });
    }
});

function decodeHtmlEntities(text) {
    return String(text || '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&rsquo;/g, "'")
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&nbsp;/g, ' ');
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function toFourOptionMcq(stem, correct, incorrects) {
    const uniqueWrong = [...new Set((incorrects || []).map(x => String(x).trim()).filter(Boolean))]
        .filter(opt => opt.toLowerCase() !== String(correct).trim().toLowerCase())
        .slice(0, 3);
    while (uniqueWrong.length < 3) {
        uniqueWrong.push(`Not a valid statement about this topic (${uniqueWrong.length + 1})`);
    }
    const options = shuffleArray([String(correct).trim(), ...uniqueWrong]).slice(0, 4);
    return {
        text: String(stem).trim(),
        options,
        correctIndex: Math.max(0, options.indexOf(String(correct).trim()))
    };
}

function mapOnlineQuestionCategory(subjectName) {
    const s = (subjectName || '').toLowerCase();
    if (s.includes('math')) return { trivia: 'science_mathematics', opentdb: 19 };
    if (s.includes('english') || s.includes('literature') || s.includes('language')) return { trivia: 'arts_and_literature', opentdb: 10 };
    if (s.includes('physics') || s.includes('chem') || s.includes('bio') || s.includes('scien')) return { trivia: 'science', opentdb: 17 };
    if (s.includes('geo')) return { trivia: 'geography', opentdb: 22 };
    if (s.includes('hist') || s.includes('civic') || s.includes('social')) return { trivia: 'history', opentdb: 23 };
    return { trivia: 'general_knowledge', opentdb: 9 };
}

function matchesTopic(text, topic) {
    const hay = String(text || '').toLowerCase();
    const words = String(topic || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!words.length) return hay.includes(String(topic || '').toLowerCase());
    return words.some(w => hay.includes(w));
}

async function fetchRemoteJson(url) {
    const res = await withTimeout(fetch(url, {
        headers: {
            'User-Agent': 'DynolinksCBT/1.0 (school result portal; infodynolinks@gmail.com)',
            Accept: 'application/json'
        }
    }), 6000, 'Online question source');
    if (!res.ok) throw new Error(`Request failed ${res.status} for ${url}`);
    return res.json();
}

async function fetchTriviaApiQuestions(subjectName, topic, limit) {
    const { trivia } = mapOnlineQuestionCategory(subjectName);
    const url = `https://the-trivia-api.com/v2/questions?limit=${Math.min(50, Math.max(limit * 5, 10))}&categories=${encodeURIComponent(trivia)}`;
    const data = await fetchRemoteJson(url);
    const items = Array.isArray(data) ? data : [];
    return items.map((q) => {
        const stem = q.question && q.question.text ? q.question.text : q.question;
        return toFourOptionMcq(
            decodeHtmlEntities(stem),
            decodeHtmlEntities(q.correctAnswer),
            (q.incorrectAnswers || []).map(decodeHtmlEntities)
        );
    }).filter(q => q.text);
}

async function fetchOpenTdbQuestions(subjectName, limit) {
    const { opentdb } = mapOnlineQuestionCategory(subjectName);
    const url = `https://opentdb.com/api.php?amount=${Math.min(20, Math.max(limit, 5))}&category=${opentdb}&type=multiple`;
    const data = await fetchRemoteJson(url);
    return (data.results || []).map((q) => toFourOptionMcq(
        decodeHtmlEntities(q.question),
        decodeHtmlEntities(q.correct_answer),
        (q.incorrect_answers || []).map(decodeHtmlEntities)
    )).filter(q => q.text);
}

function splitWikiSentences(extract) {
    return String(extract || '')
        .replace(/\n+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length >= 35 && s.length <= 220 && !s.includes('==') && !s.startsWith('Coordinates'));
}

async function fetchWikipediaQuestions(topic, subjectName, classLabel, count) {
    const query = `${topic} ${subjectName}`.trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=8&format=json`;
    const searchData = await fetchRemoteJson(searchUrl);
    const hits = (searchData.query && searchData.query.search) || [];
    const facts = [];

    for (const hit of hits.slice(0, 5)) {
        const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(hit.title)}&format=json`;
        const pageData = await fetchRemoteJson(pageUrl);
        const pages = pageData.query && pageData.query.pages ? Object.values(pageData.query.pages) : [];
        pages.forEach((page) => {
            splitWikiSentences(page.extract).forEach((sentence) => {
                facts.push({ title: page.title || hit.title, sentence });
            });
        });
    }

    const unique = [];
    const seen = new Set();
    facts.forEach((f) => {
        const key = f.sentence.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(f);
        }
    });

    const questions = [];
    for (let i = 0; i < unique.length && questions.length < count + 4; i++) {
        const fact = unique[i];
        const distractors = unique
            .filter((_, j) => j !== i)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(d => d.sentence);
        if (distractors.length < 3) continue;
        questions.push(toFourOptionMcq(
            `According to materials on "${topic}" (${classLabel} ${subjectName} — ${fact.title}), which statement is correct?`,
            fact.sentence,
            distractors
        ));
    }
    return questions;
}

function rankOnlineQuestions(questions, topic, needed) {
    const scored = questions.map((q) => {
        const blob = `${q.text} ${q.options.join(' ')}`;
        return { q, score: matchesTopic(blob, topic) ? 2 : 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    const picked = [];
    const seen = new Set();
    scored.forEach(({ q }) => {
        const key = q.text.toLowerCase();
        if (seen.has(key) || picked.length >= needed) return;
        seen.add(key);
        picked.push(q);
    });
    return picked;
}

function extractJsonObject(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('AI provider returned invalid JSON.');
    return JSON.parse(raw.slice(start, end + 1));
}

function normalizeGeneratedQuestions(value, count) {
    const items = Array.isArray(value) ? value : value && Array.isArray(value.questions) ? value.questions : [];
    return items.map((item) => {
        const options = Array.isArray(item.options) ? item.options.map(option => String(option).trim()).filter(Boolean).slice(0, 4) : [];
        const correctIndex = Number(item.correctIndex);
        if (!item.text || options.length !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
        return {
            text: String(item.text).trim(),
            options,
            correctIndex
        };
    }).filter(Boolean).slice(0, count);
}

function buildAiQuestionPrompt({ classLabel, subjectName, topic, count }) {
    return `Create ${count} original four-option multiple-choice questions for ${classLabel}, subject ${subjectName}, on the syllabus topic "${topic}".\nReturn JSON only in this exact shape: {"questions":[{"text":"...","options":["...","...","...","..."],"correctIndex":0}]}.\nEach question must have exactly four distinct options, one unambiguous correct answer, and correctIndex must be a zero-based integer. Match the stated class level. Do not include markdown or explanations.`;
}

async function fetchChatGptQuestions(params) {
    if (!process.env.OPENAI_API_KEY) return [];
    const response = await withTimeout(fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You generate accurate school examination questions and follow JSON schemas exactly.' },
                { role: 'user', content: buildAiQuestionPrompt(params) }
            ]
        })
    }), 15000, 'ChatGPT');
    if (!response.ok) throw new Error(`ChatGPT request failed with status ${response.status}.`);
    const data = await response.json();
    return normalizeGeneratedQuestions(extractJsonObject(data.choices?.[0]?.message?.content), params.count);
}

async function fetchGeminiQuestions(params) {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return [];
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await withTimeout(fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildAiQuestionPrompt(params) }] }],
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
        })
    }), 15000, 'Google Gemini');
    if (!response.ok) throw new Error(`Google Gemini request failed with status ${response.status}.`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
    return normalizeGeneratedQuestions(extractJsonObject(text), params.count);
}

// Ask configured AI providers first, then use public sources to fill any gaps.
app.post('/api/cbt/generate-questions', async (req, res) => {
    try {
        const { classLabel, subjectName, topic, topics } = req.body || {};
        const count = Math.min(20, Math.max(1, parseInt(req.body && req.body.count, 10) || 5));

        const topicList = Array.isArray(topics)
            ? topics.map(item => String(item).trim()).filter(Boolean)
            : String(topic || '').split(',').map(item => item.trim()).filter(Boolean);
        if (!topicList.length) {
            return res.status(400).json({ error: 'Topic is required to search related questions online.' });
        }

        const label = classLabel || 'Secondary School';
        const subject = subjectName || 'General Studies';
        const focus = topicList.join(', ');
        const aiParams = { classLabel: label, subjectName: subject, topic: focus, count };

        const aiSettled = await Promise.allSettled([
            fetchChatGptQuestions(aiParams),
            fetchGeminiQuestions(aiParams)
        ]);

        const aiQuestions = [];
        aiSettled.forEach((result) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                aiQuestions.push(...result.value);
            } else if (result.status === 'rejected') {
                console.warn('AI question provider failed:', result.reason && result.reason.message);
            }
        });

        let questions = rankOnlineQuestions(aiQuestions, focus, count);
        if (questions.length >= count) {
            return res.json({
                source: 'ai',
                topic: focus,
                questions
            });
        }

        const onlineSettled = await Promise.allSettled([
            fetchTriviaApiQuestions(subject, focus, count),
            fetchOpenTdbQuestions(subject, count),
            fetchWikipediaQuestions(focus, subject, label, count)
        ]);

        onlineSettled.forEach((result) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                aiQuestions.push(...result.value);
            } else if (result.status === 'rejected') {
                console.warn('Online question source failed:', result.reason && result.reason.message);
            }
        });

        questions = rankOnlineQuestions(aiQuestions, focus, count);
        if (!questions.length) {
            return res.status(502).json({ error: 'No questions were generated. Configure OPENAI_API_KEY or GOOGLE_AI_API_KEY, then try again.' });
        }

        res.json({
            source: process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY ? 'ai-and-online' : 'online',
            topic: focus,
            questions
        });
    } catch (err) {
        console.error('AI question generation error:', err);
        res.status(500).json({ error: 'Failed to search and generate questions online.' });
    }
});

// CBT RESULTS API ENDPOINTS

// GET all completed CBT exam results
app.get('/api/cbt-results', async (req, res) => {
    try {
        const results = await CbtResult.find({}).sort({ createdAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve CBT results', details: err.message });
    }
});

// POST save completed CBT test submission
app.post('/api/cbt-results', async (req, res) => {
    try {
        const cbtResult = new CbtResult(req.body);
        const saved = await cbtResult.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: 'Failed to save CBT result', details: err.message });
    }
});

// GET export CBT exam results as CSV
app.get('/api/admin/export-cbt-results', async (req, res) => {
    try {
        const results = await CbtResult.find({}).sort({ createdAt: -1 });
        const headers = ['Student ID', 'Student Name', 'Class Level', 'Total Points', 'Max Points', 'Percentage', 'Grade', 'Date Submitted'];
        
        let csv = '\uFEFF' + headers.map(sanitizeCsvField).join(',') + '\n';

        results.forEach(r => {
            const row = [
                sanitizeCsvField(r.studentId),
                sanitizeCsvField(r.studentName),
                sanitizeCsvField(r.classLevel),
                r.totalPoints || 0,
                r.maxPoints || 0,
                sanitizeCsvField(`${r.percentage}%`),
                sanitizeCsvField(r.grade),
                sanitizeCsvField(r.timestamp || (r.createdAt ? new Date(r.createdAt).toLocaleString() : ''))
            ];
            csv += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="Dynolinks_CBT_Results_${Date.now()}.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        console.error('Export CBT results error:', err);
        res.status(500).send('Error generating CBT results CSV.');
    }
});

// Fallback route for SPA / static file serving
app.get('*', (req, res) => {
    const cbtFile = path.join(__dirname, 'cbt_8.html');
    if (fs.existsSync(cbtFile)) {
        return res.sendFile(cbtFile);
    }
    res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dynolinks Portal Server running on port ${PORT}`);
});

// POST multiple CBT questions in one database operation
app.post('/api/questions/bulk', async (req, res) => {
    try {
        const { classKey, subjectId, questions } = req.body || {};
        if (!classKey || !subjectId || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Class, subject, and at least one question are required.' });
        }

        const documents = questions.map((question, index) => ({
            classKey,
            subjectId,
            qNumber: index + 1,
            text: question.text,
            options: question.options,
            correctIndex: question.correctIndex,
            points: question.points,
            customTime: question.customTime,
            hint: question.hint || ''
        }));
        const saved = await Question.insertMany(documents, { ordered: true });
        res.status(201).json(saved);
    } catch (err) {
        console.error('Error bulk saving questions:', err);
        res.status(400).json({ error: err.message });
    }
});