require('dotenv').config();
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const pool = require('./db');

// สร้าง transporter สำหรับส่งอีเมล โดยใช้ข้อมูลจาก .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT), // แปลงเป็นตัวเลข
    secure: false, // ถ้าใช้พอร์ต 465 ให้ตั้งเป็น true
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ตั้งค่า cron job (ตัวอย่าง: ทุกวันเวลา 09:00 น.)
cron.schedule('0 9 * * *', async () => {
    console.log('Running cron job to send pending notifications');

    try {
        // 1) ดึง notification ที่ยังไม่ส่ง (status = 'pending')
        //    และ join กับตาราง user เพื่อได้อีเมลและชื่อของผู้ใช้
        const pendingNotifications = await pool.query(`
            SELECT n.notification_id,
                   n.message,
                   n.status,
                   u.email,
                   u.name
            FROM notification AS n
            JOIN "user".user AS u ON n.user_id = u.user_id
            WHERE n.status = 'pending'
        `);

        if (pendingNotifications.rowCount === 0) {
            console.log('No pending notifications to send.');
            return;
        }

        // 2) วนลูปส่งอีเมลแต่ละรายการ
        for (const row of pendingNotifications.rows) {
            const { notification_id, message, email, name } = row;

            // กำหนด mailOptions ตามต้องการ
            const mailOptions = {
                from: `"Tax2Ready" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'แจ้งเตือนจาก Tax2Ready',
                html: `
                    <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <p>สวัสดีคุณ ${name},</p>
                        <p>${message}</p>
                        <hr>
                        <p>หากต้องการข้อมูลเพิ่มเติม โปรดติดต่อเราได้ทุกเมื่อ</p>
                    </body>
                    </html>
                `
            };

            // ส่งอีเมล
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${email}`);

            // 3) อัปเดต status เป็น 'sent' และ set sent_at เป็นเวลาปัจจุบัน
            await pool.query(
                `UPDATE notification
                 SET status = $1,
                     sent_at = NOW()
                 WHERE notification_id = $2`,
                ['sent', notification_id]
            );
        }
    } catch (error) {
        console.error('Error in cron job:', error);
    }
});
