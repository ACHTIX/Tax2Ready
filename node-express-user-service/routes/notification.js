const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
    try {
        const { title, content, year } = req.body;
        if (!title || !content || !year) {
            return res.status(400).json({ message: "กรุณากรอกข้อมูลครบทุกช่อง" });
        }
        // ตรวจสอบว่ามีข่าวสารที่มีปีเดียวกันอยู่แล้วหรือไม่
        const existing = await pool.query(
            `SELECT * FROM "notification".email_tem WHERE year = $1`,
            [year]
        );
        if (existing.rowCount > 0) {
            return res.status(400).json({ message: "ไม่สามารถเลือกปีซ้ำได้" });
        }
        // บันทึกข้อมูลลงในตาราง email_tem พร้อมบันทึก created_at เป็นเวลาปัจจุบัน
        const result = await pool.query(
            `INSERT INTO "notification".email_tem (title, content, year, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *;`,
            [title, content, year]
        );
        res.status(201).json({ message: "บันทึกข้อมูลเรียบร้อยแล้ว", data: result.rows[0] });
    } catch (error) {
        console.error("Error inserting announcement:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
});

module.exports = router;
