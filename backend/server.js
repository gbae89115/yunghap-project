const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 커넥션 풀 설정 (Aiven 전용 포트 및 SSL 강제)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  port: parseInt(process.env.DB_PORT, 10) || 10710,
  connectTimeout: 20000, // 타임아웃 여유시간 20초 지정
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

// 메인 루트 확인
app.get('/', (req, res) => {
  res.send('🚀 RoutineNote API Server is Running!');
});

// 1. 오늘 루틴 목록 및 운동 일지 조회 API
app.get('/api/workout/today', async (req, res) => {
  const userId = req.query.userId || 'dadad';
  const today = new Date().toISOString().split('T')[0];

  try {
    let [logs] = await pool.query(
      'SELECT * FROM WORKOUT_LOG WHERE user_id = ? AND workout_date = ?',
      [userId, today]
    );

    let logId;
    if (logs.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO WORKOUT_LOG (user_id, workout_date, is_completed, current_streak) VALUES (?, ?, FALSE, 0)',
        [userId, today]
      );
      logId = result.insertId;
    } else {
      logId = logs[0].log_id;
    }

    const [routines] = await pool.query(
      'SELECT selection_id, routine_type, routine_name, is_checked, confirmed_at FROM TODAY_ROUTINE_SELECTION WHERE log_id = ?',
      [logId]
    );

    res.json({ success: true, logId, today, routines });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 루틴 체크/해제 API
app.post('/api/workout/check', async (req, res) => {
  const { selectionId, isChecked } = req.body;

  try {
    const confirmedAt = isChecked ? new Date() : null;
    await pool.query(
      'UPDATE TODAY_ROUTINE_SELECTION SET is_checked = ?, confirmed_at = ? WHERE selection_id = ?',
      [isChecked, confirmedAt, selectionId]
    );

    res.json({ success: true, message: '루틴 상태가 업데이트 되었습니다.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. GPS 런닝 기록 저장 API
app.post('/api/workout/gps', async (req, res) => {
  const { selectionId, distance, calories, routePath } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO GPS_LOG (selection_id, distance, calories, route_path) VALUES (?, ?, ?, ?)',
      [selectionId || null, distance || 0, calories || 0, JSON.stringify(routePath || [])]
    );

    if (selectionId) {
      await pool.query(
        'UPDATE TODAY_ROUTINE_SELECTION SET is_checked = TRUE, confirmed_at = NOW() WHERE selection_id = ?',
        [selectionId]
      );
    }

    res.json({ success: true, gpsId: result.insertId, message: 'GPS 기록 저장 완료' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. 카카오 로그인 (REST API 방식)
//    키·시크릿은 Render 환경변수에만 둔다
// ==========================================
const APP_URL = 'https://appassets.androidplatform.net/assets/index.html';

// 4-1. 앱이 이 주소로 오면 카카오 로그인 페이지로 보낸다
app.get('/api/auth/kakao/login', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

// 4-2. 카카오가 인가 코드를 들고 돌아오는 곳
app.get('/api/auth/kakao/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${APP_URL}#kakaoError=${encodeURIComponent(error || 'no_code')}`);
  }

  try {
    // (1) 인가 코드로 토큰 받기
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error(token.error_description || 'token_failed');

    // (2) 토큰으로 사용자 정보 조회
    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = await meRes.json();
    if (!me.id) throw new Error('user_info_failed');

    const userId = `kakao_${me.id}`;
    const nickname = (me.kakao_account && me.kakao_account.profile && me.kakao_account.profile.nickname) || '';

    // (3) USER 테이블에 회원 저장 (이미 있으면 그대로)
    await pool.query(
      "INSERT IGNORE INTO `USER` (user_id, password, provider) VALUES (?, NULL, 'KAKAO')",
      [userId]
    );

    // (4) 앱으로 돌려보내기
    const payload = encodeURIComponent(JSON.stringify({ userId, nickname }));
    res.redirect(`${APP_URL}#kakaoLogin=${payload}`);
  } catch (e) {
    console.error('Kakao login error:', e.message);
    res.redirect(`${APP_URL}#kakaoError=login_failed`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});