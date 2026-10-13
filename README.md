# Sekolah Absenku — versi 1.3.0

Aplikasi absensi dan jurnal mengajar untuk Pondok Pesantren Yatim & Dhuafa Darush Sholihin. Backend Cloudflare Workers, database D1, dan frontend HTML/JavaScript.

**Mulai dari `PANDUAN_PEMBARUAN.md`. Migrasi `0004_master_sk_settings.sql` , `0005_attendance_subject.sql`, dan `0006_academic_management.sql` wajib dijalankan sebelum kode baru dipasang.** Paket ini belum diterapkan ke Cloudflare online.

## Manajemen Akademik

Menu khusus Admin membuka `/master-admin.html`:
- Guru & Mapel: tambah/edit/nonaktif guru dan ganti seluruh daftar mapel untuk tahun ajaran/semester aktif. Satu guru tetap satu akun.
- Siswa: tambah santri baru kelas 7/10, edit identitas/kelas, status Aktif/Lulus/Keluar/Nonaktif, tahun masuk, dan catatan.
- Kelas: tambah/edit kelas dan arsipkan kelas yang sudah tidak memiliki siswa aktif.
- Kenaikan & Kelulusan: pilih siswa, periksa nama, lalu naik/pindah kelas, lulus atau keluar secara massal (1–100 siswa). Catatan lama tidak dipindahkan ke kelas baru. Siswa yang tidak dipilih tetap di kelas asal.
- Tahun Ajaran: ubah periode aktif; pilihan salin mapel ke periode yang belum diatur. Tidak menaikkan siswa otomatis.
- Ekspor: Excel XLSX (lembar terpisah), PDF lewat dialog cetak browser, serta salinan JSON akademik lengkap. Filter tanggal berlaku untuk absensi/jurnal; master menampilkan keadaan terbaru.
- Log Perubahan: catat tindakan Admin sejak fitur diaktifkan. Tidak mengklaim sebagai audit historis sebelum pemasangan fitur.

Baca **`PANDUAN_MANAJEMEN_AKADEMIK.md`** untuk penggunaan sehari-hari. Salinan JSON tidak memuat akun/sesi login, tidak menggantikan cadangan D1 penuh, dan belum mempunyai fitur pemulihan otomatis.

## Absensi dan jurnal per mapel

- Satu akun guru dapat memilih satu mapel dari daftar penugasannya saat absensi siswa dan jurnal. Mapel dasar dipisahkan dengan titik koma; format lama dengan `&` juga dikenali.
- Absensi berbeda mapel pada siswa/kelas/tanggal/guru yang sama tersimpan terpisah, termasuk draf. Mapel wajib dipilih sebelum input; jika hanya satu, dipilih otomatis.
- Riwayat, cetak, CSV dan matriks bulanan menampilkan mapel. Monitoring Admin menyediakan filter mapel. Jumlah pada monitoring adalah catatan per mapel, bukan jumlah siswa unik.
- Riwayat lama diberi mapel kosong dengan tampilan “Belum ditentukan (data lama)”. Tidak ditebak atau dipindahkan ke mapel tertentu; tampil di riwayat/laporan. Absensi baru wajib punya mapel.
- Nama mapel disimpan pada catatan agar riwayat tidak mengikuti perubahan master. Mapel absensi tersimpan tidak dipindahkan saat edit status; pilih mapel di dashboard untuk catatan berbeda.
- Jurnal mencatat mapel dan kelas; guru tetap dapat membuat jurnal per pertemuan.

## Perbaikan

- Pilihan kelas dan filter dimuat ulang sesudah login dan pemuatan master. Kelas 2 MA/3 MA muncul bila memiliki siswa aktif.
- Guru mengubah status/keterangan tanpa mengosongkan atau menimpa jam siswa yang dikelola Admin.
- Catatan kosong dapat disimpan; validasi tanggal kalender, format dan urutan jam berlaku di backend.
- Reset password membatalkan seluruh sesi akun itu. Penonaktifan master guru menonaktifkan akun dan mencabut sesinya.
- Halaman baru `/master-admin.html`: tambah, edit, nonaktifkan/aktifkan guru, siswa dan kelas; impor CSV dengan pratinjau jumlah perubahan dan validasi seluruh baris sebelum disimpan.
- Pengaturan tahun ajaran dan semester disimpan di D1.
- Pembaruan data setiap 30 detik/fokus kembali saat tidak ada input atau draf aktif. Ini polling, bukan sinkronisasi instan.
- Sesi dapat dipulihkan setelah muat ulang atau kembali dari halaman master.
- Skema awal lengkap disediakan untuk database baru.

## Data guru dan SK

Sumber: `Draf_SK_Pembagian_Tugas_Mengajar_Guru_Semester_Ganjil_2026_2027(1).pdf`, halaman 3–4, nomor 006/MA-DS/H/IX/2026.

- 21 orang: 19 pengajar, 1 pembina tanpa mapel, 1 karyawan TU.
- 25 penugasan mapel; jumlah 50 JP/minggu; semua penugasan mengajar untuk kelas X.
- `sk_staff` menyimpan nama, status, jabatan, mapel, JP, catatan, dan identitas sumber.
- `teaching_assignments` menyimpan penugasan MA per guru dan periode. Mapel dasar guru lama tidak ditimpa.
- Pencocokan nama hanya mengabaikan huruf besar/kecil, titik, koma, dan spasi. ID lama dipakai jika hasilnya tepat satu orang; akun/riwayat tidak diubah. Tidak mencocokkan berdasarkan perkiraan kemiripan.
- Nufal Ra”uf tidak otomatis disatukan dengan Naufal Rauf (G013). Ryan Firdaus Yusuf berbeda dari Riyan Triyono.
- Ejaan “Ushuk Tafsir”, “Bedahara”, dan “Nufal Ra”uf” dipertahankan dan ditandai untuk dikonfirmasi.
- Abdurrahman dicatat sebagai pembina, tanpa mapel/akun guru baru. Jalu dicatat sebagai karyawan TU; bila sudah menjadi guru pada data lama, hubungan dan mapel lama tetap ada.
- SK tidak otomatis membuat akun login atau membatasi kelas mengajar. Akun baru dapat dibuat melalui menu **Akun Guru**.

Hasil jumlah guru bergantung pada data D1 yang ada. Dalam simulasi dengan 15 guru cadangan dari kode lama, tiga pengajar SK cocok dengan ID lama; 16 guru baru ditambahkan sehingga total 31 guru. Angka tersebut bukan klaim jumlah guru di database online.

## Menggunakan halaman master

Login Admin, buka Data Guru / Data Siswa / Rekap & Pengaturan, lalu pilih **Manajemen Akademik**.

- Mapel periode aktif bisa diedit langsung. Daftar tersebut menjadi pilihan guru untuk periode itu; sumber SK asli tetap disimpan sebagai arsip.
- Nonaktif menggantikan hapus permanen untuk menjaga riwayat. Guru yang diaktifkan kembali perlu diaktifkan akunnya melalui menu Akun Guru bila hendak login.
- Buat kelas sebelum mengimpor siswa. ID kelas pada CSV adalah `classes.id`, bukan nama tampilannya.
- Template CSV tersedia di dialog impor. Maksimal 100 baris. ID yang sama memperbarui data; ID baru menambah data. Periksa pratinjau sebelum menyimpan.
- Jika CSV berisi nama berkoma, bungkus dengan tanda kutip, misalnya `"Rudi Nur Ramadhan, S.Pd."`. Simpan NIS/NISN sebagai teks di Excel agar nol depan tidak hilang sebelum diimpor.
- Data SK MA merupakan salinan sumber yang dapat diperiksa lewat tab Data SK MA. Perubahan mapel operasional dilakukan dari Edit Guru untuk periode aktif; sumber SK asli tetap utuh.

## Pengembangan dan pengujian

Node 22.13+ (untuk `node:sqlite` pada pengujian), disarankan Node 24.

```bash
npm ci
npm test
npm run dev
```

`npm test` menggunakan SQLite lokal dan simulasi DOM; tidak mengakses database produksi. `npm run test:serve` menjalankan server uji di 127.0.0.1:8789 dengan siswa fiktif dan akun uji dari `tests/support.mjs`. Akun tersebut tidak dibuat pada D1 produksi.

## Batas perilaku yang tetap berlaku

- Absensi siswa tetap unik per siswa + kelas + tanggal + guru + mapel, belum per pertemuan/jam pelajaran.
- Guru masih memilih kelas yang mempunyai siswa; SK bukan pengaturan pembatasan akses kelas.
- Jurnal berisi mapel, kelas, tanggal, materi, jam, dan kendala; belum terintegrasi jadwal.
- Waktu kehadiran guru tetap manual untuk hari ini; tanggal aktif di dashboard untuk absensi siswa.
- Persentase hadir dihitung dari catatan absensi, bukan siswa unik. Belum diabsen tidak otomatis Alpa.
- Ekspor Manajemen Akademik menyediakan XLSX, PDF melalui dialog cetak, dan JSON. Ekspor CSV lama tetap tersedia pada dashboard.
- Tampilan utama masih menggunakan CDN Tailwind/Lucide dan memerlukan akses internet.

Kondisi dan skema aktual D1 online belum dibaca; uji browser visual penuh dan deploy belum dilakukan. Lihat `HASIL_UJI.md`.
