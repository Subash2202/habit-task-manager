const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router(); router.use(requireAuth);
const FREQUENCIES = ["daily", "weekdays", "custom"];

async function computeStreak(habitId) {
  const rows = await db.all("SELECT log_date, status FROM habit_logs WHERE habit_id = ? ORDER BY log_date DESC", habitId);
  let streak = 0; const cursor = new Date(); cursor.setHours(0,0,0,0);
  const byDate = new Map(rows.map(r => [r.log_date, r.status]));
  for (;;) {
    const key = cursor.toISOString().slice(0,10); const status = byDate.get(key);
    if (status === "done") { streak++; cursor.setDate(cursor.getDate()-1); }
    else if (status === undefined && key === new Date().toISOString().slice(0,10)) cursor.setDate(cursor.getDate()-1);
    else break;
  }
  return streak;
}

router.get("/", async (req,res,next) => { try {
  const habits = await db.all("SELECT * FROM habits WHERE user_id = ? AND archived = 0 ORDER BY created_at ASC", req.userId);
  const today = new Date(), weekAgo = new Date(today); weekAgo.setDate(today.getDate()-6);
  const from = weekAgo.toISOString().slice(0,10), to = today.toISOString().slice(0,10);
  const withLogs = await Promise.all(habits.map(async h => ({ ...h, recent_logs: await db.all("SELECT log_date, status, notes FROM habit_logs WHERE habit_id = ? AND log_date BETWEEN ? AND ?", h.id, from, to), streak: await computeStreak(h.id) })));
  res.json(withLogs);
} catch(err){next(err);} });

router.post("/", async (req,res,next) => { try {
  const {name,description,frequency,custom_days,target_per_week,color}=req.body||{};
  if(!name||!name.trim()) return res.status(400).json({error:"A habit needs a name."});
  const info=await db.run(`INSERT INTO habits (user_id,name,description,frequency,custom_days,target_per_week,color) VALUES (?,?,?,?,?,?,?) RETURNING id`,req.userId,name.trim(),description||"",FREQUENCIES.includes(frequency)?frequency:"daily",custom_days||"",Number.isFinite(+target_per_week)?+target_per_week:7,color||"#2F6FED");
  res.status(201).json(await db.get("SELECT * FROM habits WHERE id = ?",info.lastInsertRowid));
} catch(err){next(err);} });

router.put("/:id", async (req,res,next) => { try {
  const habit=await db.get("SELECT * FROM habits WHERE id = ? AND user_id = ?",req.params.id,req.userId); if(!habit)return res.status(404).json({error:"Habit not found."});
  const {name,description,frequency,custom_days,target_per_week,color,archived}=req.body||{};
  await db.run(`UPDATE habits SET name=?,description=?,frequency=?,custom_days=?,target_per_week=?,color=?,archived=? WHERE id=?`,name!==undefined&&name.trim()?name.trim():habit.name,description!==undefined?description:habit.description,FREQUENCIES.includes(frequency)?frequency:habit.frequency,custom_days!==undefined?custom_days:habit.custom_days,Number.isFinite(+target_per_week)?+target_per_week:habit.target_per_week,color||habit.color,archived!==undefined?(archived?1:0):habit.archived,habit.id);
  res.json(await db.get("SELECT * FROM habits WHERE id = ?",habit.id));
} catch(err){next(err);} });

router.post("/:id/log", async (req,res,next) => { try {
  const habit=await db.get("SELECT * FROM habits WHERE id = ? AND user_id = ?",req.params.id,req.userId); if(!habit)return res.status(404).json({error:"Habit not found."});
  const {date,status,notes}=req.body||{}, logDate=date||new Date().toISOString().slice(0,10);
  if(!["done","missed","skipped"].includes(status))return res.status(400).json({error:"Status must be done, missed or skipped."});
  await db.run(`INSERT INTO habit_logs (habit_id,user_id,log_date,status,notes) VALUES (?,?,?,?,?) ON CONFLICT(habit_id,log_date) DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes`,habit.id,req.userId,logDate,status,notes||"");
  res.json({habit_id:habit.id,log_date:logDate,status,streak:await computeStreak(habit.id)});
} catch(err){next(err);} });

router.delete("/:id/log/:date", async (req,res,next) => { try {
  const habit=await db.get("SELECT * FROM habits WHERE id = ? AND user_id = ?",req.params.id,req.userId); if(!habit)return res.status(404).json({error:"Habit not found."});
  await db.run("DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?",habit.id,req.params.date);
  res.json({habit_id:habit.id,log_date:req.params.date,status:null,streak:await computeStreak(habit.id)});
} catch(err){next(err);} });

router.delete("/:id", async (req,res,next) => { try { const info=await db.run("DELETE FROM habits WHERE id = ? AND user_id = ?",req.params.id,req.userId); if(info.changes===0)return res.status(404).json({error:"Habit not found."}); res.json({ok:true}); } catch(err){next(err);} });
module.exports=router;
