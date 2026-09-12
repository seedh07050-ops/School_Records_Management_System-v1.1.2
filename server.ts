import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { recommendTaskCards, batchRecommend } from './src/utils/similarityUtils';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: 'local_similarity' });
});

// 로컬 과제카드 유사도 기반 보존기간 추천 API (인터넷/API 키 없이 로컬 계산)
app.post('/api/recommend-retention', (req, res) => {
  try {
    const { title, taskCards } = req.body;
    if (!title || !taskCards || !Array.isArray(taskCards)) {
      return res.status(400).json({ error: '기록물철 제목과 과제카드 목록이 필요합니다.' });
    }
    const result = recommendTaskCards(title, taskCards);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: '과제카드 유사도 추천 중 오류가 발생했습니다.' });
  }
});

// 로컬 과제카드 유사도 기반 일괄 추천 API
app.post('/api/batch-recommend-retention', (req, res) => {
  try {
    const { items, taskCards } = req.body;
    if (!items || !Array.isArray(items) || !taskCards || !Array.isArray(taskCards)) {
      return res.status(400).json({ error: '추천할 목록과 과제카드 목록이 필요합니다.' });
    }
    const resultMap = batchRecommend(items, taskCards);
    const results = Array.from(resultMap.entries()).map(([id, val]) => ({
      id,
      recommended_period: val.period,
      matched_card_name: val.topMatch?.name || '해당없음',
      similarity: val.topMatch?.similarity || 0,
      reason: val.reason,
      is_none: val.isNone,
    }));
    return res.json({ success: true, results });
  } catch (error) {
    console.error('Batch recommendation error:', error);
    res.status(500).json({ error: '일괄 추천 처리 중 오류가 발생했습니다.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
