'use server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { run, str, withParam } from '@/lib/action';
import { isValidDate, today } from '@/lib/time';

const date = z.string().refine(isValidDate, 'Invalid date');
const optNum = (min, max) => z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().min(min).max(max).nullable());

export async function addWorkoutAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    const w = z.object({ date, title: z.string().trim().min(1, 'Workout title required').max(100), notes: z.string().max(1000) })
      .parse({ date: str(fd, 'date') || today(), title: str(fd, 'title'), notes: str(fd, 'notes') });
    const rows = [];
    for (let i = 0; i < 8; i++) {
      const ex = str(fd, `exercise_${i}`).trim();
      if (!ex) continue;
      rows.push(z.object({ exercise: z.string().max(80), sets: z.coerce.number().int().min(1).max(50), reps: z.coerce.number().int().min(1).max(500), weight: optNum(0, 1000) })
        .parse({ exercise: ex, sets: str(fd, `sets_${i}`) || 1, reps: str(fd, `reps_${i}`) || 1, weight: str(fd, `weight_${i}`) }));
    }
    if (!rows.length) throw new Error('Add at least one exercise.');
    const db = getDb();
    db.transaction(() => {
      const id = db.prepare('INSERT INTO workouts (user_id, date, title, notes) VALUES (?,?,?,?)').run(me.id, w.date, w.title, w.notes || null).lastInsertRowid;
      const ins = db.prepare('INSERT INTO workout_sets (workout_id, exercise, sets, reps, weight_kg) VALUES (?,?,?,?,?)');
      for (const r of rows) ins.run(id, r.exercise, r.sets, r.reps, r.weight);
    })();
    return withParam(back, 'msg', 'Workout saved.');
  });
}

export async function addFoodAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    const f = z.object({
      date, meal: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']), description: z.string().trim().min(1, 'Describe the food').max(200),
      calories: optNum(0, 10000), protein: optNum(0, 1000), carbs: optNum(0, 1000), fat: optNum(0, 1000),
    }).parse({ date: str(fd, 'date') || today(), meal: str(fd, 'meal'), description: str(fd, 'description'), calories: str(fd, 'calories'), protein: str(fd, 'protein'), carbs: str(fd, 'carbs'), fat: str(fd, 'fat') });
    getDb().prepare('INSERT INTO food_entries (user_id, date, meal, description, calories, protein_g, carbs_g, fat_g) VALUES (?,?,?,?,?,?,?,?)')
      .run(me.id, f.date, f.meal, f.description, f.calories, f.protein, f.carbs, f.fat);
    return withParam(back, 'msg', 'Food entry saved.');
  });
}

export async function addMeasurementAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    const m = z.object({ date, bf: optNum(1, 75), waist: optNum(30, 300), chest: optNum(30, 300), hips: optNum(30, 300) })
      .parse({ date: str(fd, 'date') || today(), bf: str(fd, 'bf'), waist: str(fd, 'waist'), chest: str(fd, 'chest'), hips: str(fd, 'hips') });
    if ([m.bf, m.waist, m.chest, m.hips].every((v) => v == null)) throw new Error('Enter at least one measurement.');
    getDb().prepare('INSERT INTO measurements (user_id, date, body_fat_pct, waist_cm, chest_cm, hips_cm) VALUES (?,?,?,?,?,?)')
      .run(me.id, m.date, m.bf, m.waist, m.chest, m.hips);
    return withParam(back, 'msg', 'Measurements saved.');
  });
}

export async function addNoteAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    const n = z.object({ date, body: z.string().trim().min(1, 'Note is empty').max(2000) }).parse({ date: str(fd, 'date') || today(), body: str(fd, 'body') });
    getDb().prepare('INSERT INTO notes (user_id, date, body) VALUES (?,?,?)').run(me.id, n.date, n.body);
    return withParam(back, 'msg', 'Note saved.');
  });
}

const TABLES = { workout: 'workouts', food: 'food_entries', measurement: 'measurements', note: 'notes' };
export async function deleteEntryAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    const table = TABLES[str(fd, 'kind')];
    if (!table) throw new Error('Unknown entry type');
    // Ownership enforced in the WHERE clause: members can only ever delete their own rows.
    getDb().prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(Number(fd.get('id')), me.id);
    return withParam(back, 'msg', 'Entry deleted.');
  });
}
