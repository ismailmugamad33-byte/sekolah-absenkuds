# Panduan pembaruan Sekolah Absenku

Paket berisi kode lengkap, data SK, migrasi, dan pengujian. Membuka HTML langsung dari komputer tidak cukup untuk menyimpan data: jalankan melalui Worker agar API dan D1 terhubung.

## A. Memperbarui aplikasi yang sudah berjalan

1. Simpan cadangan database D1 dan salinan kode lama sebelum pembaruan. Jangan gunakan menu Reset Seluruh Data. Jangan ganti `AUTH_PEPPER` yang sudah digunakan.
2. Gunakan database yang terhubung ke Worker saat ini. Konfigurasi dalam ZIP mempertahankan `database_name` dan `database_id` bawaan paket sumber; cocokkan dengan Cloudflare milik sekolah.
3. Periksa skema di D1 Console:

```sql
SELECT name, sql FROM sqlite_master
WHERE type='table' AND name IN
('teachers','students','classes','users','student_attendance','teacher_attendance','teacher_journals');
PRAGMA foreign_key_check;
```

Pastikan tabel dasar sudah ada. Paket perbaikan memakai kolom yang digunakan kode lama: `teachers(id,name,subject,position,active)`, `students(id,nis,nisn,name,class_id,active)`, dan `classes(id,name,level,active)`. Jika struktur berbeda, sesuaikan dulu berdasarkan struktur aktual; jangan menghapus tabel yang berisi data.

4. Jika kolom `student_attendance.subject` sudah ada, **jangan jalankan ulang migrasi 0003 maupun 0005**. Periksa juga kolom `teacher_journals.subject` dan `class_name`; jika tidak lengkap, periksa migrasi yang terhenti. Jika belum mempunyai kolom subject, ikuti langkah berikut. Jika `student_attendance` sudah mempunyai `UNIQUE(student_id,class_id,attendance_date,teacher_id)`, lewati migrasi `0003`. Jika belum, jalankan `MIGRASI_ABSENSI_PER_GURU.sql` setelah mencadangkan database, kemudian periksa jumlah data sebelum/sesudah. Migrasi akan berhenti bila ada konflik; jangan menghapus baris untuk memaksakannya.
5. Jalankan seluruh isi **`migrations/0004_master_sk_settings.sql`** di D1 Console. File ini menambahkan pengaturan, 21 data sumber SK, dan 25 penugasan mapel; tidak menghapus guru/siswa/akun/riwayat. Aman dijalankan ulang. Jika `_sk_import_guard` menolak perubahan, ada ID `MA2026-xx` yang sudah digunakan orang lain: periksa konflik ID sebelum melanjutkan.
6. Periksa hasil:

```sql
SELECT COUNT(*) AS jumlah_nama, SUM(total_jp) AS total_jp FROM sk_staff;
SELECT COUNT(*) AS jumlah_penugasan FROM teaching_assignments;
SELECT source_no,name,teacher_id,source_subject,notes
FROM sk_staff ORDER BY source_no;
PRAGMA foreign_key_check;
```

Hasil impor SK awal: **21 nama, 50 JP, 25 penugasan**, dan pemeriksaan foreign key tanpa temuan. Tiga ID yang cocok pada data cadangan lama adalah Riyan Triyono (G009), Azhar Umar Said (G011), Muhammad Farid Riza (G012). Data D1 sebenarnya bisa berbeda; baca hasil pencocokan sebelum membuat akun massal.

6a. Jalankan **`migrations/0005_attendance_subject.sql` sekali** sebelum memasang kode 1.2.0. Ini membangun ulang tabel absensi untuk kunci unik per guru + mapel dan menambahkan kolom mapel/kelas jurnal. Semua ID, status, jam, keterangan dan tanggal lama disalin apa adanya. Mapel lama tetap kosong; aplikasi menampilkan “Belum ditentukan (data lama)”. Guard `_attendance_subject_guard` sengaja menolak eksekusi ulang atau skema parsial sebelum perubahan tabel. Jangan melewati guard tersebut.

Periksa `PRAGMA table_info(student_attendance);`, `PRAGMA table_info(teacher_journals);`, jumlah baris sebelum/sesudah dan `PRAGMA foreign_key_check;`. Paket ini belum memigrasi database online.

6b. Untuk versi **1.3.0**, jalankan **`migrations/0006_academic_management.sql` sekali** setelah 0005. Periksa dahulu `PRAGMA table_info(students);`: jika kolom `lifecycle_status`, `status_note`, dan `enrolled_year` sudah ada, jangan ulangi 0006. Periksa juga tabel `teacher_subject_overrides`, `academic_events`, dan `academic_operations`. Jika hanya sebagian ada, hentikan dan periksa status migrasi; jangan menghapus tabel berisi data.

Migrasi 0006 menambah status siswa, arsip pengaturan mapel per periode, dan log akademik. Siswa aktif tetap aktif; siswa yang dahulu nonaktif diberi status Nonaktif, tanpa menebak apakah lulus atau keluar. Tahun masuk lama tetap kosong sampai Admin melengkapinya.

7. Ganti kode proyek dengan isi folder ini. Pastikan file baru `src/master-data.js`, `public/master-admin.html`, dan `public/master-admin.js`, `public/academic-export.js`, dan `src/academic.js` ikut terunggah. Deploy melalui alur Cloudflare/GitHub yang biasa digunakan atau:

```bash
npm ci
npm test
npm run deploy
```

Perintah deploy di atas adalah petunjuk untuk operator; belum dijalankan dalam pengerjaan paket ini. Jangan menjalankan semua migrasi otomatis pada database lama yang riwayat migrasinya belum dikenali. Untuk database lama gunakan langkah eksplisit 3–6b.

8. Buka `/api/health`. Harapkan `database: "connected"`, `auth_secret: "configured"`, `attendance_scope: "per-teacher-subject"`, dan `master_schema: "ready"`, dan `academic_schema: "ready"`.
9. Login Admin. Buka menu Manajemen Akademik dan tab Data SK MA. Periksa nama, mapel, dan ID terkait. Buat akun guru baru melalui menu Akun Guru setelah data dipastikan benar.
10. Uji pada data uji yang disepakati: pilihan 2 MA/3 MA, simpan status siswa, ubah status guru sesudah Admin mengisi jam, serta reset password lalu coba sesi lama. Pastikan data operasional asli tidak digunakan untuk percobaan yang mengubah laporan.

## B. Instalasi baru dengan database kosong

1. Buat database D1 sendiri dan pasang binding `DB`. Sesuaikan `wrangler.jsonc` dengan database baru.
2. Jalankan urut isi file berikut pada database kosong:
   - `migrations/0001_initial_schema.sql`
   - `migrations/0002_auth_sessions.sql`
   - `migrations/0003_student_attendance_per_teacher.sql`
   - `migrations/0004_master_sk_settings.sql`
   - `migrations/0005_attendance_subject.sql`
   - `migrations/0006_academic_management.sql`
3. Atur secret `AUTH_PEPPER` dengan nilai acak minimal 32 karakter melalui pengaturan Worker. Jangan menyimpan secret ke GitHub.
4. Deploy kode dan buka `/setup-admin` untuk membuat Admin pertama. Setup tertutup setelah akun pengguna tersedia.
5. Login Admin, tambah kelas lalu impor siswa pada menu Manajemen Akademik. Paket tidak berisi daftar siswa produksi.
6. Periksa data SK lalu buat akun pengajar melalui menu Akun Guru. Database kosong memperoleh 19 guru dari SK; pembina tanpa mapel dan karyawan tercatat pada tab Data SK MA.

## Pemulihan

Sesudah migrasi 0005, kode lama tidak memahami mapel dan bisa menghasilkan laporan bercampur. Jangan hanya mengembalikan Worker lama. Gunakan paket kode dan cadangan database yang saling sesuai, lalu rekonsiliasi data yang masuk sesudah cadangan. Jangan menjalankan ulang migrasi 0003 karena skema lama tidak mempertahankan mapel.
