const fs = require('fs');

function restoreCatchBlock(filePath, catchBody) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // The destructive regex replaced:
    // res.json({...});\n  } catch (err) {\n    res.status(500).json({...});\n  }\n});
    // with:
    // res.json({...});
    
    // We can find all instances of `res.json({...});` that are at the end of a route handler.
    // They are usually followed by `\n//` or `\n\n//` or `\nexport default`.
    
    // We will do a generic regex that looks for `res.json(...});` followed by `\n\n//` or `\n\nexport` or `\n//`
    // and inserts the catch block.
    
    code = code.replace(/res\.json\((\{[\s\S]*?\})\);\n(?=\n*\/\/|\n*export|\n*async function)/g, `res.json($1);\n  } catch (err: any) {\n    ${catchBody}\n  }\n});\n`);
    
    fs.writeFileSync(filePath, code);
}

restoreCatchBlock('server/routes/tasks.ts', "res.status(500).json({ success: false, message: 'Lỗi' });");
restoreCatchBlock('server/routes/issues.ts', "res.status(500).json({ success: false, message: 'Lỗi hệ thống' });");
restoreCatchBlock('server/routes/schedules.ts', "return res.status(500).json({ success: false, message: err.message });");
restoreCatchBlock('server/routes/proposals.ts', "res.status(500).json({ success: false, message: 'Lỗi hệ thống' });");
console.log('done');
