// Fictional fixtures only. IDs remain stable when names or display order change.
const records = [
  ['qv-demo-001', 'Ahmad Aariz Hakimi', 'Lelaki', 'Al-Quran', 184, 'tradisional', 'hijau'],
  ['qv-demo-002', 'Nur Aisyah Sofea', 'Perempuan', 'Khatam', 604, 'tradisional', 'ungu'],
  ['qv-demo-003', 'Muhammad Danish Irfan', 'Lelaki', "Iqra' 5", 23, 'sekolah', 'biru'],
  ['qv-demo-004', 'Siti Khadijah Humaira', 'Perempuan', 'Al-Quran', 267, 'sekolah', 'hijau'],
  ['qv-demo-005', 'Adam Rayyan Firdaus', 'Lelaki', "Iqra' 3", 17, 'sukan', 'biru'],
  ['qv-demo-006', 'Nur Hana Maisarah', 'Perempuan', "Iqra' 6", 21, 'tradisional', 'merah-jambu'],
  ['qv-demo-007', 'Muhammad Ziyad Harith', 'Lelaki', 'Al-Quran', 96, 'tradisional', 'biru'],
  ['qv-demo-008', 'Alya Batrisyia', 'Perempuan', "Iqra' 4", 19, 'sekolah', 'biru'],
  ['qv-demo-009', 'Umar Faris Azlan', 'Lelaki', "Iqra' 2", 12, 'sukan', 'hijau'],
  ['qv-demo-010', 'Nur Maryam Izzati', 'Perempuan', 'Al-Quran', 342, 'tradisional', 'hijau'],
  ['qv-demo-011', 'Ibrahim Aqil', 'Lelaki', "Iqra' 6", 28, 'sekolah', 'hijau'],
  ['qv-demo-012', 'Husna Damia', 'Perempuan', "Iqra' 3", 25, 'sukan', 'ungu'],
  ['qv-demo-013', 'Muhammad Yusuf Amsyar', 'Lelaki', 'Khatam', 604, 'tradisional', 'krim'],
  ['qv-demo-014', 'Nur Insyirah Qistina', 'Perempuan', "Iqra' 5", 16, 'sekolah', 'biru'],
  ['qv-demo-015', 'Haziq Luqman', 'Lelaki', "Iqra' 4", 11, 'sukan', 'biru'],
  ['qv-demo-016', 'Sarah Aleesya', 'Perempuan', 'Al-Quran', 128, 'tradisional', 'ungu'],
  ['qv-demo-017', 'Aiman Hakim', 'Lelaki', "Iqra' 1", 9, 'sekolah', 'biru'],
  ['qv-demo-018', 'Nur Zahra Adelia', 'Perempuan', "Iqra' 2", 20, 'sukan', 'merah-jambu'],
  ['qv-demo-019', 'Muhammad Rafiq Izz', 'Lelaki', "Iqra' 5", 29, 'tradisional', 'hijau'],
  ['qv-demo-020', 'Siti Balqis Nadhirah', 'Perempuan', 'Al-Quran', 215, 'sekolah', 'hijau'],
  ['qv-demo-021', 'Abdul Rahman Fawwaz', 'Lelaki', "Iqra' 3", 8, 'sukan', 'hijau'],
  ['qv-demo-022', 'Nur Amira Aqilah', 'Perempuan', "Iqra' 6", 14, 'tradisional', 'merah-jambu'],
  ['qv-demo-023', 'Iskandar Zulkarnain', 'Lelaki', "Iqra' 4", 26, 'sekolah', 'biru'],
  ['qv-demo-024', 'Fatimah Az-Zahra', 'Perempuan', "Iqra' 1", 18, 'sukan', 'ungu'],
  ['qv-demo-025', 'Muhammad Mikael', 'Lelaki', 'Al-Quran', 54, 'tradisional', 'krim'],
  ['qv-demo-026', 'Nur Safiyyah Medina', 'Perempuan', "Iqra' 5", 23, 'sekolah', 'hijau'],
  ['qv-demo-027', 'Harraz Ridhwan', 'Lelaki', "Iqra' 2", 7, 'sukan', 'biru'],
];

export const mockStudents = Object.freeze(records.map((record, index) => {
  const [id, name, gender, status, page, outfit, color] = record;
  return Object.freeze({ id, bil: index + 1, name, gender, status, page, outfit, color });
}));
