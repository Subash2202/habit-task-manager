const express=require("express"); const db=require("../db"); const {requireAuth}=require("../middleware/auth");
const router=express.Router(); router.use(requireAuth);
router.get("/",async(req,res,next)=>{try{const userId=req.userId,today=new Date().toISOString().slice(0,10);const[dueToday,overdue,deferred,taskCounts,habits,todaysHabitLogs,activeGoals]=await Promise.all([
 db.all(`SELECT * FROM tasks WHERE user_id = ? AND status NOT IN ('done','deferred') AND due_date = ? ORDER BY priority DESC`,userId,today),
 db.all(`SELECT * FROM tasks WHERE user_id = ? AND status NOT IN ('done','deferred') AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date ASC`,userId,today),
 db.all(`SELECT * FROM tasks WHERE user_id = ? AND status = 'deferred' ORDER BY deferred_to ASC`,userId),
 db.all(`SELECT status, COUNT(*)::int AS count FROM tasks WHERE user_id = ? GROUP BY status`,userId),
 db.all(`SELECT * FROM habits WHERE user_id = ? AND archived = 0`,userId),
 db.all(`SELECT habit_id, status FROM habit_logs WHERE user_id = ? AND log_date = ?`,userId,today),
 db.all(`SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY period_end ASC`,userId)
]);const loggedToday=new Map(todaysHabitLogs.map(l=>[l.habit_id,l.status]));const habitsToday=habits.map(h=>({id:h.id,name:h.name,color:h.color,status_today:loggedToday.get(h.id)||"pending"}));res.json({date:today,due_today:dueToday,overdue,deferred,task_counts:taskCounts,habits_today:habitsToday,active_goals:activeGoals});}catch(err){next(err);}}); module.exports=router;
