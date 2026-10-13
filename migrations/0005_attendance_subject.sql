-- Jalankan sekali sesudah 0004. Riwayat lama tidak ditebak mapelnya.
-- Guard menghentikan eksekusi ulang sebelum ada penyalinan/penghapusan tabel.
CREATE TABLE IF NOT EXISTS _attendance_subject_guard (ok INTEGER NOT NULL CHECK(ok=1));
DELETE FROM _attendance_subject_guard;
INSERT INTO _attendance_subject_guard(ok)
SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('student_attendance') WHERE name='subject')
OR EXISTS(SELECT 1 FROM pragma_table_info('teacher_journals') WHERE name IN ('subject','class_name')) THEN 0 ELSE 1 END;
CREATE TABLE student_attendance_subject_new (
 id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id),
 class_id TEXT NOT NULL REFERENCES classes(id), teacher_id TEXT NOT NULL REFERENCES teachers(id),
 attendance_date TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('H','S','I','A','D')), note TEXT DEFAULT '', time_in TEXT, time_out TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(student_id,class_id,attendance_date,teacher_id,subject)
);
INSERT INTO student_attendance_subject_new
(id,student_id,class_id,teacher_id,attendance_date,status,note,time_in,time_out,created_at,updated_at)
SELECT id,student_id,class_id,teacher_id,attendance_date,status,note,time_in,time_out,created_at,updated_at FROM student_attendance;
DROP TABLE student_attendance;
ALTER TABLE student_attendance_subject_new RENAME TO student_attendance;
CREATE INDEX idx_student_attendance_date ON student_attendance(attendance_date);
CREATE INDEX idx_student_attendance_teacher ON student_attendance(teacher_id);
CREATE INDEX idx_student_attendance_student ON student_attendance(student_id);
ALTER TABLE teacher_journals ADD COLUMN subject TEXT NOT NULL DEFAULT '';
ALTER TABLE teacher_journals ADD COLUMN class_name TEXT NOT NULL DEFAULT '';
DROP TABLE _attendance_subject_guard;
