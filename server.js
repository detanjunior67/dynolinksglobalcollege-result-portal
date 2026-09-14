const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
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

// Serve static frontend files
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
        console.error('Gmail API Email Error:', err.message);
    }
}

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
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://detanjunior67_db_user:Manuel528@cluster0.wosavjw.mongodb.net/dynolinks?retryWrites=true&w=majority";
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

        res.json({ success: true, message: 'Result and PIN saved successfully!', student: updatedStudent });

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
            });
        }

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

// Export Results CSV Endpoint (Fixed UTF-8 Encoding & BOM for Excel)
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

// Export Admission Enquiries CSV Endpoint (Fixed UTF-8 Encoding & BOM for Excel)
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

        res.json({
            success: true,
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
    try {
        const {
            fullName, sex, dob, state, town, lga, livesWith, parents, position, language,
            fatherOcc, motherOcc, address, fatherPhone, motherPhone, siblingsNo, siblingsNames,
            healthCondition, immunized, immunizedDisease, restrictedActivities, otherHealthInfo,
            parentSign, parentSignDate, classAdmitted, sssTrack, email, phone, category, message
        } = req.body;

        if (!fullName) {
            return res.status(400).json({ success: false, message: 'Full name is required.' });
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

        res.json({ success: true, message: 'Admission Form Submitted Successfully!' });

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
        });

    } catch (err) {
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

// Fallback route for SPA / static routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dynolinks Portal Server running on port ${PORT}`);
});