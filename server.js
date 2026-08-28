const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serve Static Frontend Assets from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Create or open local SQLite database file
const db = new sqlite3.Database('./dynolinks_portal.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to local SQLite database.');
        initTables();
    }
});

// Auto-create database tables on start
function initTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            student_class TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS access_pins (
            pin_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            pin_code TEXT NOT NULL,
            usage_count INTEGER DEFAULT 0,
            max_usage INTEGER DEFAULT 3,
            FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS results (
            result_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT,
            subject_name TEXT,
            ca_score INTEGER,
            exam_score INTEGER,
            academic_term TEXT,
            academic_year TEXT,
            FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        )`);
    });
}

function calculateGrade(total) {
    if (total >= 70) return 'A';
    if (total >= 60) return 'B';
    if (total >= 50) return 'C';
    if (total >= 40) return 'D';
    return 'F';
}

// 1. Fetch uploaded student list & pin check statuses for Admin
app.get('/api/admin/student-status', (req, res) => {
    const query = `
        SELECT 
            s.student_id, 
            s.full_name, 
            s.student_class, 
            p.pin_code, 
            IFNULL(p.usage_count, 0) AS usage_count,
            IFNULL(p.max_usage, 3) AS max_usage
        FROM students s
        LEFT JOIN access_pins p ON s.student_id = p.student_id
        ORDER BY s.student_id ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database query failed.' });
        }
        res.json({ success: true, students: rows });
    });
});

// 2. Export all student results as CSV for Admin
app.get('/api/admin/export-results', (req, res) => {
    const query = `
        SELECT 
            s.student_id,
            s.full_name,
            s.student_class,
            p.pin_code,
            IFNULL(p.usage_count, 0) AS usage_count,
            r.academic_session,
            r.academic_term,
            r.subject_name,
            r.ca_score,
            r.exam_score,
            (r.ca_score + r.exam_score) AS total_score
        FROM students s
        LEFT JOIN access_pins p ON s.student_id = p.student_id
        LEFT JOIN results r ON s.student_id = r.student_id
        ORDER BY s.student_id ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database export failed.' });
        }

        let csvContent = 'Student ID,Full Name,Class,PIN,Times Checked,Session,Term,Subject,CA Score,Exam Score,Total Score\n';

        rows.forEach(row => {
            csvContent += `"${row.student_id}","${row.full_name}","${row.student_class}","${row.pin_code || ''}",${row.usage_count},"${row.academic_session || ''}","${row.academic_term || ''}","${row.subject_name || ''}",${row.ca_score || 0},${row.exam_score || 0},${row.total_score || 0}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="all_student_results.csv"');
        res.status(200).send(csvContent);
    });
});

// 3. Check Result API Endpoint
app.post('/api/check-result', (req, res) => {
    const { studentId, pin } = req.body;

    db.get('SELECT * FROM access_pins WHERE student_id = ? AND pin_code = ?', [studentId, pin], (err, pinRecord) => {
        if (err || !pinRecord) {
            return res.status(401).json({ success: false, message: 'Invalid Student ID or Access PIN.' });
        }

        if (pinRecord.usage_count >= pinRecord.max_usage) {
            return res.status(403).json({ 
                success: false, 
                message: 'PIN Limit Exceeded! This PIN has already been used 3 times.' 
            });
        }

        db.get('SELECT * FROM students WHERE student_id = ?', [studentId], (err, student) => {
            if (err || !student) {
                return res.status(404).json({ success: false, message: 'Student ID record not found.' });
            }

            db.all('SELECT * FROM results WHERE student_id = ?', [studentId], (err, resultRows) => {
                if (err || resultRows.length === 0) {
                    return res.status(404).json({ success: false, message: 'No published scores found for this student.' });
                }

                const processedResults = resultRows.map(row => {
                    const total = row.ca_score + row.exam_score;
                    return {
                        subject: row.subject_name,
                        ca: row.ca_score,
                        exam: row.exam_score,
                        total: total,
                        grade: calculateGrade(total)
                    };
                });

                // Update PIN usage count
                db.run('UPDATE access_pins SET usage_count = usage_count + 1 WHERE pin_id = ?', [pinRecord.pin_id], (err) => {
                    if (err) console.error(err.message);

                    res.json({
                        success: true,
                        student: {
                            id: student.student_id,
                            name: student.full_name,
                            class: student.student_class,
                            term: resultRows[0]?.academic_term || '1st Term',
                            session: resultRows[0]?.academic_session || '2025/2026'
                        },
                        results: processedResults,
                        remainingChecks: pinRecord.max_usage - (pinRecord.usage_count + 1)
                    });
                });
            });
        });
    });
});

// 4. Admin Save Full Result + Session & Term + Generate PIN
app.post('/api/admin/add-full-result', (req, res) => {
    const { studentId, fullName, studentClass, session, term, pin, subjects } = req.body;

    db.serialize(() => {
        // Upsert student
        db.run(
            `INSERT INTO students (student_id, full_name, student_class) 
             VALUES (?, ?, ?) 
             ON CONFLICT(student_id) DO UPDATE SET full_name = excluded.full_name, student_class = excluded.student_class`,
            [studentId, fullName, studentClass]
        );

        // Upsert PIN
        db.run(
            `INSERT INTO access_pins (student_id, pin_code, usage_count, max_usage)
             VALUES (?, ?, 0, 3)
             ON CONFLICT(student_id) DO UPDATE SET pin_code = excluded.pin_code, usage_count = 0`,
            [studentId, pin]
        );

        // Clear previous scores
        db.run('DELETE FROM results WHERE student_id = ?', [studentId]);

        // Insert subject scores along with Session & Term
        const stmt = db.prepare(`INSERT INTO results (student_id, subject_name, ca_score, exam_score, academic_term, academic_session) VALUES (?, ?, ?, ?, ?, ?)`);
        
        subjects.forEach(sub => {
            stmt.run([studentId, sub.subjectName, sub.caScore, sub.examScore, term, session]);
        });

        stmt.finalize((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to save student result records.' });
            }
            res.json({ success: true, message: `Result & PIN saved successfully for ${session} (${term})! Generated PIN: ${pin}` });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`DYNOLINKS Portal running on http://localhost:${PORT}`);
});
