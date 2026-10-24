const fs = require('fs');

function norm(str) { return str.replace(/\r\n/g, '\n'); }

const file = 'public/app/js/app.js';
let s = fs.readFileSync(file, 'utf8');
const isCRLF = s.includes('\r\n');
let nS = norm(s);

const target = `        if (typeof CustomerController !== 'undefined' && CustomerController.render) {
          CustomerController.render();
        }`;

const repl = `        if (typeof CustomerController !== 'undefined') {
          CustomerController.isLoading = false;
          CustomerController.isInitialLoaded = true;
          if (CustomerController.render) {
            CustomerController.render();
          }
        }`;

if (!nS.includes(norm(target))) {
  console.error('Target not found in app.js');
  process.exit(1);
}

nS = nS.replace(norm(target), norm(repl));
if (isCRLF) nS = nS.replace(/\n/g, '\r\n');
fs.writeFileSync(file, nS, 'utf8');
console.log('Successfully updated app.js');
