const fs = require('fs');
let c = fs.readFileSync('e:/岐黄阁/static/js/components/health-exercises.js', 'utf8');

// Find the position after video_source block and before </div>
let searchFrom = c.indexOf('if (ex.video_source)');
let target = c.indexOf('</div>', searchFrom);
let insertPos = c.indexOf('\n', target) + 1;

let noteBlock = "\n            if (ex.video_note) {\n                html += '<div class=\"video-note\">⚠️ ' + escHtml(ex.video_note) + '</div>';\n            }";

let newCode = c.substring(0, insertPos) + noteBlock + c.substring(insertPos);

fs.writeFileSync('e:/岐黄阁/static/js/components/health-exercises.js', newCode, 'utf8');
console.log('JS updated');

try { new Function(newCode); console.log('JS syntax: OK'); }
catch(e) { console.log('JS ERROR:', e.message); }
