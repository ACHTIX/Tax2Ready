const express = require('express');
const router = express.Router();
const pool = require('../db'); // ไฟล์เชื่อมต่อฐานข้อมูล
const jwt = require('jsonwebtoken');
require('dotenv').config();

// (ถ้ามีระบบ Auth) Middleware ตรวจสอบ JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(403).json({error: 'Token required'});
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({error: 'Invalid token'});
        }
        req.user = user;
        next();
    });
};

// POST /tax-data/save
router.post('/save', authenticateToken, async (req, res) => {
    try {
        // รับค่าที่ส่งมาจาก result.html
        const {
            total_income,
            total_expenses,
            total_deduction,
            net_taxable_income,
            tax_payable,
            withheld_tax,
            final_tax_due,
            final_tax_rounded,
            status,
            description,
            date
        } = req.body;

        // สมมุติว่า user_id มาจาก JWT
        const user_id = req.user.user_id; // หรือถ้าไม่มี ก็ set เป็น null

        // สร้างคำสั่ง SQL (parameterized query) สำหรับ INSERT
        const insertQuery = `
            INSERT INTO tax_data.tax_data
            (user_id,
             total_income,
             total_expenses,
             total_deduction,
             net_taxable_income,
             tax_payable,
             withheld_tax,
             final_tax_due,
             final_tax_rounded,
             status,
             description,
             date)
            VALUES ($1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12) ON CONFLICT (user_id, date)
  DO
            UPDATE
                SET
                    total_income = EXCLUDED.total_income,
                total_expenses = EXCLUDED.total_expenses,
                total_deduction = EXCLUDED.total_deduction,
                net_taxable_income = EXCLUDED.net_taxable_income,
                tax_payable = EXCLUDED.tax_payable,
                withheld_tax = EXCLUDED.withheld_tax,
                final_tax_due = EXCLUDED.final_tax_due,
                final_tax_rounded = EXCLUDED.final_tax_rounded,
                status = EXCLUDED.status,
                description = EXCLUDED.description,
                updated_at = now()
                RETURNING transaction_id
        `;


        const values = [
            user_id,
            total_income,
            total_expenses,
            total_deduction,
            net_taxable_income,
            tax_payable,
            withheld_tax,
            final_tax_due,
            final_tax_rounded,
            status,
            description,
            date
        ];

        // เรียกใช้งาน Pool เพื่อ INSERT ข้อมูล
        const result = await pool.query(insertQuery, values);
        const transactionId = result.rows[0].transaction_id;

        // ตอบกลับไปยัง client
        return res.status(201).json({
            message: 'Data saved successfully',
            transactionId
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({error: 'Server error'});
    }
});

module.exports = router;
