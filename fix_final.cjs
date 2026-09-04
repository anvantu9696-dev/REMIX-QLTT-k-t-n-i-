const fs = require('fs');

function addCatch(filePath, errorMessage) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Any `res.json({...});` followed by `\n\n//` or `\n\nexport` is missing its catch block.
    // BUT we must make sure we don't duplicate.
    
    // First, let's just do a naive replace:
    code = code.replace(/res\.json\((\{[\s\S]*?\})\);\n\n(?=\/\/|export)/g, `res.json($1);\n  } catch (err: any) {\n    res.status(500).json({ success: false, message: '${errorMessage}' });\n  }\n});\n\n`);
    
    fs.writeFileSync(filePath, code);
}

addCatch('server/routes/proposals.ts', 'Lỗi hệ thống');
addCatch('server/routes/schedules.ts', 'Lỗi hệ thống');
console.log('done');
