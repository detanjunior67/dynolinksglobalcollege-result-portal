const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

// Middleware[cite: 3]
app.use(express.json());[cite: 3]
app.use(express.urlencoded({ extended: true }));[cite: 3]

// CORS middleware[cite: 3]
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');[cite: 3]
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');[cite: 3]
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');[cite: 3]
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);[cite: 3]
    }
    next();
});

// Serve static frontend files[cite: 3]
app.use(express.static(path.join(__dirname, 'public')));[cite: 3]

// Nodemailer Gmail Transporter Configuration[cite: 3]
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',[cite: 3]
    port: 587,[cite: 3]
    secure: false, // false for port 587[cite: 3]
    auth: {
        user: process.env.EMAIL_USER || 'infodynolinks@gmail.com',[cite: 3]
        pass: process.env.EMAIL_PASS || 'rckcxosjytwobqmv'[cite: 3]
    },
    tls: {
        rejectUnauthorized: false[cite: 3]
    }
});

// Verify connection configuration on startup[cite: 3]
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Connection Error:', error);[cite: 3]
    } else {
        console.log('Nodemailer SMTP Transporter ready to send emails via Gmail.');[cite: 3]
    }
});

// MongoDB Connection[cite: 3]
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://detanjunior67_db_user:Manuel528@cluster0.wosavjw.mongodb.net/dynolinks?retryWrites=true&w=majority";[cite: 3]
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to Cloud MongoDB Database Successfully!'))[cite: 3]
    .catch(err => console.error('MongoDB Connection Error Detailed:', err));[cite: 3]

// Updated Student Schema with Email[cite: 3]
const StudentSchema = new mongoose.Schema({
    student_id: { type: String, required: true, unique: true },[cite: 3]
    full_name: { type: String, required: true },[cite: 3]
    email: { type: String, default: '' }, // Added Gmail/Email field
    student_class: { type: String, required: true },[cite: 3]
    session: { type: String, required: true },[cite: 3]
    term: { type: String, required: true },[cite: 3]
    pin_code: { type: String, required: true },[cite: 3]
    usage_count: { type: Number, default: 0 },[cite: 3]
    max_usage: { type: Number, default: 3 },[cite: 3]
    results: [{
        subject: String,
        ca: Number,
        exam: Number,
        total: Number,
        grade: String
    }]
}, { timestamps: true });[cite: 3]

const Student = mongoose.model('Student', StudentSchema);[cite: 3]

// Enquiry Schema[cite: 3]
const EnquirySchema = new mongoose.Schema({
    fullName: { type: String, required: true },[cite: 3]
    email: { type: String, required: true },[cite: 3]
    phone: { type: String, required: true },[cite: 3]
    category: { type: String, required: true },[cite: 3]
    childClass: { type: String, default: 'N/A' },[cite: 3]
    childAge: { type: String, default: 'N/A' },[cite: 3]
    message: { type: String, required: true },[cite: 3]
    createdAt: { type: Date, default: Date.now }[cite: 3]
});

const Enquiry = mongoose.model('Enquiry', EnquirySchema);[cite: 3]

// Admin Save/Update Result Endpoint with Gmail Notification[cite: 3]
app.post('/api/admin/add-full-result', async (req, res) => {
    try {
        const { studentId, fullName, email, studentClass, session, term, pin, subjects } = req.body;[cite: 3]

        if (!studentId || !fullName || !studentClass || !pin || !subjects || subjects.length === 0) {[cite: 3]
            return res.status(400).json({ success: false, message: 'Please provide all required student details and scores.' });[cite: 3]
        }

        const formattedResults = subjects
            .filter(sub => sub.subjectName && sub.subjectName.trim() !== '')[cite: 3]
            .map(sub => {
                const total = (Number(sub.caScore) || 0) + (Number(sub.examScore) || 0);[cite: 3]
                let grade = 'F';[cite: 3]
                if (total >= 70) grade = 'A';[cite: 3]
                else if (total >= 60) grade = 'B';[cite: 3]
                else if (total >= 50) grade = 'C';[cite: 3]
                else if (total >= 45) grade = 'D';[cite: 3]
                else if (total >= 40) grade = 'E';[cite: 3]

                return {
                    subject: sub.subjectName.trim(),[cite: 3]
                    ca: Number(sub.caScore) || 0,[cite: 3]
                    exam: Number(sub.examScore) || 0,[cite: 3]
                    total: total,[cite: 3]
                    grade: grade[cite: 3]
                };
            });

        if (formattedResults.length === 0) {[cite: 3]
            return res.status(400).json({ success: false, message: 'Please include at least one subject with a valid name.' });[cite: 3]
        }

        const cleanId = String(studentId).trim();[cite: 3]
        const cleanPin = String(pin).trim();[cite: 3]
        const studentEmail = email ? email.trim() : '';

        const updatedStudent = await Student.findOneAndUpdate(
            { student_id: new RegExp(`^${cleanId}$`, 'i') },[cite: 3]
            {
                student_id: cleanId,[cite: 3]
                full_name: fullName.trim(),[cite: 3]
                email: studentEmail,
                student_class: studentClass,[cite: 3]
                session: session,[cite: 3]
                term: term,[cite: 3]
                pin_code: cleanPin,[cite: 3]
                results: formattedResults[cite: 3]
            },
            { upsert: true, new: true, runValidators: true }[cite: 3]
        );

        res.json({ success: true, message: 'Result and PIN saved successfully!' });[cite: 3]

        // Send Email Notification if Student Email is provided
        if (studentEmail) {
            const senderEmail = process.env.EMAIL_USER || 'infodynolinks@gmail.com';[cite: 3]
            const mailOptions = {
                from: `"Dynolinks Academic Portal" <${senderEmail}>`,
                to: studentEmail,
                subject: `🎓 Academic Result Published - ${session} (${term})`,
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
                        <p>Use your Student ID and Access PIN to view your full result card on the portal.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions).then(() => {
                console.log(`Result notification email sent to ${studentEmail}`);
            }).catch(mailErr => {
                console.error('Email Notification Error:', mailErr);
            });
        }

    } catch (err) {
        console.error('Save student error detailed:', err);[cite: 3]
        res.status(500).json({ success: false, message: 'Failed to save student record.' });[cite: 3]
    }
});

// Admin List Endpoint[cite: 3]
app.get('/api/admin/student-status', async (req, res) => {
    try {
        const students = await Student.find({}, 'student_id full_name email student_class pin_code usage_count max_usage').sort({ createdAt: -1 });[cite: 3]
        res.json({ success: true, students });[cite: 3]
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching student list.' });[cite: 3]
    }
});

// Reset PIN Endpoint[cite: 3]
app.post('/api/admin/reset-pin', async (req, res) => {
    try {
        const { studentId } = req.body;[cite: 3]
        await Student.findOneAndUpdate({ student_id: studentId }, { usage_count: 0 });[cite: 3]
        res.json({ success: true, message: `PIN check count reset to 0 for ${studentId}.` });[cite: 3]
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not reset PIN.' });[cite: 3]
    }
});

// Delete Student Endpoint[cite: 3]
app.delete('/api/admin/delete-student', async (req, res) => {
    try {
        const { studentId } = req.body;[cite: 3]
        await Student.deleteOne({ student_id: studentId });[cite: 3]
        res.json({ success: true, message: `Student ${studentId} deleted successfully.` });[cite: 3]
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete student.' });[cite: 3]
    }
});

// Export CSV Endpoint[cite: 3]
app.get('/api/admin/export-results', async (req, res) => {
    try {
        const students = await Student.find({});[cite: 3]
        let csv = 'Student ID,Full Name,Email,Class,Session,Term,PIN,Subject,CA Score,Exam Score,Total Score,Grade\n';[cite: 3]

        students.forEach(s => {
            if (s.results && s.results.length > 0) {[cite: 3]
                s.results.forEach(r => {
                    csv += `"${s.student_id}","${s.full_name}","${s.email || ''}","${s.student_class}","${s.session}","${s.term}","${s.pin_code || ''}","${r.subject || ''}",${r.ca || 0},${r.exam || 0},${r.total || 0},"${r.grade || ''}"\n`;[cite: 3]
                });
            } else {
                csv += `"${s.student_id}","${s.full_name}","${s.email || ''}","${s.student_class}","${s.session}","${s.term}","${s.pin_code || ''}","","","","",""\n`;[cite: 3]
            }
        });

        res.setHeader('Content-Type', 'text/csv');[cite: 3]
        res.setHeader('Content-Disposition', 'attachment; filename="Dynolinks_Results_Export.csv"');[cite: 3]
        res.status(200).send(csv);[cite: 3]
    } catch (err) {
        res.status(500).send('Error generating CSV.');[cite: 3]
    }
});

// Check Student Result Endpoint[cite: 3]
app.post('/api/check-result', async (req, res) => {
    try {
        const { studentId, pin, session, term } = req.body;[cite: 3]

        if (!studentId || !pin || !session || !term) {[cite: 3]
            return res.status(400).json({ success: false, message: 'Please provide all search credentials.' });[cite: 3]
        }

        const student = await Student.findOne({
            student_id: new RegExp(`^${studentId.trim()}$`, 'i'),[cite: 3]
            pin_code: pin.trim(),[cite: 3]
            session: session,[cite: 3]
            term: term[cite: 3]
        });

        if (!student) {[cite: 3]
            return res.status(400).json({ success: false, message: 'Invalid Student ID, Access PIN, or Session/Term selection.' });[cite: 3]
        }

        if (student.usage_count >= student.max_usage) {[cite: 3]
            return res.status(403).json({ success: false, message: 'PIN check limit reached (Maximum 3 attempts allowed).' });[cite: 3]
        }

        student.usage_count += 1;[cite: 3]
        await student.save();[cite: 3]

        res.json({
            success: true,
            student: {
                id: student.student_id,[cite: 3]
                name: student.full_name,[cite: 3]
                email: student.email,
                class: student.student_class,[cite: 3]
                session: student.session,[cite: 3]
                term: student.term[cite: 3]
            },
            remainingChecks: student.max_usage - student.usage_count,[cite: 3]
            results: student.results.map(r => ({
                subject: r.subject,[cite: 3]
                ca: r.ca,[cite: 3]
                exam: r.exam,[cite: 3]
                total: r.total,[cite: 3]
                grade: r.grade[cite: 3]
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving academic results.' });[cite: 3]
    }
});

// Non-Blocking Enquiry API Endpoint[cite: 3]
app.post('/api/enquiries', async (req, res) => {
    try {
        const { fullName, email, phone, category, childClass, childAge, message } = req.body;[cite: 3]
        if (!fullName || !email || !phone || !category || !message) {[cite: 3]
            return res.status(400).json({ success: false, message: 'Please complete all required fields.' });[cite: 3]
        }

        const newEnquiry = new Enquiry({ 
            fullName, 
            email, 
            phone, 
            category, 
            childClass: childClass || 'N/A',[cite: 3]
            childAge: childAge || 'N/A',[cite: 3]
            message 
        });
        await newEnquiry.save();[cite: 3]

        res.json({ success: true, message: 'Your enquiry has been received successfully! Our team will contact you shortly.' });[cite: 3]

        // Background email processing[cite: 3]
        const recipientEmail = process.env.EMAIL_USER || 'infodynolinks@gmail.com';[cite: 3]
        const mailOptions = {
            from: `"Dynolinks Portal" <${recipientEmail}>`,[cite: 3]
            to: recipientEmail,[cite: 3]
            replyTo: email,[cite: 3]
            subject: `🔔 New Enquiry: ${category} from ${fullName}`,[cite: 3]
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #0F172A;">
                    <h3 style="color: #0B192C; border-bottom: 2px solid #D4AF37; padding-bottom: 8px;">
                        New School Enquiry Submitted
                    </h3>
                    <p><strong>Name:</strong> ${fullName}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
                    <p><strong>Category:</strong> ${category}</p>
                    <p><strong>Proposed Class:</strong> ${childClass || 'N/A'}</p>
                    <p><strong>Child's Age:</strong> ${childAge || 'N/A'}</p>
                    <p><strong>Message:</strong></p>
                    <blockquote style="background:#f4f4f4; padding:12px; border-left:4px solid #D4AF37; border-radius: 4px;">${message}</blockquote>
                </div>
            `[cite: 3]
        };

        transporter.sendMail(mailOptions).then(() => {
            console.log('Enquiry background email notification sent successfully.');[cite: 3]
        }).catch(mailErr => {
            console.error('Email Notification Error on Render:', mailErr);[cite: 3]
        });

    } catch (err) {
        console.error('Enquiry Save Error:', err);[cite: 3]
        res.status(500).json({ success: false, message: 'Failed to record enquiry.' });[cite: 3]
    }
});

// Admin Enquiries List Endpoint[cite: 3]
app.get('/api/admin/enquiries', async (req, res) => {
    try {
        const enquiries = await Enquiry.find({}).sort({ createdAt: -1 });[cite: 3]
        res.json({ success: true, enquiries });[cite: 3]
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch enquiries.' });[cite: 3]
    }
});

// Fallback route[cite: 3]
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));[cite: 3]
});

// Start Server[cite: 3]
const PORT = process.env.PORT || 3000;[cite: 3]
app.listen(PORT, () => {
    console.log(`Dynolinks Portal Server running on port ${PORT}`);[cite: 3]
});