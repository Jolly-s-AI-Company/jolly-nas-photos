const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 30000;
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, 'storage');

// 确保存储目录存在
fs.ensureDirSync(path.join(STORAGE_PATH, 'photos'));
fs.ensureDirSync(path.join(STORAGE_PATH, 'videos'));

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const dir = ['.mp4', '.mov', '.avi', '.mkv'].includes(ext) ? 'videos' : 'photos';
        cb(null, path.join(STORAGE_PATH, dir));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// 支持的文件类型
const PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const LIVE_PHOTO_EXTS = ['.webp', '.mov']; // 服务端转码后的Live Photo格式

// ============ API ============

// 上传照片
app.post('/api/photos', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择照片文件' });
    res.json({ success: true, message: '照片上传成功', file: req.file.filename });
});

// 上传视频
app.post('/api/videos', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择视频文件' });
    res.json({ success: true, message: '视频上传成功', file: req.file.filename });
});

// 获取照片列表
app.get('/api/photos', (req, res) => {
    const photosDir = path.join(STORAGE_PATH, 'photos');
    fs.readdir(photosDir, (err, files) => {
        if (err) return res.json({ photos: [] });
        const photos = files.filter(f => PHOTO_EXTS.includes(path.extname(f).toLowerCase()))
            .map(f => ({ name: f, url: `/storage/photos/${f}` }));
        res.json({ photos });
    });
});

// 获取视频列表
app.get('/api/videos', (req, res) => {
    const videosDir = path.join(STORAGE_PATH, 'videos');
    fs.readdir(videosDir, (err, files) => {
        if (err) return res.json({ videos: [] });
        const videos = files.filter(f => VIDEO_EXTS.includes(path.extname(f).toLowerCase()))
            .map(f => ({ name: f, url: `/storage/videos/${f}` }));
        res.json({ videos });
    });
});

// 删除文件
app.delete('/api/files/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const validTypes = ['photos', 'videos'];
    if (!validTypes.includes(type)) return res.status(400).json({ message: '无效类型' });
    
    const filePath = path.join(STORAGE_PATH, type, filename);
    fs.remove(filePath, err => {
        if (err) return res.status(500).json({ success: false, message: '删除失败' });
        res.json({ success: true, message: '删除成功' });
    });
});

// 静态文件服务
app.use('/storage/photos', express.static(path.join(STORAGE_PATH, 'photos')));
app.use('/storage/videos', express.static(path.join(STORAGE_PATH, 'videos')));

// ============ 前端页面 ============
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jolly NAS - 照片视频备份</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; }
        .header { background: #16213e; padding: 20px; text-align: center; }
        .header h1 { color: #0f3460; -webkit-text-fill-color: #e94560; }
        .tabs { display: flex; justify-content: center; gap: 10px; padding: 20px; background: #16213e; }
        .tab { padding: 12px 24px; background: #0f3460; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
        .tab.active { background: #e94560; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .upload-section { background: #16213e; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        .upload-section h3 { margin-bottom: 15px; color: #e94560; }
        .upload-btn { display: inline-block; padding: 12px 24px; background: #e94560; color: white; border-radius: 8px; cursor: pointer; }
        .upload-btn input { display: none; }
        .file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
        .file-item { background: #16213e; border-radius: 12px; overflow: hidden; }
        .file-item img, .file-item video { width: 100%; height: 150px; object-fit: cover; }
        .file-item .info { padding: 10px; }
        .file-item .name { font-size: 12px; word-break: break-all; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; }
        .modal.show { display: flex; justify-content: center; align-items: center; }
        .modal-content { max-width: 90%; max-height: 90%; }
        .modal-content img, .modal-content video { max-width: 100%; max-height: 80vh; }
        .close-btn { position: absolute; top: 20px; right: 20px; font-size: 32px; color: white; cursor: pointer; }
    </style>
</head>
<body>
    <div class="header"><h1>📸 Jolly NAS</h1></div>
    <div class="tabs">
        <button class="tab active" onclick="showTab('photos')">照片</button>
        <button class="tab" onclick="showTab('videos')">视频</button>
    </div>
    <div class="container">
        <div class="upload-section" id="photoUpload">
            <h3>上传照片</h3>
            <label class="upload-btn">
                选择照片
                <input type="file" accept="image/*" onchange="uploadFile(this, 'photos')">
            </label>
        </div>
        <div class="upload-section" id="videoUpload" style="display:none">
            <h3>上传视频</h3>
            <label class="upload-btn">
                选择视频
                <input type="file" accept="video/mp4,video/quicktime" onchange="uploadFile(this, 'videos')">
            </label>
        </div>
        <div class="file-list" id="fileList"></div>
    </div>
    <div class="modal" id="previewModal" onclick="closeModal()">
        <span class="close-btn">&times;</span>
        <div class="modal-content" id="modalContent"></div>
    </div>
    <script>
        let currentTab = 'photos';
        
        function showTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('photoUpload').style.display = tab === 'photos' ? 'block' : 'none';
            document.getElementById('videoUpload').style.display = tab === 'videos' ? 'block' : 'none';
            loadFiles();
        }
        
        async function uploadFile(input, type) {
            const file = input.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append(type === 'photos' ? 'photo' : 'video', file);
            const res = await fetch('/api/' + type, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) { alert('上传成功'); loadFiles(); }
            else { alert('上传失败: ' + data.message); }
            input.value = '';
        }
        
        async function loadFiles() {
            const res = await fetch('/api/' + currentTab);
            const data = await res.json();
            const list = currentTab === 'photos' ? data.photos : data.videos;
            let html = '';
            list.forEach(f => {
                if (currentTab === 'photos') {
                    html += \`<div class="file-item" onclick="preview('\${f.url}', 'img')">
                        <img src="\${f.url}" alt="\${f.name}">
                        <div class="info"><div class="name">\${f.name}</div></div>
                    </div>\`;
                } else {
                    html += \`<div class="file-item" onclick="preview('\${f.url}', 'video')">
                        <video src="\${f.url}"></video>
                        <div class="info"><div class="name">\${f.name}</div></div>
                    </div>\`;
                }
            });
            document.getElementById('fileList').innerHTML = html || '<p>暂无文件</p>';
        }
        
        function preview(url, type) {
            const modal = document.getElementById('previewModal');
            const content = document.getElementById('modalContent');
            if (type === 'img') content.innerHTML = '<img src="' + url + '">';
            else content.innerHTML = '<video src="' + url + '" controls autoplay></video>';
            modal.classList.add('show');
        }
        
        function closeModal() { document.getElementById('previewModal').classList.remove('show'); }
        
        loadFiles();
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`🚀 Jolly NAS 服务启动: http://localhost:${PORT}`);
    console.log(`📁 存储路径: ${STORAGE_PATH}`);
});