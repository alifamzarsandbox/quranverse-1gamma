import { outfits } from './config.js';

export function outfitFor(key) { return outfits.find(item => item.key === key); }

// Unknown optional values are a visible preview fallback, never an automatic write.
export function avatarDraft(student) {
  if (!student) return null;
  const outfit = outfitFor(student.outfit) || outfits[0];
  const colors = outfit.palettes[student.gender];
  if (!colors) throw new Error('Jantina murid tidak sah.');
  const color = colors.includes(student.color) ? student.color : colors[0];
  return { outfit: outfit.key, color };
}

export function changeOutfit(student, draft, key) {
  const outfit = outfitFor(key);
  const colors = outfit?.palettes[student.gender];
  if (!colors) throw new Error('Pakaian tidak sah.');
  return { outfit: key, color: colors.includes(draft.color) ? draft.color : colors[0] };
}

export function applyDemoAvatar(student, draft, mode) {
  if (mode !== 'demo') throw new Error('Perubahan ini hanya tersedia dalam demo.');
  if (!student || !draft || Object.keys(draft).some(key => !['outfit', 'color'].includes(key)) ||
      !outfitFor(draft.outfit)?.palettes[student.gender]?.includes(draft.color)) {
    throw new Error('Pilihan avatar tidak sah.');
  }
  return Object.freeze({ ...student, outfit: draft.outfit, color: draft.color });
}
