const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite Database (Auto-creates 'dynolinks_portal.db' if missing)
const dbPath = path.join(__dirname, 'dynolinks_portal.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// Auto-create database schema on server startup
db.serialize(() => {
    // Create Students Table
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            student_class TEXT NOT NULL,
            session TEXT NOT NULL,
            term TEXT NOT NULL,
            pin_code TEXT UNIQUE,
            usage_count INTEGER DEFAULT 0,
            max_usage INTEGER DEFAULT 3
        )
    `, (err) => {
        if (err) console.error('Error creating students table:', err.message);
    });

    // Create Results Table
    db.run(`
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            subject TEXT NOT NULL,
            ca INTEGER NOT NULL,
            exam INTEGER NOT NULL,
            total INTEGER NOT NULL,
            grade TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating results table:', err.message);
    });

    console.log('Database tables verified/created successfully.');
});

// ------------------------------------------------------------------
// ADMIN API ENDPOINTS
// ------------------------------------------------------------------

// 1. Add or Update Student Result
app.post('/api/admin/add-full-result', (req, res) => {
    const { studentId, fullName, studentClass, session, term, pin, subjects } = req.body;

    if (!studentId || !fullName || !studentClass || !pin || !subjects || subjects.length === 0) {
        return res.status(400).json({ success: false, message: 'Please provide all required student details and scores.' });
    }

    db.run(
        `INSERT OR REPLACE INTO students (student_id, full_name, student_class, session, term, pin_code, usage_count, max_usage)
         VALUES (?, ?, ?, ?, ?, ?, 0, 3)`,
        [studentId, fullName, studentClass, session, term, pin],
        function(err) {
            if (err) {
                console.error('Save student error:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to save student record.' });
            }

            // Remove existing subjects if updating
            db.run(`DELETE FROM results WHERE student_id = ?`, [studentId], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Failed to clear previous subject records.' });
                }

                const stmt = db.prepare(`INSERT INTO results (student_id, subject, ca, exam, total, grade) VALUES (?, ?, ?, ?, ?, ?)`);

                subjects.forEach(sub => {
                    const total = sub.caScore + sub.examScore;
                    let grade = 'F';
                    if (total >= 70) grade = 'A';
                    else if (total >= 60) grade = 'B';
                    else if (total >= 50) grade = 'C';
                    else if (total >= 45) grade = 'D';
                    else if (total >= 40) grade = 'E';

                    stmt.run(studentId, sub.subjectName, sub.caScore, sub.examScore, total, grade);
                });

                stmt.finalize();
                res.json({ success: true, message: 'Result and PIN saved successfully!' });
            });
        }
    );
});

// 2. Load Student List for Admin Dashboard
app.get('/api/admin/student-status', (req, res) => {
    db.all(`SELECT student_id, full_name, student_class, pin_code, usage_count, max_usage FROM students`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching student list.' });
        }
        res.json({ success: true, students: rows });
    });
});

// 3. Reset Student PIN Checks
app.post('/api/admin/reset-pin', (req, res) => {
    const { studentId } = req.body;
    db.run(`UPDATE students SET usage_count = 0 WHERE student_id = ?`, [studentId], function(err) {
        if (err || this.changes === 0) {
            return res.status(400).json({ success: false, message: 'Could not reset PIN.' });
        }
        res.json({ success: true, message: `PIN check count reset to 0 for ${studentId}.` });
    });
});

// 4. Delete Student Record
app.delete('/api/admin/delete-student', (req, res) => {
    const { studentId } = req.body;
    db.run(`DELETE FROM students WHERE student_id = ?`, [studentId], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to delete student.' });
        }
        db.run(`DELETE FROM results WHERE student_id = ?`, [studentId]);
        res.json({ success: true, message: `Student ${studentId} deleted successfully.` });
    });
});

// 5. Export All Results as CSV
app.get('/api/admin/export-results', (req, res) => {
    const query = `
        SELECT s.student_id, s.full_name, s.student_class, s.session, s.term, s.pin_code,
               r.subject, r.ca, r.exam, r.total, r.grade
        FROM students s
        LEFT JOIN results r ON s.student_id = r.student_id
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).send('Error generating CSV.');
        }

        let csv = 'Student ID,Full Name,Class,Session,Term,PIN,Subject,CA Score,Exam Score,Total Score,Grade\n';
        rows.forEach(r => {
            csv += `"${r.student_id}","${r.full_name}","${r.student_class}","${r.session}","${r.term}","${r.pin_code || ''}","${r.subject || ''}",${r.ca || 0},${r.exam || 0},${r.total || 0},"${r.grade || ''}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Dynolinks_Results_Export.csv"');
        res.status(200).send(csv);
    });
});

// ------------------------------------------------------------------
// STUDENT API ENDPOINTS
// ------------------------------------------------------------------

// Check Student Result
app.post('/api/check-result', (req, res) => {
    const { studentId, pin, session, term } = req.body;

    db.get(
        `SELECT * FROM students WHERE UPPER(student_id) = UPPER(?) AND pin_code = ? AND session = ? AND term = ?`,
        [studentId, pin, session, term],
        (err, student) => {
            if (err || !student) {
                return res.status(400).json({ success: false, message: 'Invalid Student ID, Access PIN, or Session/Term selection.' });
            }

            if (student.usage_count >= student.max_usage) {
                return res.status(403).json({ success: false, message: 'PIN check limit reached (Maximum 3 attempts allowed).' });
            }

            const newUsage = student.usage_count + 1;
            db.run(`UPDATE students SET usage_count = ? WHERE student_id = ?`, [newUsage, student.student_id]);

            db.all(`SELECT subject, ca, exam, total, grade FROM results WHERE student_id = ?`, [student.student_id], (err, results) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error retrieving academic results.' });
                }

                res.json({
                    success: true,
                    student: {
                        id: student.student_id,
                        name: student.full_name,
                        class: student.student_class,
                        session: student.session,
                        term: student.term
                    },
                    remainingChecks: student.max_usage - newUsage,
                    results: results.map(r => ({
                        subject: r.subject,
                        ca: r.ca,
                        exam: r.exam,
                        total: r.total,
                        grade: r.grade
                    }))
                });
            });
        }
    );
});

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dynolinks Portal Server is running on port ${PORT}`);
});