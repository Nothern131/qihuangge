const fs = require('fs');
let c = fs.readFileSync('e:/岐黄阁/static/js/components/health-exercises.js', 'utf8');

// Fix the broken video section
const oldSection = `            html += '<div class="detail-section video-section">';
            html += '<h3>官方演示视频</h3>';
            html += '<iframe class="video-iframe" src="' + escHtml(ex.video_url) + '" frameborder="0" allowfullscreen></iframe>';
            if (ex.video_source) {
                html += '<div class="video-source">📺 来源：' + escHtml(ex.video_source) + '</div>';

            if (ex.video_note) {
                html += '<div class="video-note">⚠️ ' + escHtml(ex.video_note) + '</div>';
            }            }
            if (ex.video_note) {
                html += '<div class="video-note">\\u26a0\\ufe0f ' + escHtml(ex.video_note) + '</div>';
            }
            html += '</div>';`;

const newSection = `            html += '<div class="detail-section video-section">';
            html += '<h3>官方演示视频</h3>';
            html += '<iframe class="video-iframe" src="' + escHtml(ex.video_url) + '" frameborder="0" allowfullscreen></iframe>';
            if (ex.video_source) {
                html += '<div class="video-source">📺 来源：' + escHtml(ex.video_source) + '</div>';
            }
            if (ex.video_note) {
                html += '<div class="video-note">\\u26a0\\ufe0f ' + escHtml(ex.video_note) + '</div>';
            }
            html += '</div>';`;

if (c.includes(oldSection)) {
    c = c.replace(oldSection, newSection);
    fs.writeFileSync('e:/岐黄阁/static/js/components/health-exercises.js', c, 'utf8');
    console.log('Fixed successfully');
} else {
    console.log('Section not found, trying line-by-line fix...');
    // Write the whole file with correct section
    const lines = c.split('\n');
    let inVideoSection = false;
    let skipUntilClose = false;
    let newLines = [];
    let replaced = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!replaced && line.includes('iframe class="video-iframe"')) {
            // Start replacement from here
            inVideoSection = true;
            newLines.push(line);
            continue;
        }
        if (inVideoSection && !replaced) {
            if (line.includes('video_source')) {
                newLines.push(line);
                continue;
            }
            if (line.trim() === 'if (ex.video_note) {' && !replaced) {
                // Skip this block and the duplicate
                // Replace with correct version
                newLines.push("            if (ex.video_note) {");
                newLines.push("                html += '<div class=\"video-note\">\\u26a0\\ufe0f ' + escHtml(ex.video_note) + '</div>';");
                newLines.push("            }");
                replaced = true;
                inVideoSection = false;
                continue;
            }
            if (line.trim() === '}            }' || line.trim() === '            }' && i > 0 && lines[i-1].trim() === '') {
                // Skip duplicate closing
                continue;
            }
            if (line.includes('video_note') && !replaced) {
                continue; // skip
            }
            if (line.includes('</div>') && inVideoSection && !replaced && i > 0) {
                // This is the closing </div> of video-section
                newLines.push(line);
                inVideoSection = false;
                continue;
            }
            // Skip everything else in the broken section
            continue;
        }
        newLines.push(line);
    }

    c = newLines.join('\n');
    fs.writeFileSync('e:/岐黄阁/static/js/components/health-exercises.js', c, 'utf8');
    console.log('Fixed via line-by-line');
}

try { new Function(c); console.log('JS syntax: OK'); }
catch(e) { console.log('JS ERROR:', e.message); }
