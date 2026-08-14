# 转写

## 默认：ManualTranscriptProvider

支持粘贴文本和导入 TXT / Markdown；识别“说话人：内容”分段。全部片段初始为 `unreviewed`，姓名、数字、机构和专有词会提示复核。

## 可选：本地 Whisper

```dotenv
TRANSCRIPTION_PROVIDER=local_whisper
LOCAL_WHISPER_BASE_URL=http://localhost:9000
TRANSCRIPTION_MAX_FILE_MB=100
```

仅接受回环地址和 MP3、WAV、M4A、WebM。浏览器和服务端都会校验扩展名、MIME、大小与文件签名；音频只在内存中转发给本地服务，不写临时文件、不记录本地路径、不上传云端。

公开 Vercel / GitHub Pages 模式没有本地 Whisper。接口不可用、超时或格式错误时，项目数据保留并提示改用人工粘贴。

## 复核边界

自动转写不等于准确记录。低置信度片段及姓名、数字、机构、专有词必须人工校正；未复核片段不能成为直接引语或事实证据。
