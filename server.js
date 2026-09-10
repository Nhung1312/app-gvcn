import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Server-side AI endpoint using Gemini SDK
app.post('/api/generate-ai-notify', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Nội dung nhắc nhở không được để trống' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ'
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Đóng vai một giáo viên chủ nhiệm, hãy soạn một thông báo gửi vào nhóm Zalo cho phụ huynh học sinh với nội dung cốt lõi sau: ${prompt}. Yêu cầu: Giọng văn lịch sự, chuyên nghiệp, súc tích, có biểu tượng cảm xúc (emoji) cho sinh động.`
            }
          ]
        }
      ]
    });

    const text = response.text?.trim();
    if (!text) {
      return res.status(500).json({ error: 'Không nhận được phản hồi từ AI' });
    }

    return res.json({ result: text });
  } catch (err) {
    console.error('Gemini API Error:', err);
    return res.status(500).json({ error: err.message || 'Lỗi xử lý AI' });
  }
});

// Serve static files from the project root
app.use(express.static(__dirname));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
