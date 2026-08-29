const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable basic CORS headers to handle client requests from different ports/origins
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Single Transporter configuration (Port 587 STARTTLS for Render compatibility)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // false for port 587
    auth: {
        user: process.env.EMAIL_USER || 'infodynolinks@gmail.com',
        pass: process.env.EMAIL_PASS || 'rckcxosjytwobqmv'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify connection configuration on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Connection Error on Render:', error);
    } else {
        console.log('Nodemailer SMTP Transporter ready to send emails.');
    }
});

// MongoDB Connection String
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://detanjunior67_db_user:Manuel528@cluster0.wosavjw.mongodb.net/dynolinks?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to Cloud MongoDB Database Successfully!'))
    .catch(err => console.error('MongoDB Connection Error Detailed:', err));

// Student Schema
const StudentSchema = new mongoose.Schema({
    student_id: { type: String, required: true, unique: true },
    full_name: { type: String, required: true },
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

// Enquiry Schema
const EnquirySchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    category: { type: String, required: true },
    childClass: { type: String, default: 'N/A' },
    childAge: { type: String, default: 'N/A' },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Enquiry = mongoose.model('Enquiry', EnquirySchema);

// Admin Save/Update Result Endpoint
app.post('/api/admin/add-full-result', async (req, res) => {
    try {
        const { studentId, fullName, studentClass, session, term, pin, subjects } = req.body;

        if (!studentId || !fullName || !studentClass || !pin || !subjects || subjects.length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide all required student details and scores.' });
        }

        // Filter out empty subject rows and construct results
        const formattedResults = subjects
            .filter(sub => sub.subjectName && sub.subjectName.trim() !== '')
            .map(sub => {
                const total = (Number(sub.caScore) || 0) + (Number(sub.examScore) || 0);
                let grade = 'F';
                if (total >= 70) grade = 'A';
                else if (total >= 60) grade = 'B';
                else if (total >= 50) grade = 'C';
                else if (total >= 45) grade = 'D';
                else if (total >= 40) grade = 'E';

                return {
                    subject: sub.subjectName.trim(),
                    ca: Number(sub.caScore) || 0,
                    exam: Number(sub.examScore) || 0,
                    total: total,
                    grade: grade
                };
            });

        if (formattedResults.length === 0) {
            return res.status(400).json({ success: false, message: 'Please include at least one subject with a valid name.' });
        }

        const cleanId = String(studentId).trim();
        const cleanPin = String(pin).trim();

        // Upsert logic: Update if student ID exists, otherwise create a new entry
        await Student.findOneAndUpdate(
            { student_id: new RegExp(`^${cleanId}$`, 'i') },
            {
                student_id: cleanId,
                full_name: fullName.trim(),
                student_class: studentClass,
                session: session,
                term: term,
                pin_code: cleanPin,
                results: formattedResults
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ success: true, message: 'Result and PIN saved successfully!' });
    } catch (err) {
        console.error('Save student error detailed:', err);
        res.status(500).json({ success: false, message: 'Failed to save student record.' });
    }
});

// Admin List Endpoint
app.get('/api/admin/student-status', async (req, res) => {
    try {
        const students = await Student.find({}, 'student_id full_name student_class pin_code usage_count max_usage').sort({ createdAt: -1 });
        res.json({ success: true, students });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching student list.' });
    }
});

// Reset PIN Endpoint
app.post('/api/admin/reset-pin', async (req, res) => {
    try {
        const { studentId } = req.body;
        await Student.findOneAndUpdate({ student_id: studentId }, { usage_count: 0 });
        res.json({ success: true, message: `PIN check count reset to 0 for ${studentId}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not reset PIN.' });
    }
});

// Delete Student Endpoint
app.delete('/api/admin/delete-student', async (req, res) => {
    try {
        const { studentId } = req.body;
        await Student.deleteOne({ student_id: studentId });
        res.json({ success: true, message: `Student ${studentId} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete student.' });
    }
});

// Export CSV Endpoint
app.get('/api/admin/export-results', async (req, res) => {
    try {
        const students = await Student.find({});
        let csv = 'Student ID,Full Name,Class,Session,Term,PIN,Subject,CA Score,Exam Score,Total Score,Grade\n';

        students.forEach(s => {
            if (s.results && s.results.length > 0) {
                s.results.forEach(r => {
                    csv += `"${s.student_id}","${s.full_name}","${s.student_class}","${s.session}","${s.term}","${s.pin_code || ''}","${r.subject || ''}",${r.ca || 0},${r.exam || 0},${r.total || 0},"${r.grade || ''}"\n`;
                });
            } else {
                csv += `"${s.student_id}","${s.full_name}","${s.student_class}","${s.session}","${s.term}","${s.pin_code || ''}","","","","",""\n`;
            }
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Dynolinks_Results_Export.csv"');
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send('Error generating CSV.');
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
                class: student.student_class,
                session: student.session,
                term: student.term
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

// Non-Blocking Enquiry API Endpoint
app.post('/api/enquiries', async (req, res) => {
    try {
        const { fullName, email, phone, category, childClass, childAge, message } = req.body;
        if (!fullName || !email || !phone || !category || !message) {
            return res.status(400).json({ success: false, message: 'Please complete all required fields.' });
        }

        const newEnquiry = new Enquiry({ 
            fullName, 
            email, 
            phone, 
            category, 
            childClass: childClass || 'N/A', 
            childAge: childAge || 'N/A', 
            message 
        });
        await newEnquiry.save();

        res.json({ success: true, message: 'Your enquiry has been received successfully! Our team will contact you shortly.' });

        // Background email processing
        const recipientEmail = process.env.EMAIL_USER || 'infodynolinks@gmail.com';
        const mailOptions = {
            from: `"Dynolinks Portal" <${recipientEmail}>`,
            to: recipientEmail,
            replyTo: email,
            subject: `🔔 New Enquiry: ${category} from ${fullName}`,
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
            `
        };

        transporter.sendMail(mailOptions).then(() => {
            console.log('Enquiry background email notification sent successfully.');
        }).catch(mailErr => {
            console.error('Email Notification Error on Render:', mailErr);
        });

    } catch (err) {
        console.error('Enquiry Save Error:', err);
        res.status(500).json({ success: false, message: 'Failed to record enquiry.' });
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

// Fallback route for single-page client loading
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dynolinks Portal Server running on port ${PORT}`);
});