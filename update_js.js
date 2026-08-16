const fs = require('fs');
let code = fs.readFileSync('e:/岐黄阁/static/js/components/health-exercises.js', 'utf8');
const oldStr = '        if (ex.video_url) {\n            html += \'<div class="detail-section video-section">\';\n            html += \'<h3>官方演示视频</h3>\';\n            html += \'<iframe class="video-iframe" src="\' + escHtml(ex.video_url) + \'" frameborder="0" allowfullscreen></iframe>\';\n            html += \'</div>\';\n        }';
const newStr = '        if (ex.video_url) {\n            html += \'<div class="detail-section video-section">\';\n            html += \'<h3>官方演示视频</h3>\';\n            html += \'<iframe class="video-iframe" src="\' + escHtml(ex.video_url) + \'" frameborder="0" allowfullscreen></iframe>\';\n            if (ex.video_source) {\n                html += \'<div class="video-source">来源：\' + escHtml(ex.video_source) + \'</div>\';\n            }\n            html += \'</div>\';\n        }';
if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    fs.writeFileSync('e:/岐黄阁/static/js/components/health-exercises.js', code, 'utf8');
    console.log('JS updated successfully');
} else {
    console.log('Pattern not found, trying line-by-line...');
    // Fallback: replace the exact lines
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('iframe class="video-iframe"') && lines[i+1] && lines[i+1].includes('</div>')) {
            lines[i+1] = '            if (ex.video_source) {\n                html += \'<div class="video-source">来源：\' + escHtml(ex.video_source) + \'</div>\';\n            }\n' + lines[i+1];
            break;
        }
    }
    fs.writeFileSync('e:/岐黄阁/static/js/components/health-exercises.js', lines.join('\n'), 'utf8');
    console.log('JS updated via fallback');
}
