const runtimeNode = typeof document !== 'undefined' ? document.getElementById('qv-runtime') : null;
const runtime = runtimeNode ? JSON.parse(runtimeNode.textContent) : {};
export const config = Object.freeze({
  dataMode: 'demo',
  transport: 'fetch',
  publicReadUrl: '',
  teacherUrl: '',
  presentationIntervalMs: 30_000,
  inactivityMs: 30_000,
  ...runtime,
});

export const avatarColors = Object.freeze({
  hijau: Object.freeze({ label: 'Hijau zamrud', hex: '#369c88' }),
  biru: Object.freeze({ label: 'Biru langit', hex: '#508bcc' }),
  ungu: Object.freeze({ label: 'Ungu lembut', hex: '#9470bf' }),
  'merah-jambu': Object.freeze({ label: 'Merah jambu', hex: '#e78ca8' }),
  krim: Object.freeze({ label: 'Krim keemasan', hex: '#edcb83' }),
});

export const outfits = Object.freeze([
  { key: 'sekolah', symbol: '01', labels: { Lelaki: 'Uniform sekolah', Perempuan: 'Uniform sekolah bertudung' }, palettes: { Lelaki: ['biru', 'hijau', 'krim'], Perempuan: ['biru', 'hijau', 'krim'] } },
  { key: 'tradisional', symbol: '02', labels: { Lelaki: 'Baju Melayu', Perempuan: 'Baju Kurung bertudung' }, palettes: { Lelaki: ['hijau', 'biru', 'krim'], Perempuan: ['ungu', 'merah-jambu', 'hijau'] } },
  { key: 'sukan', symbol: '03', labels: { Lelaki: 'Pakaian sukan', Perempuan: 'Pakaian sukan bertudung' }, palettes: { Lelaki: ['biru', 'hijau', 'ungu'], Perempuan: ['ungu', 'merah-jambu', 'biru'] } },
].map(item => Object.freeze({ ...item, labels: Object.freeze(item.labels), palettes: Object.freeze(Object.fromEntries(Object.entries(item.palettes).map(([gender, colors]) => [gender, Object.freeze(colors)]))) })));

export const statuses = Object.freeze([
  { name: 'Khatam', color: '#D9A928', pale: '#FFF2C6', dark: '#76530B', symbol: '✦', message: 'Satu pencapaian indah. Teruskan mencintai bacaan.' },
  { name: 'Al-Quran', color: '#159A72', pale: '#DDF3E8', dark: '#166347', symbol: '✧', message: 'Membina kebiasaan membaca, satu halaman pada satu masa.' },
  { name: "Iqra' 6", color: '#8B62CF', pale: '#ECE3FA', dark: '#67439D', symbol: '6', message: 'Semakin dekat dengan langkah yang seterusnya.' },
  { name: "Iqra' 5", color: '#448BE0', pale: '#E0ECFC', dark: '#2B60A2', symbol: '5', message: 'Usaha yang konsisten membawa kemajuan.' },
  { name: "Iqra' 4", color: '#E9C74D', pale: '#FBF2CC', dark: '#79631A', symbol: '4', message: 'Terus belajar dengan yakin dan gembira.' },
  { name: "Iqra' 3", color: '#E99546', pale: '#FDE9D5', dark: '#9B5B22', symbol: '3', message: 'Setiap bacaan menjadikan kita lebih yakin.' },
  { name: "Iqra' 2", color: '#E87DA6', pale: '#FCE2ED', dark: '#A5446A', symbol: '2', message: 'Sedikit demi sedikit, kita terus berkembang.' },
  { name: "Iqra' 1", color: '#79C9E5', pale: '#DFF3FA', dark: '#326D84', symbol: '1', message: 'Langkah pertama yang penuh kemungkinan.' },
].map(Object.freeze));

export const tabs = Object.freeze({
  dunia: { title: 'Dunia Quranverse', description: 'Perjalanan kecil hari ini, kejayaan indah esok hari.' },
  kedudukan: { title: 'Kedudukan Tasmik', description: 'Raikan usaha. Hargai setiap kemajuan.' },
  avatar: { title: 'Avatar Saya', description: 'Kenali pembaca di sebalik setiap perjalanan.' },
  guru: { title: 'Ruang Guru', description: 'Membimbing dengan mudah, melihat kemajuan bersama.' },
});
