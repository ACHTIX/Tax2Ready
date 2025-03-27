var express = require('express');
var router = express.Router();
const pool = require('../db');

// Route 1: รับข้อมูลจากฟอร์ม "ติดต่อเรา" และบันทึกลงในตาราง contact
// Endpoint: POST /contact/save
router.post('/saveContact', async (req, res) => {
    try {
        const { name, phone, email, message } = req.body;

        // ตรวจสอบข้อมูลว่าครบถ้วนหรือไม่
        if (!name || !phone || !email || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // เนื่องจากในฐานข้อมูล phone ถูกกำหนดเป็น integer ให้แปลงเป็นตัวเลข
        const phoneNumber = parseInt(phone, 10);
        if (isNaN(phoneNumber)) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        // Query สำหรับ INSERT ข้อมูล
        const query = `
      INSERT INTO "contact".contact (name, phone, email, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
        const values = [name, phoneNumber, email, message];
        const result = await pool.query(query, values);

        return res.status(201).json({
            message: 'Contact saved successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error inserting contact:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Route 2: ดึงข้อมูลทั้งหมดจากตาราง contact
// Endpoint: GET /contact/all
router.get('/allContact', async (req, res) => {
    try {
        const query = 'SELECT * FROM "contact".contact ORDER BY contact_id DESC;';
        const result = await pool.query(query);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
