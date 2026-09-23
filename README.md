# TARGETKU

TARGETKU adalah tracker target/checklist mobile-first berbasis HTML + CSS + JavaScript tanpa backend.

## Fitur
- Dashboard progress harian
- Checklist per target
- Target berulang: harian, Senin–Jumat, hari tertentu, custom interval
- Streak + longest streak + milestone 3/7/14/30/60/100 hari
- Kalender progress dan detail per tanggal
- Statistik 7 hari, minggu, bulan, XP, level, insight kategori
- Fokus Hari Ini + konfirmasi "Selesaikan Semua"
- Focus Timer 25/5
- Reminder dan Web Notifications saat browser mengizinkan
- PWA/offline cache
- Export / Import JSON
- Pause day supaya satu tanggal bisa dikecualikan dari hitungan streak
- localStorage persistence
- Onboarding + profil
- Validasi import/reset + toast + haptic feedback

## Catatan notifikasi
Notifications API butuh izin pengguna. Karena proyek ini tidak memiliki backend/push server, pengingat waktu dicek oleh halaman yang sedang aktif. Service worker menangani cache/PWA dan klik notifikasi, tetapi tidak menjamin alarm tepat waktu ketika browser benar-benar ditutup. Untuk background push yang andal, tambahkan push service/backend pada tahap berikutnya.

## Menjalankan PWA
Untuk testing PWA/service worker, buka melalui HTTPS atau localhost. Membuka `index.html` via `file://` tetap bisa dipakai untuk fitur inti/localStorage, tetapi service worker/PWA biasanya perlu secure context.

## Basis riset fitur
Pola fitur dikembangkan dari beberapa aplikasi habit/task yang dipelajari:
- Streaks: task/habit streak, jadwal hari tertentu, statistik.
- Loop Habit Tracker: grafik/statistik historis, jadwal fleksibel, reminder.
- TickTick: task + calendar + habit tracker + reminders + statistics + Pomodoro.
- Todoist: recurring tasks/reminders dan kalender.
- Habitica: gamifikasi melalui task, rewards, level/achievement.
- Finch: goals, streaks, pause mode, kategori/self-care areas, weekly milestones.
