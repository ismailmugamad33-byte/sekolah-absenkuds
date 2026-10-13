-- Migrasi absensi siswa agar satu siswa dapat diabsen oleh guru berbeda
-- pada kelas dan tanggal yang sama.
-- Data lama tetap dipertahankan.

PRAGMA foreign_keys = OFF;

CREATE TABLE student_attendance_new (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('H','S','I','A','D')),
  note TEXT DEFAULT '',
  time_in TEXT,
  time_out TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
  UNIQUE (student_id, class_id, attendance_date, teacher_id)
);

INSERT INTO student_attendance_new
(id, student_id, class_id, teacher_id, attendance_date, status, note, time_in, time_out, created_at, updated_at)
SELECT id, student_id, class_id, teacher_id, attendance_date, status, note, time_in, time_out, created_at, updated_at
FROM student_attendance;

DROP TABLE student_attendance;
ALTER TABLE student_attendance_new RENAME TO student_attendance;

CREATE INDEX IF NOT EXISTS idx_student_attendance_date
ON student_attendance(attendance_date);

CREATE INDEX IF NOT EXISTS idx_student_attendance_teacher
ON student_attendance(teacher_id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_student
ON student_attendance(student_id);

PRAGMA foreign_keys = ON;
