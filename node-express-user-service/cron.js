require('dotenv').config();
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const pool = require('./db');

// สร้าง transporter สำหรับส่งอีเมล โดยใช้ข้อมูลจาก .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // ถ้าใช้พอร์ต 465 ให้ secure เป็น true
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ตรวจสอบการตั้งค่า transporter (optional)
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP configuration error:', error);
    } else {
        console.log('SMTP configuration is correct.');
    }
});

// ตั้งค่า cron job (ตัวอย่าง: ทุกวันเวลา 09:00 น.)
cron.schedule('0 9 * * *', async () => {
    console.log('Running cron job to send pending notifications');

    try {
        // ดึงข่าวสารล่าสุดจากตาราง email_tem โดยเรียงจาก year แบบ descending
        const latestAnnouncementResult = await pool.query(`
            SELECT content FROM "notifications".email_tem
            ORDER BY year DESC LIMIT 1;
        `);
        let messageForNotification = '';
        if (latestAnnouncementResult.rowCount > 0) {
            messageForNotification = latestAnnouncementResult.rows[0].content;
        }

        // ตัวอย่าง: สร้าง notification ใหม่สำหรับ user (ในที่นี้กำหนด user_id เป็น 1)
        const userId = 1; // ปรับปรุงให้เหมาะสมตามระบบจริง
        await pool.query(`
      INSERT INTO "notification".notification (user_id, message, status)
      VALUES ($1, $2, 'pending')
    `, [userId, messageForNotification]);

        // ดึง notification ที่ยังไม่ส่ง (status = 'pending') ร่วมกับข้อมูลผู้ใช้
        const pendingNotifications = await pool.query(`
      SELECT n.notification_id, n.message, n.status, u.email, u.name
      FROM "notification".notification AS n
      JOIN "user".user AS u ON n.user_id = u.user_id
      WHERE n.status = 'pending'
    `);

        if (pendingNotifications.rowCount === 0) {
            console.log('No pending notifications to send.');
            return;
        }

        // วนลูปส่งอีเมลสำหรับแต่ละ notification
        for (const row of pendingNotifications.rows) {
            const { notification_id, message, email, name } = row;
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

            try {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${email}`);
                // อัปเดต status เป็น 'sent' และบันทึกเวลาที่ส่ง
                await pool.query(`
                    UPDATE "notification".notification
                    SET status = $1,
                        sent_at = NOW()
                    WHERE notification_id = $2
                `, ['sent', notification_id]);
            } catch (emailError) {
                console.error(`Error sending email to ${email}:`, emailError);
            }
        }
    } catch (error) {
        console.error('Error in cron job:', error);
    }
});
