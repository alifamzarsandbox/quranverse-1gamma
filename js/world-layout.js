import { statuses } from './config.js';

export const bridgeConnections = Object.freeze([
  ["Iqra' 1", "Iqra' 2"], ["Iqra' 2", "Iqra' 3"], ["Iqra' 3", "Iqra' 4"],
  ["Iqra' 4", "Iqra' 5"], ["Iqra' 5", "Iqra' 6"], ["Iqra' 6", 'Al-Quran'],
  ['Al-Quran', 'Khatam'],
].map(pair => Object.freeze(pair)));

export function createWorldLayout(students) {
  const seen = new Set();
  const groups = new Map(statuses.map(status => [status.name, []]));
  for (const student of students) {
    if (!student.id || seen.has(student.id) || !groups.has(student.status)) throw new Error('Rekod murid tidak sah.');
    seen.add(student.id);
    groups.get(student.status).push(student);
  }
  const zones = statuses.map((status, index) => {
    const members = groups.get(status.name).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const columns = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const rows = Math.max(1, Math.ceil(members.length / columns));
    const radius = Math.max(4.7, Math.hypot((columns - 1) * 1.9, (rows - 1) * 2.1) + 2.3);
    return { ...status, index, members, columns, rows, radius, x: 0, z: 0, slots: [] };
  });
  // Return along the upper row so consecutive stages remain neighbors.
  const grid = [['Khatam', 'Al-Quran', "Iqra' 6", "Iqra' 5"], ["Iqra' 1", "Iqra' 2", "Iqra' 3", "Iqra' 4"]];
  const zonesByName = new Map(zones.map(zone => [zone.name, zone]));
  const widths = grid[0].map((_, column) => Math.max(...grid.map(row => zonesByName.get(row[column]).radius)) * 2);
  const depths = grid.map(row => Math.max(...row.map(name => zonesByName.get(name).radius)) * 2);
  const gap = 3.8;
  const width = widths.reduce((sum, value) => sum + value, 0) + gap * 3;
  const depth = depths[0] + depths[1] + gap;
  let left = -width / 2;
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 2; row++) {
      const zone = zonesByName.get(grid[row][column]);
      zone.x = left + widths[column] / 2;
      zone.z = row === 0 ? -depth / 2 + depths[0] / 2 : depth / 2 - depths[1] / 2;
      zone.slots = zone.members.map((student, index) => {
        const slotRow = Math.floor(index / zone.columns);
        const rowCount = Math.min(zone.columns, zone.members.length - slotRow * zone.columns);
        return { id: student.id, x: zone.x + (index % zone.columns - (rowCount - 1) / 2) * 3.8, y: .28, z: zone.z + (slotRow - (zone.rows - 1) / 2) * 4.2 };
      });
    }
    left += widths[column] + gap;
  }
  return { zones, width, depth, bounds: { min: [-width / 2 - 1, -4, -depth / 2 - 1], max: [width / 2 + 1, 4.8, depth / 2 + 1] } };
}
