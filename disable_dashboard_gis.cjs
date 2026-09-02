const fs = require('fs');
let content = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

const targetStr = `              <button
                onClick={() => onNavigate('/gis-map')}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/40 transition-all flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  BẢN ĐỒ GIS
                </span>
              </button>`;

const replacementStr = `{/* GIS Map Button Disabled temporarily to reduce Firestore Reads */}
              {/* <button
                onClick={() => onNavigate('/gis-map')}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/40 transition-all flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  BẢN ĐỒ GIS
                </span>
              </button> */}`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('src/pages/DashboardPage.tsx', content);
