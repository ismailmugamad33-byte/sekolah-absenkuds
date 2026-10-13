-- Jalankan sekali sesudah 0005. Tanpa menghapus siswa atau riwayat.
ALTER TABLE students ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'aktif' CHECK(lifecycle_status IN ('aktif','lulus','keluar','nonaktif'));
ALTER TABLE students ADD COLUMN status_note TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN enrolled_year TEXT NOT NULL DEFAULT '';
UPDATE students SET lifecycle_status='nonaktif' WHERE active=0;
CREATE TABLE teacher_subject_overrides (
 teacher_id TEXT NOT NULL REFERENCES teachers(id), academic_year TEXT NOT NULL,
 semester INTEGER NOT NULL CHECK(semester IN (1,2)), subjects_json TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(teacher_id,academic_year,semester)
);
CREATE TABLE academic_events (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL,
 details_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE academic_operations (
 id TEXT PRIMARY KEY, expected_count INTEGER NOT NULL, actual_count INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(expected_count=actual_count)
);
