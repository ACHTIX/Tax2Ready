const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const pool = require('./db');

require('dotenv').config();
require('./cron'); // เรียก cron job เพียงครั้งเดียว

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var app = express();
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var taxDataRouter = require('./routes/tax-data');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/tax-data', taxDataRouter);

var PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
