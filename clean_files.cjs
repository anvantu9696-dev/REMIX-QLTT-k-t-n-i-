const fs = require('fs');

function cleanIssues() {
    let code = fs.readFileSync('server/routes/issues.ts', 'utf8');
    code = code.replace(/\}\);\n  \} catch \(err: any\) \{\n    res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi hệ thống' \}\);\n  \}\n\}\);/g, '});');
    fs.writeFileSync('server/routes/issues.ts', code);
}

function cleanProposals() {
    let code = fs.readFileSync('server/routes/proposals.ts', 'utf8');
    // From my error analysis, proposals.ts has multiple dangling:
    //  } catch (err: any) {
    //    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
    //  }
    // });
    // And also console.error ones.
    
    // Instead, I'll just use the old `cleanTasks` logic but tailored. Let's just fix proposals.ts with a direct regex on the duplicate catches.
    code = code.replace(/\}\);\n  \} catch \(err: any\) \{\n    (?:console\.error\('.*', err\);\n    )?res\.status\(500\)\.json\(\{ success: false, message: 'Lỗi hệ thống' \}\);\n  \}\n\}\);/g, '});');
    fs.writeFileSync('server/routes/proposals.ts', code);
}

function cleanSchedules() {
    let code = fs.readFileSync('server/routes/schedules.ts', 'utf8');
    // schedules.ts has:
    //  } catch (err: any) {
    //    return res.status(500).json({ success: false, message: err.message });
    //  }
    // });
    code = code.replace(/\}\);\n  \} catch \(err: any\) \{\n    return res\.status\(500\)\.json\(\{ success: false, message: err\.message \}\);\n  \}\n\}\);/g, '});');
    fs.writeFileSync('server/routes/schedules.ts', code);
}

cleanIssues();
cleanProposals();
cleanSchedules();
console.log('files cleaned');
