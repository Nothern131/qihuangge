const fs = require('fs');
let code = fs.readFileSync('e:/岐黄阁/static/js/components/health-exercises.js', 'utf8');
const marker = 'if (ex.video_source) {';
const idx = code.indexOf(marker);
if (idx !== -1) {
    const afterSource = code.indexOf('</div>', idx);
    const insertPoint = code.indexOf('\n', afterSource) + 1;
    const insertText = '\n            if (ex.video_note) {\n                html += \'<div class="video-note">\u26a0\ufe0f ' +
        escHtml(ex.video_note) + '</div>\';\n            }';
    // Find the closing brace of the video block
    const closingBrace = code.indexOf('            }', insertPoint);
    const beforeClosing = code.substring(0, closingBrace);
    const afterClosing = code.substring(closingBrace);
    code = beforeClosing + insertText + afterClosing;
    fs.writeFileSync('e:/岐黄阁/static/js/components/health-exercises.js', code, 'utf8');
    console.log('JS updated with video_note support');
} else {
    console.log('marker not found');
}
// Validate
try { new Function(code); console.log('JS syntax: OK'); }
catch(e) { console.log('JS ERROR:', e.message); }
