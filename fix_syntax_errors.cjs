const fs = require('fs');

function removeExtraneousCatch(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Look for duplicate catch block at the end of router.get('/')
    // Specifically looking for:
    // });
    //   } catch (err) { ... }
    // });
    
    // Actually, I'll just remove the specific extraneous lines based on regex.
    code = code.replace(/\}\);\n  \} catch \((?:err|error)(?:: any)?\) \{\n    (?:return )?res\.status\(500\)\.json\(\{ success: false, message: (?:err\.message|'Lỗi'|'Lỗi hệ thống'|error\.message) \}\);\n  \}\n\}\);/g, '});');
    
    fs.writeFileSync(filePath, code);
}

removeExtraneousCatch('server/routes/tasks.ts');
removeExtraneousCatch('server/routes/issues.ts');
removeExtraneousCatch('server/routes/schedules.ts');
removeExtraneousCatch('server/routes/proposals.ts');
console.log('done');
