const express = require('express');
const dns = require('dns');
try {
    dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);
} catch (_) {}
const crypto = require('crypto');
const mongoose = require('mongoose');
const sharp = require('sharp');
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
async function sendEmail({ to, subject, html, replyTo, attachments = [] }) {
    try {
        const senderEmail = process.env.EMAIL_USER || 'infodynolinks@gmail.com';
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

        let message = '';
        if (Array.isArray(attachments) && attachments.length > 0) {
            const boundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            const messageParts = [
                `From: Dynolinks Portal <${senderEmail}>`,
                `To: ${to}`,
                ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
                `Subject: ${utf8Subject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/related; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/html; charset=utf-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                html,
                ''
            ];

            for (const att of attachments) {
                let fileBuffer = null;
                if (att.content) {
                    fileBuffer = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content, 'base64');
                } else if (att.path && fs.existsSync(att.path)) {
                    fileBuffer = fs.readFileSync(att.path);
                }

                if (fileBuffer) {
                    const base64Content = fileBuffer.toString('base64');
                    const contentType = att.contentType || 'image/jpeg';
                    const filename = att.filename || 'attachment.jpg';
                    messageParts.push(`--${boundary}`);
                    messageParts.push(`Content-Type: ${contentType}; name="${filename}"`);
                    messageParts.push('Content-Transfer-Encoding: base64');
                    if (att.cid) {
                        messageParts.push(`Content-ID: <${att.cid}>`);
                        messageParts.push(`Content-Disposition: inline; filename="${filename}"`);
                    } else {
                        messageParts.push(`Content-Disposition: attachment; filename="${filename}"`);
                    }
                    messageParts.push('');
                    messageParts.push(base64Content);
                    messageParts.push('');
                }
            }
            messageParts.push(`--${boundary}--`);
            message = messageParts.join('\r\n');
        } else {
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
            message = messageParts.join('\n');
        }

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

// Phone and device detection dictionary for incoming HTTP requests
const SERVER_SAMSUNG_MAP = {
    'SM-S928': 'Samsung Galaxy S24 Ultra',
    'SM-S926': 'Samsung Galaxy S24+',
    'SM-S921': 'Samsung Galaxy S24',
    'SM-S918': 'Samsung Galaxy S23 Ultra',
    'SM-S916': 'Samsung Galaxy S23+',
    'SM-S911': 'Samsung Galaxy S23',
    'SM-S908': 'Samsung Galaxy S22 Ultra',
    'SM-S906': 'Samsung Galaxy S22+',
    'SM-S901': 'Samsung Galaxy S22',
    'SM-G998': 'Samsung Galaxy S21 Ultra',
    'SM-G996': 'Samsung Galaxy S21+',
    'SM-G991': 'Samsung Galaxy S21',
    'SM-G990': 'Samsung Galaxy S21 FE',
    'SM-G988': 'Samsung Galaxy S20 Ultra',
    'SM-G986': 'Samsung Galaxy S20+',
    'SM-G981': 'Samsung Galaxy S20',
    'SM-G980': 'Samsung Galaxy S20',
    'SM-G975': 'Samsung Galaxy S10+',
    'SM-G973': 'Samsung Galaxy S10',
    'SM-G970': 'Samsung Galaxy S10e',
    'SM-N986': 'Samsung Galaxy Note 20 Ultra',
    'SM-N985': 'Samsung Galaxy Note 20 Ultra',
    'SM-N981': 'Samsung Galaxy Note 20',
    'SM-N980': 'Samsung Galaxy Note 20',
    'SM-N975': 'Samsung Galaxy Note 10+',
    'SM-N970': 'Samsung Galaxy Note 10',
    'SM-A546': 'Samsung Galaxy A54 5G',
    'SM-A536': 'Samsung Galaxy A53 5G',
    'SM-A528': 'Samsung Galaxy A52s 5G',
    'SM-A526': 'Samsung Galaxy A52 5G',
    'SM-A525': 'Samsung Galaxy A52',
    'SM-A515': 'Samsung Galaxy A51',
    'SM-A505': 'Samsung Galaxy A50',
    'SM-A346': 'Samsung Galaxy A34 5G',
    'SM-A336': 'Samsung Galaxy A33 5G',
    'SM-A326': 'Samsung Galaxy A32 5G',
    'SM-A325': 'Samsung Galaxy A32',
    'SM-A245': 'Samsung Galaxy A24',
    'SM-A235': 'Samsung Galaxy A23',
    'SM-A236': 'Samsung Galaxy A23 5G',
    'SM-A225': 'Samsung Galaxy A22',
    'SM-A226': 'Samsung Galaxy A22 5G',
    'SM-A155': 'Samsung Galaxy A15',
    'SM-A156': 'Samsung Galaxy A15 5G',
    'SM-A145': 'Samsung Galaxy A14',
    'SM-A146': 'Samsung Galaxy A14 5G',
    'SM-A137': 'Samsung Galaxy A13',
    'SM-A135': 'Samsung Galaxy A13',
    'SM-A127': 'Samsung Galaxy A12 Nacho',
    'SM-A125': 'Samsung Galaxy A12',
    'SM-A115': 'Samsung Galaxy A11',
    'SM-A107': 'Samsung Galaxy A10s',
    'SM-A105': 'Samsung Galaxy A10',
    'SM-A057': 'Samsung Galaxy A05s',
    'SM-A055': 'Samsung Galaxy A05',
    'SM-A047': 'Samsung Galaxy A04s',
    'SM-A045': 'Samsung Galaxy A04',
    'SM-A042': 'Samsung Galaxy A04e',
    'SM-A035': 'Samsung Galaxy A03',
    'SM-A032': 'Samsung Galaxy A03 Core',
    'SM-A025': 'Samsung Galaxy A02s',
    'SM-A022': 'Samsung Galaxy A02'
};

const SERVER_TECNO_MAP = {
    'CK7': 'Tecno Camon 20 Pro',
    'CK8': 'Tecno Camon 20 Premier',
    'CK6': 'Tecno Camon 20',
    'CI6': 'Tecno Camon 19',
    'CI8': 'Tecno Camon 19 Pro',
    'CH6': 'Tecno Camon 18',
    'CH7': 'Tecno Camon 18P',
    'CH9': 'Tecno Camon 18 Premier',
    'BG6': 'Tecno Spark 20',
    'BG7': 'Tecno Spark 20 Pro',
    'KI5': 'Tecno Spark 10',
    'KI7': 'Tecno Spark 10 Pro',
    'KG5': 'Tecno Spark 8C',
    'KG6': 'Tecno Spark 8P',
    'KF6': 'Tecno Spark 7',
    'BF7': 'Tecno Pop 7',
    'BG5': 'Tecno Pop 8',
    'BD4': 'Tecno Pop 5',
    'LH7': 'Tecno Pova 5 Pro'
};

const SERVER_INFINIX_MAP = {
    'X6831': 'Infinix Hot 30',
    'X6833': 'Infinix Hot 30i',
    'X6816': 'Infinix Hot 12 Play',
    'X6817': 'Infinix Hot 12',
    'X688': 'Infinix Hot 10 Play',
    'X689': 'Infinix Hot 10S',
    'X682': 'Infinix Hot 9',
    'X676': 'Infinix Note 12',
    'X670': 'Infinix Note 11',
    'X6515': 'Infinix Smart 7',
    'X6511': 'Infinix Smart 6',
    'X657': 'Infinix Smart 5'
};

function parseDeviceInfo(userAgent = '', clientDeviceName = '', clientDeviceInfo = {}, headers = {}) {
    let exactModel = '';
    let brand = '';
    let os = '';
    let browser = '';
    let deviceType = 'Desktop';

    const ua = userAgent || '';

    // If client supplied high-accuracy model (e.g. detected via client-side fingerprinting)
    if (clientDeviceInfo && clientDeviceInfo.exactModel && clientDeviceInfo.exactModel !== 'Unknown device') {
        exactModel = clientDeviceInfo.exactModel;
        brand = clientDeviceInfo.brand || '';
        os = clientDeviceInfo.os || '';
        browser = clientDeviceInfo.browser || '';
        deviceType = clientDeviceInfo.deviceType || (/(iPhone|iPad|Android|Mobile)/i.test(ua) ? 'Mobile' : 'Desktop');
    } else if (clientDeviceName && clientDeviceName !== 'Unknown device' && !/^(MacIntel|Win32|Linux arm|Linux x86)/i.test(clientDeviceName)) {
        exactModel = clientDeviceName;
    }

    // OS detection from User-Agent
    if (!os) {
        if (/iPhone OS ([0-9_]+)/i.test(ua)) {
            const ver = ua.match(/iPhone OS ([0-9_]+)/i)[1].replace(/_/g, '.');
            os = `iOS ${ver}`;
            deviceType = 'Mobile Phone';
            brand = 'Apple';
        } else if (/iPad.*OS ([0-9_]+)/i.test(ua)) {
            const ver = ua.match(/OS ([0-9_]+)/i)[1].replace(/_/g, '.');
            os = `iPadOS ${ver}`;
            deviceType = 'Tablet';
            brand = 'Apple';
        } else if (/Android ([0-9.]+)/i.test(ua)) {
            os = `Android ${ua.match(/Android ([0-9.]+)/i)[1]}`;
            deviceType = 'Mobile Phone';
        } else if (/Windows NT 10.0/i.test(ua)) {
            os = 'Windows 10 / 11';
            deviceType = 'Desktop PC';
        } else if (/Mac OS X ([0-9_]+)/i.test(ua)) {
            os = `macOS ${ua.match(/Mac OS X ([0-9_]+)/i)[1].replace(/_/g, '.')}`;
            deviceType = 'Apple Mac';
            brand = 'Apple';
        } else if (/Linux/i.test(ua)) {
            os = 'Linux';
            deviceType = 'Desktop';
        } else {
            os = 'Unknown OS';
        }
    }

    // Browser detection
    if (!browser) {
        if (/Edg\/([0-9.]+)/i.test(ua)) browser = `Edge ${ua.match(/Edg\/([0-9.]+)/i)[1].split('.')[0]}`;
        else if (/Chrome\/([0-9.]+)/i.test(ua)) browser = `Chrome ${ua.match(/Chrome\/([0-9.]+)/i)[1].split('.')[0]}`;
        else if (/Version\/([0-9.]+).*Safari/i.test(ua)) browser = `Safari Mobile ${ua.match(/Version\/([0-9.]+)/i)[1]}`;
        else if (/Firefox\/([0-9.]+)/i.test(ua)) browser = `Firefox ${ua.match(/Firefox\/([0-9.]+)/i)[1].split('.')[0]}`;
        else browser = 'Web Browser';
    }

    // Extract exact phone model if not yet found
    if (!exactModel || exactModel === 'Unknown device' || exactModel === 'Apple iPhone') {
        if (/iPhone/i.test(ua)) {
            exactModel = exactModel && exactModel !== 'Unknown device' ? exactModel : 'Apple iPhone';
            brand = 'Apple';
            deviceType = 'Mobile Phone';
        } else if (/Android/i.test(ua)) {
            const match = ua.match(/Android [^;]+;\s*([^;)]+?)(?:\s+Build|\s*;|\))/i);
            const rawModel = match && match[1] ? match[1].trim() : '';
            if (rawModel) {
                // Samsung Check
                for (const [code, name] of Object.entries(SERVER_SAMSUNG_MAP)) {
                    if (rawModel.toUpperCase().startsWith(code.toUpperCase())) {
                        exactModel = `${name} (${rawModel})`;
                        brand = 'Samsung';
                        break;
                    }
                }
                if (!exactModel && /^SM-[A-Z0-9]+/i.test(rawModel)) {
                    exactModel = `Samsung Galaxy (${rawModel})`;
                    brand = 'Samsung';
                }

                // Tecno Check
                if (!exactModel) {
                    for (const [code, name] of Object.entries(SERVER_TECNO_MAP)) {
                        if (rawModel.toUpperCase().includes(code.toUpperCase())) {
                            exactModel = `${name} (${rawModel})`;
                            brand = 'Tecno';
                            break;
                        }
                    }
                }
                if (!exactModel && /^TECNO\s*/i.test(rawModel)) {
                    exactModel = rawModel;
                    brand = 'Tecno';
                }

                // Infinix Check
                if (!exactModel) {
                    for (const [code, name] of Object.entries(SERVER_INFINIX_MAP)) {
                        if (rawModel.toUpperCase().includes(code.toUpperCase())) {
                            exactModel = `${name} (${rawModel})`;
                            brand = 'Infinix';
                            break;
                        }
                    }
                }
                if (!exactModel && /^Infinix\s*/i.test(rawModel)) {
                    exactModel = rawModel;
                    brand = 'Infinix';
                }

                // Google Pixel Check
                if (!exactModel && /Pixel\s*[0-9a-zA-Z\s]+/i.test(rawModel)) {
                    exactModel = `Google ${rawModel}`;
                    brand = 'Google';
                }

                // Xiaomi / Redmi Check
                if (!exactModel && /Redmi|POCO|Xiaomi|Mi\s*/i.test(rawModel)) {
                    exactModel = rawModel;
                    brand = 'Xiaomi';
                }

                if (!exactModel) exactModel = rawModel;
            } else {
                exactModel = 'Android Phone';
            }
            deviceType = 'Mobile Phone';
        } else if (/Windows/i.test(ua)) {
            exactModel = 'Windows 10 / 11 PC';
            brand = 'PC';
            deviceType = 'Desktop PC';
        } else if (/Macintosh/i.test(ua)) {
            exactModel = 'Apple Mac';
            brand = 'Apple';
            deviceType = 'Mac Computer';
        } else {
            exactModel = 'Desktop Computer';
        }
    }

    return { exactModel, brand, os, browser, deviceType };
}

app.post('/api/admin/login', async (req, res) => {
    const { password, surface = 'portal', deviceName = 'Unknown device', deviceInfo = {} } = req.body || {};
    const expectedPassword = surface === 'cbt'
        ? (process.env.CBT_ADMIN_PASSWORD || 'cbtadmin')
        : (process.env.ADMIN_PASSWORD || 'adminDGC');

    if (!password || password !== expectedPassword) {
        return res.status(401).json({ success: false, message: 'Invalid Administrator Password!' });
    }

    const detectedDevice = parseDeviceInfo(req.get('user-agent'), deviceName, deviceInfo, req.headers);
    const loginTime = new Date();

    sendEmail({
        to: process.env.EMAIL_USER || 'infodynolinks@gmail.com',
        subject: `Admin Login: ${surface === 'cbt' ? 'CBT Management Portal' : 'Result Portal'} (${detectedDevice.exactModel})`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%); padding: 22px 20px; color: #ffffff; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">DYNOLINKS GLOBAL COLLEGE</h2>
                    <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">Administrator Security Login Alert</p>
                </div>
                <div style="padding: 24px; color: #1e293b;">
                    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                        <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0284c7; letter-spacing: 1px;">DEVICE IDENTIFICATION</p>
                        <p style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">📱 ${detectedDevice.exactModel || 'Unknown Device'}</p>
                        <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">${detectedDevice.brand ? detectedDevice.brand + ' • ' : ''}${detectedDevice.os} • ${detectedDevice.browser}</p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.6;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; width: 38%;"><strong>Portal:</strong></td>
                            <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${surface === 'cbt' ? 'CBT Management Portal' : 'Result Portal'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;"><strong>Exact Phone / Device:</strong></td>
                            <td style="padding: 8px 0; font-weight: 800; color: #0284c7; font-size: 14px;">${detectedDevice.exactModel}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;"><strong>Device Type:</strong></td>
                            <td style="padding: 8px 0; color: #334155;">${detectedDevice.deviceType}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;"><strong>Operating System:</strong></td>
                            <td style="padding: 8px 0; color: #334155;">${detectedDevice.os}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;"><strong>Browser:</strong></td>
                            <td style="padding: 8px 0; color: #334155;">${detectedDevice.browser}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;"><strong>IP Address:</strong></td>
                            <td style="padding: 8px 0; color: #334155; font-family: monospace;">${req.ip || 'Unavailable'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b;"><strong>Login Timestamp:</strong></td>
                            <td style="padding: 8px 0; color: #334155;">${loginTime.toLocaleString()}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `
    }).catch(err => console.error('Admin login notification failed:', err.response?.data || err.message));

    res.json({ success: true, emailSent: true, device: detectedDevice.exactModel });
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
    picture: { type: String, default: '' },
    show_result: { type: Boolean, default: true },
    status: { type: String, enum: ['Authorized', 'Suspended', 'Completed/Attempted'], default: 'Authorized' },
    email: { type: String, default: '' },
    student_class: { type: String, required: true },
    department: { type: String, default: '' },
    session: { type: String, default: '' },
    term: { type: String, default: '' },
    pin_code: { type: String, default: '' },
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

StudentSchema.index({ student_id: 1, pin_code: 1, session: 1, term: 1 });

const Student = mongoose.model('Student', StudentSchema);

const STUDENT_DATA_PASSWORD = process.env.STUDENT_DATA_PASSWORD || 'studata';

const requireStudentDataPassword = (req, res, next) => {
    const password = req.body?.password || req.headers['x-student-data-password'];
    if (password !== STUDENT_DATA_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Invalid student data password.' });
    }
    next();
};

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

QuestionSchema.index({ classKey: 1, subjectId: 1, qNumber: 1 });
QuestionSchema.index({ classKey: 1 });

const Question = mongoose.model('Question', QuestionSchema);

// CBT Exam Result Schema
const CbtResultSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    classKey: { type: String, default: '' },
    classLevel: { type: String, required: true },
    picture: { type: String, default: '' },
    totalPoints: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    grade: { type: String, default: 'F' },
    subjectBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    questionDetails: { type: mongoose.Schema.Types.Mixed, default: [] },
    timestamp: { type: String, default: () => new Date().toLocaleString() }
}, { timestamps: true });

CbtResultSchema.index({ studentId: 1, classKey: 1 });
CbtResultSchema.index({ createdAt: -1 });

const CbtResult = mongoose.model('CbtResult', CbtResultSchema);

const CbtConfigSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'default' },
    classConfigs: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const CbtConfig = mongoose.model('CbtConfig', CbtConfigSchema);

const TeacherSettingsSchema = new mongoose.Schema({
    key: { type: String, unique: true, default: 'default' },
    appearTime: { type: String, default: '08:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    disappearTime: { type: String, default: '17:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ }
}, { timestamps: true });

const TeacherSettings = mongoose.model('TeacherSettings', TeacherSettingsSchema);

const TeacherLoginSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    period: { type: String, required: true },
    loggedInAt: { type: Date, default: Date.now },
    location: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

TeacherLoginSchema.index({ period: 1, name: 1, loggedInAt: -1 });
const TeacherLogin = mongoose.model('TeacherLogin', TeacherLoginSchema);

const TeacherResetSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    resetAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

const TeacherReset = mongoose.model('TeacherReset', TeacherResetSchema);

const TeacherClassSessionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    classStartTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    period: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    location: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

TeacherClassSessionSchema.index({ period: 1, name: 1, submittedAt: -1 });
const TeacherClassSession = mongoose.model('TeacherClassSession', TeacherClassSessionSchema);
const TEACHER_ADMIN_PASSWORD = process.env.TEACHER_ADMIN_PASSWORD || 'admincheck';

function requireTeacherAdmin(req, res, next) {
    const password = req.headers['x-teacher-admin-password'] || req.body?.password;
    if (password !== TEACHER_ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: 'Invalid teacher admin password.' });
    }
    next();
}

async function getTeacherSettings() {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('Teacher settings database is not connected. Check MONGO_URI and the MongoDB deployment.');
    }
    return TeacherSettings.findOneAndUpdate(
        { key: 'default' },
        { $setOnInsert: { key: 'default', appearTime: '08:00', disappearTime: '17:00' } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
}

function getNigeriaDateParts(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(date).reduce((result, part) => {
        result[part.type] = part.value;
        return result;
    }, {});
}

function getTeacherPeriod(date, appearTime) {
    const parts = getNigeriaDateParts(date);
    const [hour, minute] = appearTime.split(':').map(Number);
    const currentMinutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
    const appearMinutes = hour * 60 + minute;
    if (currentMinutes >= appearMinutes) return `${parts.year}-${parts.month}-${parts.day}`;
    const previousDate = new Date(date.getTime() - 86400000);
    const previous = getNigeriaDateParts(previousDate);
    return `${previous.year}-${previous.month}-${previous.day}`;
}

app.get('/api/teacher/config', async (req, res) => {
    try {
        const settings = await getTeacherSettings();
        res.json({ success: true, appearTime: settings.appearTime, disappearTime: settings.disappearTime });
    } catch (err) {
        console.error('Load teacher settings error:', err.message);
        res.status(503).json({ success: false, message: err.message || 'Could not load teacher settings.' });
    }
});

app.get('/api/teacher/logins', requireTeacherAdmin, async (req, res) => {
    try {
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const logins = await TeacherLogin.find({ period }).sort({ loggedInAt: -1 }).lean();
        res.json({ success: true, period, logins });
    } catch (err) {
        console.error('Load teacher sign-ins error:', err.message);
        res.status(500).json({ success: false, message: 'Could not load teacher sign-ins.' });
    }
});

app.get('/api/teacher/status', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const name = String(req.query.name || '').trim();
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const reset = name ? await TeacherReset.findOne({ name }).lean() : null;
        const loginQuery = { name, period, ...(reset ? { loggedInAt: { $gt: reset.resetAt } } : {}) };
        const login = name ? await TeacherLogin.findOne(loginQuery).sort({ loggedInAt: -1 }).lean() : null;
        res.json({ success: true, checkedIn: Boolean(login), reset: Boolean(reset && !login), period });
    } catch (err) {
        console.error('Load teacher status error:', err.message);
        res.status(500).json({ success: false, message: 'Could not load teacher status.' });
    }
});

app.post('/api/teacher/logins', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
        if (name.length < 3) return res.status(400).json({ success: false, message: 'A full teacher name is required.' });
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const login = await TeacherLogin.create({ name, period, loggedInAt: new Date(), location: req.body?.location || {} });
        await TeacherReset.deleteOne({ name });
        res.status(201).json({ success: true, login });
    } catch (err) {
        console.error('Save teacher sign-in error:', err.message);
        res.status(500).json({ success: false, message: 'Could not save teacher sign-in.' });
    }
});

app.post('/api/teacher/class-sessions', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
        const className = String(req.body?.className || '').trim();
        const classStartTime = String(req.body?.classStartTime || '').trim();
        if (name.length < 3) return res.status(400).json({ success: false, message: 'A valid teacher name is required.' });
        if (!className) return res.status(400).json({ success: false, message: 'Please select a class.' });
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(classStartTime)) return res.status(400).json({ success: false, message: 'Please provide a valid class start time.' });
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const session = await TeacherClassSession.create({ name, className, classStartTime, period, submittedAt: new Date(), location: req.body?.location || {} });
        res.status(201).json({ success: true, session });
    } catch (err) {
        console.error('Save teacher class session error:', err.message);
        res.status(500).json({ success: false, message: 'Could not save class start.' });
    }
});

app.get('/api/teacher/class-sessions', requireTeacherAdmin, async (req, res) => {
    try {
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const sessions = await TeacherClassSession.find({ period }).sort({ submittedAt: -1 }).lean();
        res.json({ success: true, period, sessions });
    } catch (err) {
        console.error('Load teacher class sessions error:', err.message);
        res.status(500).json({ success: false, message: 'Could not load class starts.' });
    }
});

app.get('/api/teacher/attendance', requireTeacherAdmin, async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const name = String(req.query.name || '').trim();
        if (!name) return res.status(400).json({ success: false, message: 'Teacher name is required.' });
        const logins = await TeacherLogin.find({ name }).select('period loggedInAt').sort({ loggedInAt: 1 }).lean();
        res.json({ success: true, name, dates: [...new Set(logins.map(login => login.period))] });
    } catch (err) {
        console.error('Load teacher attendance history error:', err.message);
        res.status(500).json({ success: false, message: 'Could not load teacher attendance history.' });
    }
});

app.delete('/api/teacher/class-sessions/:id', requireTeacherAdmin, async (req, res) => {
    try {
        const deleted = await TeacherClassSession.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Class start record not found.' });
        res.json({ success: true, message: 'Class start record deleted.' });
    } catch (err) {
        console.error('Delete teacher class session error:', err.message);
        res.status(500).json({ success: false, message: 'Could not delete class start record.' });
    }
});

app.delete('/api/teacher/logins/:id', requireTeacherAdmin, async (req, res) => {
    try {
        const deleted = await TeacherLogin.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Teacher sign-in record not found.' });
        res.json({ success: true, message: 'Teacher sign-in record deleted.' });
    } catch (err) {
        console.error('Delete teacher sign-in error:', err.message);
        res.status(500).json({ success: false, message: 'Could not delete teacher sign-in record.' });
    }
});

app.delete('/api/teacher/teachers/:name', requireTeacherAdmin, async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name || '').trim();
        if (!name) return res.status(400).json({ success: false, message: 'Teacher name is required.' });
        const [loginResult, sessionResult] = await Promise.all([
            TeacherLogin.deleteMany({ name }),
            TeacherClassSession.deleteMany({ name })
        ]);
        await TeacherReset.findOneAndUpdate(
            { name },
            { $set: { resetAt: new Date() } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, deleted: loginResult.deletedCount + sessionResult.deletedCount, message: 'Teacher data deleted. Their saved sign-in will be cleared on the next online visit.' });
    } catch (err) {
        console.error('Delete teacher attendance data error:', err.message);
        res.status(500).json({ success: false, message: 'Could not delete teacher attendance data.' });
    }
});

app.put('/api/teacher/config', requireTeacherAdmin, async (req, res) => {
    try {
        const { appearTime, disappearTime } = req.body || {};
        const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
        if (!validTime(appearTime) || !validTime(disappearTime)) {
            return res.status(400).json({ success: false, message: 'Both times must use HH:MM format.' });
        }
        const settings = await TeacherSettings.findOneAndUpdate(
            { key: 'default' }, { $set: { appearTime, disappearTime } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();
        res.json({ success: true, appearTime: settings.appearTime, disappearTime: settings.disappearTime });
    } catch (err) {
        console.error('Save teacher settings error:', err.message);
        res.status(500).json({ success: false, message: 'Could not save teacher settings.' });
    }
});

// High-speed In-Memory Caches
const questionCache = new Map();
const studentLookupCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCachedQuestions(classKey, subjectId) {
    const key = `${classKey || 'ALL'}_${subjectId || 'ALL'}`;
    const entry = questionCache.get(key);
    if (entry && (Date.now() - entry.time < CACHE_TTL_MS)) {
        return entry.data;
    }
    return null;
}

function setCachedQuestions(classKey, subjectId, data) {
    const key = `${classKey || 'ALL'}_${subjectId || 'ALL'}`;
    questionCache.set(key, { time: Date.now(), data });
}

function invalidateQuestionCache() {
    questionCache.clear();
}

const normalizeStudentIdKey = (value = '') => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const expandStudentIdVariants = (value = '') => {
    const base = normalizeStudentIdKey(value);
    const variants = new Set([base]);
    if (!base) return [];
    variants.add(base.replace(/O/g, 'U'));
    variants.add(base.replace(/U/g, 'O'));
    variants.add(base.replace(/0/g, 'O'));
    variants.add(base.replace(/O/g, '0'));
    return Array.from(variants).filter(Boolean);
};

const buildStudentQuery = (studentId) => {
    const cleanId = decodeURIComponent(String(studentId)).trim();
    const aliases = expandStudentIdVariants(cleanId);
    const queryConditions = aliases.flatMap(alias => {
        const escapedId = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return [
            { student_id: alias },
            { student_id: new RegExp(`^${escapedId}$`, 'i') }
        ];
    });
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
        queryConditions.push({ _id: cleanId });
    }
    return { $or: queryConditions };
};

const publicStudent = (student) => ({
    student_id: student.student_id,
    full_name: student.full_name,
    student_class: student.student_class,
    department: student.department || '',
    picture: student.picture || '',
    show_result: student.show_result !== false,
    status: student.status || 'Authorized'
});

const compressStudentDataUrl = async (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed || !trimmed.startsWith('data:image')) return trimmed;

    try {
        const matches = trimmed.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
        if (!matches) return trimmed;

        const buffer = Buffer.from(matches[2], 'base64');
        const compressed = await sharp(buffer)
            .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 68, mozjpeg: true })
            .toBuffer();

        return `data:image/jpeg;base64,${compressed.toString('base64')}`;
    } catch (error) {
        console.warn('Student picture compression failed:', error.message);
        return trimmed;
    }
};

const normalizeStudentPictureValue = (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;

    const cleaned = trimmed
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^public\//i, '')
        .replace(/^stud-data\//i, '')
        .replace(/^\.\//, '')
        .replace(/\/+/g, '/');

    const filename = cleaned.split('/').pop() || cleaned;
    if (!filename) return '';
    const normalizedName = filename.toLowerCase();
    const hasExtension = /\.(jpg|jpeg|png|webp|gif)$/i.test(normalizedName);
    return `/stud-data/${hasExtension ? normalizedName : `${normalizedName}.jpg`}`;
};

const normalizeStudentDepartmentValue = (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    const normalized = trimmed.toLowerCase();
    if (normalized === 'science' || normalized === 'sci') return 'Science';
    if (normalized === 'art' || normalized === 'arts') return 'Arts';
    if (normalized === 'commercial' || normalized === 'comm') return 'Commercial';
    return trimmed;
};

const normalizeStudentData = (item = {}) => ({
    student_id: String(item.student_id || item.studentId || '').trim().toUpperCase(),
    full_name: String(item.full_name || item.fullName || '').trim(),
    student_class: String(item.student_class || item.studentClass || item.class || '').trim(),
    department: normalizeStudentDepartmentValue(item.department || item.dept || item.student_department || item.sssTrack || ''),
    picture: normalizeStudentPictureValue(item.picture || ''),
    show_result: item.show_result !== undefined ? Boolean(item.show_result) : (item.result_visible !== undefined ? Boolean(item.result_visible) : true)
});

const compressAllStoredStudentPictures = async () => {
    const students = await Student.find({ picture: { $regex: '^data:image' } }).lean();
    let updated = 0;

    for (const student of students) {
        const compressedPicture = await compressStudentDataUrl(student.picture);
        if (compressedPicture !== student.picture) {
            await Student.updateOne({ _id: student._id }, { $set: { picture: compressedPicture } });
            updated += 1;
        }
    }

    return { updated, total: students.length };
};

// Student Data Manager API. The password is required for every write and search request.
app.post('/api/admin/student-data/login', requireStudentDataPassword, (req, res) => {
    res.json({ success: true });
});

app.post('/api/admin/student-data/cleanup-pictures', requireStudentDataPassword, async (req, res) => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, message: 'Database is not connected right now. Please try again.' });
        }

        const result = await compressAllStoredStudentPictures();
        res.json({ success: true, updated: result.updated, total: result.total, message: `Compressed ${result.updated} student photo records.` });
    } catch (err) {
        console.error('Cleanup student pictures error:', err);
        res.status(500).json({ success: false, message: 'Could not compress stored student photos.' });
    }
});

app.get('/api/admin/student-data', requireStudentDataPassword, async (req, res) => {
    try {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            return res.status(503).json({ success: false, message: 'Database is not connected right now. Please try again.' });
        }

        const search = String(req.query.search || '').trim();
        const filter = search ? {
            $or: [
                { student_id: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                { full_name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                { student_class: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
            ]
        } : {};
        const students = await Student.find(filter)
            .select('student_id full_name student_class department picture show_result status')
            .lean();

        const studentSummaries = students
            .map(student => ({
                _id: student._id,
                student_id: student.student_id,
                full_name: student.full_name,
                student_class: student.student_class,
                department: student.department || '',
                has_picture: Boolean(student.picture),
                picture: student.picture || '',
                show_result: student.show_result !== false,
                status: student.status || 'Authorized'
            }))
            .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')) || String(a.student_id || '').localeCompare(String(b.student_id || '')));

        res.json({ success: true, students: studentSummaries });
    } catch (err) {
        console.error('Load student data error:', err);
        res.status(500).json({ success: false, message: 'Could not load student data.' });
    }
});

app.post('/api/admin/student-data', requireStudentDataPassword, async (req, res) => {
    try {
        const student = normalizeStudentData(req.body);
        const originalId = String(req.body.originalStudentId || req.body.original_student_id || student.student_id).trim();
        if (!student.student_id || !student.full_name || !student.student_class) {
            return res.status(400).json({ success: false, message: 'Full name, student ID, and class are required.' });
        }
        const saved = await Student.findOneAndUpdate(
            buildStudentQuery(originalId || student.student_id),
            {
                $set: student,
                $setOnInsert: { session: '', term: '', pin_code: '', usage_count: 0, max_usage: 3 }
            },
            { upsert: true, new: true, runValidators: true }
        );
        res.json({ success: true, student: publicStudent(saved) });
    } catch (err) {
        console.error('Save student data error:', err.message);
        res.status(400).json({ success: false, message: err.code === 11000 ? 'A student with that ID already exists.' : (err.message || 'Could not save student data.') });
    }
});

app.post('/api/admin/student-data/bulk', requireStudentDataPassword, async (req, res) => {
    try {
        const items = Array.isArray(req.body.students) ? req.body.students : [];
        const deduped = new Map();
        for (const item of items) {
            const student = normalizeStudentData(item);
            if (!student.student_id || !student.full_name || !student.student_class) continue;
            deduped.set(student.student_id, student);
        }

        const validItems = Array.from(deduped.values());
        if (!validItems.length) return res.status(400).json({ success: false, message: 'No valid student rows were supplied.' });

        for (const student of validItems) {
            await Student.findOneAndUpdate(
                { student_id: student.student_id },
                {
                    $set: {
                        ...student,
                        show_result: student.show_result !== false
                    },
                    $setOnInsert: { session: '', term: '', pin_code: '', usage_count: 0, max_usage: 3 }
                },
                { upsert: true, new: true, runValidators: true }
            );
        }

        const duplicateGroups = await Student.aggregate([
            { $group: { _id: '$student_id', ids: { $push: '$_id' }, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]);

        for (const group of duplicateGroups) {
            const keepId = group.ids[group.ids.length - 1];
            const removeIds = group.ids.filter(id => id.toString() !== keepId.toString());
            if (removeIds.length) {
                await Student.deleteMany({ _id: { $in: removeIds } });
            }
        }

        res.json({ success: true, count: validItems.length });
    } catch (err) {
        console.error('Bulk import student data error:', err.message);
        res.status(400).json({ success: false, message: err.message || 'Could not import student data.' });
    }
});

app.get('/api/student-data/:studentId', async (req, res) => {
    try {
        const rawId = String(req.params.studentId || '').trim();
        const cleanId = rawId.toUpperCase();
        const cached = studentLookupCache.get(cleanId);
        if (cached && (Date.now() - cached.time < CACHE_TTL_MS)) {
            return res.json(cached.data);
        }

        const student = await Student.findOne(buildStudentQuery(rawId), 'student_id full_name student_class department picture').lean();
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
        const responseData = { success: true, student: publicStudent(student) };
        studentLookupCache.set(cleanId, { time: Date.now(), data: responseData });
        res.json(responseData);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not find student record.' });
    }
});

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
        const { studentId, fullName, email, studentClass, department, session, term, pin, subjects } = req.body;

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
                department: String(department || '').trim(),
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
                const department = item.department || item.dept || item.student_department || item.sssTrack || '';

                if (!cleanId || !fullName) continue;

                const formattedResults = processSubjectScores(item.subjects || []);

                await Student.findOneAndUpdate(
                    buildStudentQuery(cleanId),
                    {
                        student_id: cleanId,
                        full_name: String(fullName).trim(),
                        student_class: String(item.studentClass || item.student_class || '').trim(),
                        department: String(department).trim(),
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
        const { studentId, fullName, email, studentClass, department, session, term, pin, subjects } = req.body;

        if (!studentId) {
            return res.status(400).json({ success: false, message: 'Student ID is required for update.' });
        }

        const cleanId = String(studentId).trim();
        const updateData = { student_id: cleanId };

        if (fullName) updateData.full_name = fullName.trim();
        if (email !== undefined) updateData.email = email.trim();
        if (studentClass) updateData.student_class = studentClass;
        if (department !== undefined) updateData.department = String(department).trim();
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
        const students = await Student.find({}, 'student_id full_name email student_class department pin_code usage_count max_usage results session term status').sort({ createdAt: -1 });
        res.json({ success: true, students });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching student list.' });
    }
});

app.post('/api/admin/student-status', async (req, res) => {
    try {
        const { studentId, status, password } = req.body || {};
        const requestPassword = password || req.headers['x-student-data-password'];
        if (requestPassword && requestPassword !== STUDENT_DATA_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Invalid student data password.' });
        }
        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID is required.' });
        const validStatuses = ['Authorized', 'Suspended', 'Completed/Attempted'];
        const nextStatus = String(status || '').trim();
        if (!validStatuses.includes(nextStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid student status value.' });
        }
        const updated = await Student.findOneAndUpdate(
            buildStudentQuery(studentId),
            { $set: { status: nextStatus } },
            { upsert: true, new: true, runValidators: true }
        );
        res.json({ success: true, studentId: updated?.student_id || studentId, status: updated?.status || nextStatus });
    } catch (err) {
        console.error('Update student status error:', err);
        res.status(500).json({ success: false, message: 'Failed to update student status.' });
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
        const { studentId, password } = req.body || {};
        const requestPassword = password || req.headers['x-student-data-password'];
        if (requestPassword && requestPassword !== STUDENT_DATA_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Invalid student data password.' });
        }
        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required.' });
        await Student.deleteOne(buildStudentQuery(studentId));
        res.json({ success: true, message: `Student ${studentId} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete student.' });
    }
});

app.post('/api/admin/student-result-visibility', async (req, res) => {
    try {
        const { studentId, showResult } = req.body || {};
        if (!studentId) return res.status(400).json({ success: false, message: 'Student ID required.' });
        const visibility = showResult !== undefined ? Boolean(showResult) : true;
        const student = await Student.findOneAndUpdate(
            buildStudentQuery(studentId),
            { $set: { show_result: visibility } },
            { new: true }
        );
        if (!student) return res.status(404).json({ success: false, message: 'Student record not found.' });
        return res.json({ success: true, studentId: student.student_id, show_result: student.show_result !== false });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Could not update result visibility.' });
    }
});

app.post('/api/admin/student-result-visibility/bulk', async (req, res) => {
    try {
        const { studentIds, showResult, all, classKey } = req.body || {};
        const visibility = showResult !== undefined ? Boolean(showResult) : true;

        let filter = {};
        if (all === true) {
            filter = {};
        } else if (classKey) {
            filter = { student_class: classKey };
        } else if (Array.isArray(studentIds) && studentIds.length) {
            const ids = Array.from(new Set(studentIds.map(id => String(id).trim()).filter(Boolean)));
            if (!ids.length) {
                return res.status(400).json({ success: false, message: 'No student IDs supplied.' });
            }

            const allQueryParts = ids.flatMap((studentId) => {
                const aliasVariants = expandStudentIdVariants(studentId);
                return aliasVariants.flatMap((alias) => [
                    { student_id: alias },
                    { student_id: new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                ]);
            });
            filter = { $or: allQueryParts };
        } else {
            return res.status(400).json({ success: false, message: 'Provide a target filter or choose all students.' });
        }

        const updateResult = await Student.updateMany(filter, { $set: { show_result: visibility } });
        return res.json({
            success: true,
            matched: updateResult.matchedCount,
            modified: updateResult.modifiedCount,
            show_result: visibility
        });
    } catch (err) {
        console.error('Bulk result visibility update failed:', err);
        return res.status(500).json({ success: false, message: 'Could not update result visibility for the selected students.' });
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
        const { studentId, pin, session, term, deviceName, deviceInfo } = req.body;

        if (!studentId || !pin || !session || !term) {
            return res.status(400).json({ success: false, message: 'Please provide all search credentials.' });
        }

        const student = await Student.findOne({
            $or: [
                { student_id: new RegExp(`^${studentId.trim()}$`, 'i') },
                { student_id: new RegExp(`^${studentId.trim().replace(/O/g, 'U')}$`, 'i') },
                { student_id: new RegExp(`^${studentId.trim().replace(/U/g, 'O')}$`, 'i') }
            ],
            pin_code: pin.trim(),
            session: session,
            term: term
        });

        if (!student) {
            return res.status(400).json({ success: false, message: 'Invalid Student ID, Access PIN, or Session/Term selection.' });
        }

        if (student.show_result === false) {
            return res.status(403).json({ success: false, message: 'This student result is currently hidden by the administrator.' });
        }

        if (student.usage_count >= student.max_usage) {
            return res.status(403).json({ success: false, message: 'PIN check limit reached (Maximum 3 attempts allowed).' });
        }

        student.usage_count += 1;
        await student.save();

        const detectedDevice = parseDeviceInfo(req.get('user-agent'), deviceName, deviceInfo, req.headers);
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
            subject: `Student Result Checked: ${student.student_id} (${detectedDevice.exactModel})`,
            html: `
                    <h2>Student Result Check Notification</h2>
                    <p>A student successfully checked an academic result.</p>
                    <p><strong>Student:</strong> ${student.full_name}</p>
                    <p><strong>Student ID:</strong> ${student.student_id}</p>
                    <p><strong>Class:</strong> ${student.student_class}</p>
                    <p><strong>Session:</strong> ${student.session}</p>
                    <p><strong>Term:</strong> ${student.term}</p>
                    <p><strong>Phone / Device Model:</strong> <span style="color: #0284c7; font-weight: bold;">${detectedDevice.exactModel}</span></p>
                    <p><strong>Device Type:</strong> ${detectedDevice.deviceType} (${detectedDevice.os} • ${detectedDevice.browser})</p>
                    <p><strong>IP Address:</strong> ${req.ip || 'Unavailable'}</p>
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
                picture: student.picture || '',
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
        const cached = getCachedQuestions(classKey, subjectId);
        if (cached) {
            return res.json(cached);
        }

        const filter = {};
        if (classKey) filter.classKey = classKey;
        if (subjectId) filter.subjectId = subjectId;

        const questions = await Question.find(filter).sort({ qNumber: 1 }).lean();
        setCachedQuestions(classKey, subjectId, questions);
        res.json(questions);
    } catch (err) {
        console.error('Error fetching questions:', err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

app.get('/api/cbt-config', async (req, res) => {
    try {
        const config = await CbtConfig.findOne({ key: 'default' }).lean();
        if (!config) return res.status(404).json({ error: 'CBT configuration has not been saved yet.' });
        res.json({ classConfigs: config.classConfigs });
    } catch (err) {
        console.error('Error fetching CBT configuration:', err);
        res.status(500).json({ error: 'Failed to fetch CBT configuration' });
    }
});

app.put('/api/cbt-config', async (req, res) => {
    try {
        const { classConfigs } = req.body || {};
        if (!classConfigs || typeof classConfigs !== 'object' || Array.isArray(classConfigs)) {
            return res.status(400).json({ error: 'A valid class configuration object is required.' });
        }
        const config = await CbtConfig.findOneAndUpdate(
            { key: 'default' },
            { key: 'default', classConfigs },
            { new: true, upsert: true, runValidators: true }
        ).lean();
        res.json({ classConfigs: config.classConfigs });
    } catch (err) {
        console.error('Error saving CBT configuration:', err);
        res.status(400).json({ error: 'Failed to save CBT configuration' });
    }
});

// POST a new CBT question
app.post('/api/questions', async (req, res) => {
    try {
        const newQuestion = new Question(req.body);
        const saved = await newQuestion.save();
        invalidateQuestionCache();
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
        invalidateQuestionCache();
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
        invalidateQuestionCache();
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
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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

async function fetchOpenRouterQuestions(params) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return [];
    const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const response = await withTimeout(fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5000',
            'X-Title': process.env.OPENROUTER_APP_NAME || 'Dynolinks Portal'
        },
        body: JSON.stringify({
            model,
            temperature: 0.4,
            messages: [
                { role: 'system', content: 'You generate accurate school examination questions and follow JSON schemas exactly.' },
                { role: 'user', content: buildAiQuestionPrompt(params) }
            ]
        })
    }), 15000, 'OpenRouter');
    if (!response.ok) throw new Error(`OpenRouter request failed with status ${response.status}.`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
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
        if (!topicList.length) return res.status(400).json({ error: 'Topic is required.' });

        const aiParams = {
            classLabel: classLabel || 'Secondary School',
            subjectName: subjectName || 'General Studies',
            topic: topicList.join(', '),
            count
        };
        const providers = [
            ['ChatGPT', fetchChatGptQuestions(aiParams)],
            ['OpenRouter', fetchOpenRouterQuestions(aiParams)],
            ['Google Gemini', fetchGeminiQuestions(aiParams)]
        ];
        const settled = await Promise.allSettled(providers.map(([, request]) => request));
        const providerErrors = settled
            .map((result, index) => result.status === 'rejected' ? `${providers[index][0]}: ${result.reason.message}` : '')
            .filter(Boolean);
        const configuredProviderCount = [
            process.env.OPENAI_API_KEY,
            process.env.OPENROUTER_API_KEY,
            process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
        ].filter(Boolean).length;
        if (!configuredProviderCount) {
            return res.status(503).json({ error: 'No AI provider is configured. Add OPENAI_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY to the server environment.' });
        }
        const generated = settled.flatMap(result => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []);
        const questions = rankOnlineQuestions(generated, aiParams.topic, count);
        if (questions.length < count) {
            return res.status(502).json({
                error: `AI providers returned ${questions.length} of ${count} valid questions.${providerErrors.length ? ` ${providerErrors.join(' ')}` : ''}`
            });
        }
        res.json({ source: 'ai', topic: aiParams.topic, questions });
    } catch (err) {
        console.error('AI question generation error:', err);
        res.status(500).json({ error: 'Failed to generate verified questions.' });
    }
});

// POST notify admin via email when student starts CBT assignment
app.post('/api/cbt/notify-start', async (req, res) => {
    try {
        const { candidate, deviceName, deviceInfo } = req.body || {};
        if (!candidate || !candidate.studentId) {
            return res.status(400).json({ success: false, message: 'Candidate details required' });
        }

        const detectedDevice = parseDeviceInfo(req.get('user-agent'), deviceName, deviceInfo, req.headers);
        const startTime = new Date();

        // Resolve candidate passport photo for email notification
        let candidatePhotoPath = candidate.picture || '';
        if (!candidatePhotoPath && candidate.studentId) {
            try {
                const found = await Student.findOne({ student_id: new RegExp(`^${candidate.studentId.trim()}$`, 'i') }).select('picture').lean();
                if (found && found.picture) candidatePhotoPath = found.picture;
            } catch (dbErr) {
                console.warn('Could not lookup candidate photo for notification:', dbErr.message);
            }
        }

        const attachments = [];
        let photoBlock = '';
        if (candidatePhotoPath) {
            const filename = path.basename(candidatePhotoPath.replace(/^[/\\]+stud-data[/\\]+/i, ''));
            const localImgPath = path.join(__dirname, 'public', 'stud-data', filename);
            if (fs.existsSync(localImgPath)) {
                attachments.push({
                    filename: filename,
                    path: localImgPath,
                    cid: 'candidatephoto',
                    contentType: filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
                });
                photoBlock = `
                    <div style="text-align: center; margin-bottom: 16px;">
                        <div style="display: inline-block; width: 92px; height: 92px; border-radius: 50%; overflow: hidden; border: 3px solid #0284c7; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3); background: #e0f2fe;">
                            <img src="cid:candidatephoto" alt="${candidate.name || 'Candidate'}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                        </div>
                        <div style="margin-top: 6px; font-size: 11px; font-weight: 800; color: #16a34a; letter-spacing: 0.8px; text-transform: uppercase;">
                            ✓ Passport Photo Verified
                        </div>
                    </div>
                `;
            }
        }

        sendEmail({
            to: process.env.EMAIL_USER || 'infodynolinks@gmail.com',
            subject: `CBT Exam Started: ${candidate.name || candidate.studentId} (${detectedDevice.exactModel})`,
            attachments,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #0284c7 0%, #1e40af 100%); padding: 22px 20px; color: #ffffff; text-align: center;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">DYNOLINKS GLOBAL COLLEGE</h2>
                        <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">CBT Examination Start Alert</p>
                    </div>
                    <div style="padding: 24px; color: #1e293b;">
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin-bottom: 20px; text-align: center;">
                            ${photoBlock}
                            <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #16a34a; letter-spacing: 1px;">ACTIVE CANDIDATE</p>
                            <p style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">${candidate.name}</p>
                            <p style="margin: 4px 0 0; font-size: 14px; color: #0284c7; font-weight: 700; font-family: monospace;">ID: ${candidate.studentId}</p>
                            <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">Class: <strong>${candidate.classLabel || candidate.classKey}</strong></p>
                        </div>

                        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                            <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0284c7; letter-spacing: 1px;">DEVICE IDENTIFICATION</p>
                            <p style="margin: 0; font-size: 18px; font-weight: 900; color: #0369a1;">📱 ${detectedDevice.exactModel}</p>
                            <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">${detectedDevice.brand ? detectedDevice.brand + ' • ' : ''}${detectedDevice.os} • ${detectedDevice.browser}</p>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.6;">
                            <tr><td style="padding: 6px 0; color: #64748b; width: 38%;"><strong>Candidate Name:</strong></td><td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${candidate.name}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Student ID:</strong></td><td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${candidate.studentId}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Class:</strong></td><td style="padding: 6px 0; color: #334155;">${candidate.classLabel || candidate.classKey}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Exact Phone Model:</strong></td><td style="padding: 6px 0; font-weight: 800; color: #0284c7; font-size: 14px;">📱 ${detectedDevice.exactModel}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Candidate Photo:</strong></td><td style="padding: 6px 0; color: #334155;">${photoBlock ? 'Attached / Verified' : 'Standard Avatar'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Device Type:</strong></td><td style="padding: 6px 0; color: #334155;">${detectedDevice.deviceType}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>IP Address:</strong></td><td style="padding: 6px 0; color: #334155; font-family: monospace;">${req.ip || 'Unavailable'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #64748b;"><strong>Start Time:</strong></td><td style="padding: 6px 0; color: #334155;">${startTime.toLocaleString()}</td></tr>
                        </table>
                    </div>
                </div>
            `
        }).catch(err => console.error('CBT start notification email error:', err.message));

        res.json({ success: true, emailSent: true, device: detectedDevice.exactModel });
    } catch (err) {
        console.error('CBT notify start error:', err);
        res.status(500).json({ success: false, message: 'Notification failed' });
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
        const studentId = String(req.body?.studentId || '').trim();
        const cbtResult = new CbtResult(req.body);
        const saved = await cbtResult.save();

        if (studentId) {
            await Student.findOneAndUpdate(
                buildStudentQuery(studentId),
                { $set: { status: 'Completed/Attempted' } },
                { upsert: true, new: true, runValidators: true }
            );
        }

        // Send submission alert email to admin with candidate photo and exact phone model
        try {
            const detectedDevice = parseDeviceInfo(req.get('user-agent'), req.body.deviceName, req.body.deviceInfo, req.headers);
            let candidatePhotoPath = req.body.picture || '';
            if (!candidatePhotoPath && req.body.studentId) {
                const found = await Student.findOne({ student_id: new RegExp(`^${req.body.studentId.trim()}$`, 'i') }).select('picture').lean();
                if (found && found.picture) candidatePhotoPath = found.picture;
            }

            const attachments = [];
            let photoBlock = '';
            if (candidatePhotoPath) {
                const filename = path.basename(candidatePhotoPath.replace(/^[/\\]+stud-data[/\\]+/i, ''));
                const localImgPath = path.join(__dirname, 'public', 'stud-data', filename);
                if (fs.existsSync(localImgPath)) {
                    attachments.push({
                        filename: filename,
                        path: localImgPath,
                        cid: 'candidatesubmissionphoto',
                        contentType: filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
                    });
                    photoBlock = `
                        <div style="text-align: center; margin-bottom: 16px;">
                            <div style="display: inline-block; width: 92px; height: 92px; border-radius: 50%; overflow: hidden; border: 3px solid #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.3); background: #f0fdf4;">
                                <img src="cid:candidatesubmissionphoto" alt="${req.body.studentName || 'Candidate'}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                            </div>
                            <div style="margin-top: 6px; font-size: 11px; font-weight: 800; color: #16a34a; letter-spacing: 0.8px; text-transform: uppercase;">
                                ✓ Photo Verified Submission
                            </div>
                        </div>
                    `;
                }
            }

            sendEmail({
                to: process.env.EMAIL_USER || 'infodynolinks@gmail.com',
                subject: `CBT Exam Submitted: ${req.body.studentName || req.body.studentId} (${req.body.percentage}%, Grade ${req.body.grade}) - ${detectedDevice.exactModel}`,
                attachments,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #15803d 0%, #0369a1 100%); padding: 22px 20px; color: #ffffff; text-align: center;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">DYNOLINKS GLOBAL COLLEGE</h2>
                            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">CBT Examination Submission Completed</p>
                        </div>
                        <div style="padding: 24px; color: #1e293b;">
                            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px; margin-bottom: 20px; text-align: center;">
                                ${photoBlock}
                                <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #16a34a; letter-spacing: 1px;">COMPLETED CANDIDATE</p>
                                <p style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">${req.body.studentName} (${req.body.studentId})</p>
                                <p style="margin: 4px 0 0; font-size: 15px; color: #059669; font-weight: 800;">Score: ${req.body.totalPoints} / ${req.body.maxPoints} (${req.body.percentage}%) • Grade: ${req.body.grade}</p>
                                <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">Class: <strong>${req.body.classLevel}</strong></p>
                            </div>

                            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                                <p style="margin: 0 0 6px; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0284c7; letter-spacing: 1px;">DEVICE IDENTIFICATION</p>
                                <p style="margin: 0; font-size: 18px; font-weight: 900; color: #0369a1;">📱 ${detectedDevice.exactModel}</p>
                                <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">${detectedDevice.brand ? detectedDevice.brand + ' • ' : ''}${detectedDevice.os} • ${detectedDevice.browser}</p>
                            </div>

                            <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.6;">
                                <tr><td style="padding: 6px 0; color: #64748b; width: 38%;"><strong>Candidate Name:</strong></td><td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${req.body.studentName}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Student ID:</strong></td><td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${req.body.studentId}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Class:</strong></td><td style="padding: 6px 0; color: #334155;">${req.body.classLevel}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Exact Phone Model:</strong></td><td style="padding: 6px 0; font-weight: 800; color: #0284c7; font-size: 14px;">📱 ${detectedDevice.exactModel}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Total Score:</strong></td><td style="padding: 6px 0; font-weight: 800; color: #15803d;">${req.body.totalPoints} / ${req.body.maxPoints}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Percentage:</strong></td><td style="padding: 6px 0; font-weight: 800; color: #0369a1;">${req.body.percentage}%</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Grade:</strong></td><td style="padding: 6px 0; font-weight: 800; color: #7e22ce;">${req.body.grade}</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;"><strong>Date Submitted:</strong></td><td style="padding: 6px 0; color: #334155;">${new Date().toLocaleString()}</td></tr>
                            </table>
                        </div>
                    </div>
                `
            }).catch(e => console.warn('CBT result submission email notification failed:', e.message));
        } catch (mailErr) {
            console.warn('Could not construct submission email:', mailErr.message);
        }

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

app.get('/api/admin/student-data/export', requireStudentDataPassword, async (req, res) => {
    try {
        const students = await Student.find({}, 'student_id full_name student_class picture').sort({ full_name: 1 }).lean();
        const rows = [['Student ID', 'Full Name', 'Class', 'Picture Data']];
        students.forEach(student => rows.push([
            student.student_id,
            student.full_name,
            student.student_class,
            student.picture || ''
        ]));
        const csv = '\uFEFF' + rows.map(row => row.map(sanitizeCsvField).join(',')).join('\r\n') + '\r\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="Dynolinks_Student_Data.csv"');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Could not export student data.' });
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
        await Question.deleteMany({ classKey, subjectId });
        const saved = await Question.insertMany(documents, { ordered: true });
        invalidateQuestionCache();
        res.status(201).json(saved);
    } catch (err) {
        console.error('Error bulk saving questions:', err);
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/teacher/class-sessions', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
        const className = String(req.body?.className || '').trim();
        const classStartTime = String(req.body?.classStartTime || '').trim();
        if (name.length < 3) return res.status(400).json({ success: false, message: 'A valid teacher name is required.' });
        if (!className) return res.status(400).json({ success: false, message: 'Please select a class.' });
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(classStartTime)) return res.status(400).json({ success: false, message: 'Please provide a valid class start time.' });
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const session = await TeacherClassSession.create({ name, className, classStartTime, period, submittedAt: new Date(), location: req.body?.location || {} });
        res.status(201).json({ success: true, session });
    } catch (err) {
        console.error('Save teacher class session error:', err.message);
        res.status(500).json({ success: false, message: 'Could not save class start.' });
    }
});

app.get('/api/teacher/class-sessions', requireTeacherAdmin, async (req, res) => {
    try {
        const settings = await getTeacherSettings();
        const period = getTeacherPeriod(new Date(), settings.appearTime);
        const sessions = await TeacherClassSession.find({ period }).sort({ submittedAt: -1 }).lean();
        res.json({ success: true, period, sessions });
    } catch (err) {
        console.error('Load teacher class sessions error:', err.message);
        res.status(500).json({ success: false, message: 'Could not load class starts.' });
    }
});

app.delete('/api/teacher/class-sessions/:id', requireTeacherAdmin, async (req, res) => {
    try {
        const deleted = await TeacherClassSession.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Class start record not found.' });
        res.json({ success: true, message: 'Class start record deleted.' });
    } catch (err) {
        console.error('Delete teacher class session error:', err.message);
        res.status(500).json({ success: false, message: 'Could not delete class start record.' });
    }
});