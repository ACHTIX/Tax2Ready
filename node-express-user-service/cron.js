require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const pool = require('./db');

// สร้าง transporter สำหรับส่งอีเมล โดยใช้ข้อมูลจาก .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT), // แปลงเป็นตัวเลข
    secure: false, // สำหรับพอร์ต 587 ให้ใช้ false; ถ้าใช้พอร์ต 465 ให้ใช้ true
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// กำหนด cron job ให้รันทุก 1 นาที (สำหรับทดสอบ)
cron.schedule('*/1 * * * *', async () => {
    console.log('Running cron job to fetch data and send email');

    try {
        // ดึงข้อมูลจากเว็บไซต์
        const response = await axios.get('https://www.itax.in.th/pedia/%E0%B8%84%E0%B9%88%E0%B8%B2%E0%B8%A5%E0%B8%94%E0%B8%AB%E0%B8%A2%E0%B9%88%E0%B8%AD%E0%B8%99-easy-e-receipt-2-0-%E0%B8%9B%E0%B8%B5-2568/');
        const $ = cheerio.load(response.data);

        // ตัวอย่างการดึงข้อมูล (ปรับตามต้องการ)
        const headline = $('h1').first().text().trim();
        const summary = $('p.summary').text().trim();

        // ดึงรายชื่อผู้ใช้ที่เปิดแจ้งเตือนจากฐานข้อมูล
        const userResult = await pool.query('SELECT email, name FROM "user".user WHERE notification_status = true');
        const users = userResult.rows;

        for (const user of users) {
            const mailOptions = {
                // เปลี่ยนจาก ethereal.email เป็นอีเมลที่ใช้งานจริงจาก SMTP_USER
                from: `"Tax2Ready" <${process.env.SMTP_USER}>`,
                to: user.email,
                subject: 'ข่าวสารค่าลดหย่อนภาษี Easy E-receipt 2.0 ปี2568',
                html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
          <p>สวัสดีคุณ ${user.name},</p>
          <p>นี่คือข้อมูลล่าสุดเกี่ยวกับมาตรการ <strong>Easy E-Receipt 2.0</strong> ที่ดึงมาเมื่อเช้านี้:</p>
          
          <h2>ค่าลดหย่อนภาษี Easy E-Receipt 2.0 ปี2568</h2>
          
          <p>
            มาตรการนี้ใช้สำหรับการซื้อสินค้าและบริการภายในประเทศที่เกิดขึ้นในช่วง
            <strong>16 มกราคม - 28 กุมภาพันธ์ 2568</strong> โดยผู้เสียภาษีสามารถลดหย่อนภาษีได้สูงสุดไม่เกิน
            <strong>50,000 บาท</strong> จากค่าใช้จ่ายที่จ่ายจริง
          </p>
          
          <h3>วัตถุประสงค์และประโยชน์</h3>
          <ul>
            <li>กระตุ้นเศรษฐกิจในประเทศผ่านการใช้จ่ายของประชาชน</li>
            <li>ส่งเสริมการใช้ระบบอิเล็กทรอนิกส์ (e-Tax Invoice & e-Receipt) ในการออกใบกำกับภาษี</li>
            <li>ลดภาระภาษีและเพิ่มความสะดวกในการจัดเก็บเอกสารในรูปแบบดิจิทัล</li>
          </ul>
          
          <h3>เอกสารและเงื่อนไขที่ต้องปฏิบัติ</h3>
          <ul>
            <li>
              ผู้ซื้อ/ผู้รับบริการต้องแจ้งข้อมูล เช่น ชื่อ-นามสกุล, เลขประจำตัวผู้เสียภาษี (หรือเลขบัตรประชาชน)
              และที่อยู่ (กรณีจำเป็น) เพื่อให้ออกเอกสารได้อย่างถูกต้อง
            </li>
            <li>
              ต้องใช้เอกสารเป็น <strong>ใบกำกับภาษีอิเล็กทรอนิกส์ (e-Tax Invoice)</strong> หรือ 
              <strong>ใบรับอิเล็กทรอนิกส์ (e-Receipt)</strong> เท่านั้น หากไม่ใช่จะไม่สามารถใช้สิทธิลดหย่อนภาษีได้
            </li>
          </ul>
          
          <h3>สำหรับผู้ประกอบการ</h3>
          <ul>
            <li>
              สามารถลงทะเบียนและออก e-Tax Invoice & e-Receipt ผ่านโปรแกรมที่ได้รับอนุญาต เช่น 
              <strong>Ultimate Sign & Viewer</strong> หรือใช้บริการผ่าน <strong>Service Provider</strong> ที่ได้รับอนุมัติ
            </li>
            <li>
              ระบบมีความสะดวก รวดเร็ว และปลอดภัยด้วยการใช้ลายเซ็นอิเล็กทรอนิกส์ (Digital Signature)
            </li>
          </ul>
          <p>แหล่งอ้างอิง: <a href="https://www.rd.go.th/27208.html" target="_blank">คลิกที่นี่</a></p>
          <hr>
          <p>
            <em>ดูข้อมูลเพิ่มเติมได้ที่: <a href="https://www.itax.in.th/pedia/%E0%B8%84%E0%B9%88%E0%B8%B2%E0%B8%A5%E0%B8%94%E0%B8%AB%E0%B8%A2%E0%B9%88%E0%B8%AD%E0%B8%99-easy-e-receipt-2-0-%E0%B8%9B%E0%B8%B5-2568/" target="_blank">https://www.itax.in.th/</a></em>
          </p>
        </body>
      </html>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email sent to ${user.email}`);
        }
    } catch (error) {
        console.error('Error in cron job:', error);
    }
});
