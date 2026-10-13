# Panduan Manajemen Akademik

Buka sebagai Admin lalu pilih **Manajemen Akademik** pada menu samping. Pada file preview, cukup klik tombol **Manajemen Akademik** di bagian atas. Semua perubahan pada preview hanya simulasi dan hilang setelah halaman dimuat ulang.

## Guru baru atau perubahan mapel

1. Pastikan tahun ajaran/semester pada bagian atas sudah benar.
2. Pilih **Guru & Mapel → Tambah** untuk guru baru, atau **Edit** untuk guru yang ada.
3. Isi ID unik, nama, jabatan, dan seluruh mapel yang boleh dipilih guru pada periode ini. Pisahkan dengan titik koma, misalnya `Ilmu Hadits; Tahfidz`.
4. Simpan. Mapel yang dihapus dari daftar tidak lagi menjadi pilihan untuk absensi baru pada periode itu. Absensi dan jurnal lama tetap memakai mapel saat catatan dibuat.
5. Untuk guru baru, kembali ke dashboard → **Akun Guru** untuk membuat username dan password. Tambah data guru tidak otomatis membuat akun login.

Menonaktifkan guru mempertahankan riwayat tetapi mencabut akses login. Mengaktifkan kembali master guru belum otomatis mengaktifkan akun; periksa menu Akun Guru.

## Santri baru kelas 7 atau kelas 10

1. Pada tab **Kelas**, pastikan kelas tujuan tersedia; jika belum, tambah misalnya `7 SMP A` atau `10 MA A`. Nama kelas bisa mengikuti penamaan sekolah yang lama.
2. Buka **Siswa → Tambah**, isi identitas, kelas, tahun masuk (contoh `2026/2027`), dan status Aktif.
3. Untuk banyak siswa, gunakan **Impor CSV**. Unduh template terbaru, isi 1–100 baris, periksa daftar baris, lalu simpan. Kolom harus sesuai template. NIS/NISN sebaiknya teks agar nol depan tidak hilang di Excel.
4. ID baru menambah siswa; ID yang sudah ada memperbarui siswa tersebut. Jangan memakai ID alumni untuk orang baru.

## Naik kelas, siswa tinggal kelas, atau kelulusan

1. Unduh salinan data melalui **Ekspor & Salinan Data** sebelum proses akhir tahun.
2. Buka **Kenaikan & Kelulusan**, pilih kelas asal.
3. Centang siswa yang diproses. Jangan centang siswa yang tinggal kelas.
4. Pilih tindakan **Naik / pindah kelas**, **Lulus**, atau **Keluar / pindah sekolah**. Untuk naik kelas, pilih kelas tujuan yang berbeda. Isi periode tujuan dan catatan.
5. Klik **Periksa daftar perubahan**. Baca nama dan tujuan siswa, lalu simpan.
6. Ulangi untuk kelas berikutnya. Maksimal 100 siswa per proses. Untuk sekolah besar, lakukan per rombongan belajar.

Siswa lulus/keluar tetap dapat dicari di tab Siswa melalui filter status. Mereka tidak tampil dalam absensi aktif. Riwayat absensi tetap menunjukkan kelas saat absensi dibuat.

Periode tujuan pada proses kenaikan adalah keterangan riwayat. Proses ini tidak otomatis mengganti tahun ajaran aktif; ubah melalui tab Tahun Ajaran setelah proses akademik yang diperlukan selesai.

## Siswa keluar atau koreksi satu siswa

Gunakan **Siswa → Edit**. Pilih status Keluar, Lulus, atau Nonaktif dan isi alasan. Untuk koreksi kelas, ubah kelas siswa yang bersangkutan. Riwayat absensi lama tidak ikut berpindah. Aktifkan kembali hanya jika siswa memang kembali menjadi peserta didik aktif.

## Mengganti tahun ajaran/semester

Pilih **Tahun Ajaran**, isi tahun awal dan semester. Pilihan **Salin mapel** menyalin daftar guru saat ini ke periode tujuan yang belum diatur, termasuk daftar kosong. Daftar yang sudah diatur di periode tujuan tidak ditimpa. Setelah pergantian, periksa kembali penugasan tiap guru.

Pergantian periode tidak menghapus absensi, jurnal, data siswa, atau akun. Tidak ada reset data otomatis pada awal tahun.

## Ekspor

- **Excel (.xlsx):** lembar terpisah untuk data yang dipilih; NIS/NISN disimpan sebagai teks. Jika memilih Semua, mencakup guru/mapel, siswa termasuk alumni, kelas, SK dan pengaturan mapel, absensi siswa/guru, jurnal, periode aktif, dan log akademik.
- **PDF / Cetak:** membuka laporan berformat tabel. Klik Cetak / Simpan sebagai PDF, lalu pilih tujuan **Simpan sebagai PDF** pada Chrome/Edge. Untuk laporan yang sangat panjang, pilih satu jenis data atau rentang tanggal dahulu.
- **Salinan lengkap JSON:** seluruh data akademik yang tersedia, terlepas dari filter ekspor. Tidak memuat akun/password/sesi login. Tidak ada fitur impor/pemulihan JSON otomatis pada versi ini.

Filter tanggal hanya untuk absensi dan jurnal. Data master selalu mencerminkan kondisi terbaru, bukan rekonstruksi daftar siswa pada tanggal lampau. Kelas lama absensi dan riwayat perpindahan masih tersedia pada catatan masing-masing.

## Agar aplikasi bisa dipakai dari tahun ke tahun

- Pertahankan ID guru/siswa dan arsipkan statusnya, jangan mengganti orang pada ID yang sama.
- Simpan salinan akademik secara berkala dan sebelum perubahan massal. Operator juga perlu cadangan database lengkap untuk pemulihan sistem.
- Periksa log perubahan jika ada salah kelas atau perubahan mapel; lakukan koreksi terarah, jangan reset seluruh data.
- Gunakan periode dan penamaan kelas secara konsisten.
- Pengembangan lanjutan yang bermanfaat: cadangan terjadwal, pemulihan dengan pratinjau perubahan, pembagian peran operator/wali kelas, dan integrasi jadwal mengajar. Fitur lanjutan tersebut belum diaktifkan pada versi ini.
